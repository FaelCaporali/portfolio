"""F1/F2/F7/F8 da vida `fullstack`: atlas dos 12 adesivos de vinil (cor + ORM) e o contorno de corte (die-cut).

Roda FORA do Blender (precisa de cv2 e PIL), chamado por prop_fullstack.py:
    /data/venv-face/bin/python 3d/tools/prop_fullstack_logos.py <pasta_saida>
Entrada: os SVG oficiais de `3d/referencias/props/fullstack/logos/` (fontes em FONTES.md), rasterizados pelo Inkscape,
sem redesenho. Cada adesivo = logo + margem branca de 2 mm (medida real), recorte arredondado (dilatação por disco),
concavidades estreitas fechadas como faz a faca de corte. Desgaste por nível (F2): 1 novo; 2 pouco gasto; 3 velho
(cor desbotada e amarelada, arranhões, sujeira na borda). Saída: atlas_cor.webp, atlas_orm.webp e adesivos.json
(contorno em mm reais, centro na caixa do recorte, y para cima; retângulo no atlas; px por mm).
"""
import json
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
LOGOS = os.path.join(AQUI, '..', 'referencias', 'props', 'fullstack', 'logos')
# slug, nível (F2), maior lado do adesivo recortado em cm REAIS (FICHA: Node ~7; nível 1 ~4–5; 2 ~3–3,5; 3 ~2–2,5), svg
ESTOQUE = (('node', 1, 7.0, 'node.svg'), ('express', 1, 5.4, 'express.svg'), ('trpc', 1, 4.3, 'trpc.svg'),
           ('react', 1, 4.6, 'react.svg'), ('typescript', 1, 4.3, 'typescript.svg'), ('prisma', 1, 4.3, 'prisma.svg'),
           ('postgresql', 1, 4.6, 'postgresql.svg'), ('python', 2, 3.3, 'python.svg'),
           ('reactnative', 2, 3.5, 'reactnative_quadrado.svg'), ('r', 3, 2.4, 'r.svg'), ('c', 3, 2.3, 'c_adesivo.svg'),
           ('laravel', 3, 2.3, 'laravel.svg'))
# fundo sob o logo (contraste do DAILY 1): placa escura da composição; nos demais, o próprio vinil branco
FUNDO = {'reactnative': (0.125, 0.137, 0.165), 'c': (0.122, 0.137, 0.157)}
MARGEM_MM = 2.5                                # DAILY 1: a margem de 2 mm quase não aparecia no 1440
HI = 24.0                                      # px/mm do trabalho (contorno e desgaste)
VINIL = np.array([0.955, 0.953, 0.94])         # branco do vinil
RUG = {1: 0.26, 2: 0.33, 3: 0.44}              # rugosidade do vinil por nível (alumínio ~0,42–0,5)
ATLAS = 1024
PAD = 6                                        # ≥ 4 px entre ilhas
VERSO = 12                                     # quadradinho do verso (papel do adesivo levantado)


def rasterizar(svg, lado_px):
    out = os.path.join('/data/tmp', 'fs_logo_' + os.path.basename(svg) + '.png')
    subprocess.run(['inkscape', svg, '--export-type=png', '--export-background-opacity=0',
                    '--export-width=%d' % lado_px, '--export-filename=' + out], check=True, capture_output=True)
    im = np.asarray(Image.open(out).convert('RGBA')).astype(np.float32) / 255
    im[..., :3] *= im[..., 3:4]                                                # pré-multiplicado: sem franja no resize
    a = im[..., 3] > 0.02
    ys, xs = np.nonzero(a)
    return im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def disco(r):
    r = max(1, int(round(r)))
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def recorte(alfa):
    """Máscara do corte: logo dilatado pela margem, concavidades < 6 mm fechadas, furos preenchidos; maior contorno."""
    m0 = (alfa > 0.5).astype(np.uint8)
    m = cv2.dilate(m0, disco(MARGEM_MM * HI))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, disco(3.0 * HI))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    cheio = np.zeros_like(m)
    cv2.drawContours(cheio, [c], -1, 1, -1)
    if (m0 & ~cheio.astype(bool)).sum() > 0.001 * m0.sum():     # algo do logo ficou fora: casco convexo
        c = cv2.convexHull(np.concatenate(cs))
        cheio[:] = 0
        cv2.drawContours(cheio, [c], -1, 1, -1)
    return cheio.astype(bool), c


def desgaste(rgb, rug, mascara, nivel, semente):
    """Cor e rugosidade gastas (F2): nível 2 pouco; nível 3 desbotado, amarelado, arranhado, sujo na borda."""
    rnd = np.random.RandomState(semente)
    h, w = mascara.shape
    cinza = rgb.mean(-1, keepdims=True)
    if nivel == 1:
        return rgb, rug + (rnd.rand(h, w) - 0.5) * 0.02
    desat = 0.10 if nivel == 2 else 0.42
    rgb = rgb * (1 - desat) + cinza * desat
    if nivel == 3:
        rgb = rgb * 0.8 + np.array([0.93, 0.90, 0.82]) * 0.2                     # UV: desbota e amarela
        dist = cv2.distanceTransform(mascara.astype(np.uint8), cv2.DIST_L2, 5) / HI
        suj = (np.clip(1 - dist / 0.9, 0, 1) * mascara)[..., None]               # só dentro do recorte
        rgb = rgb * (1 - 0.07 * suj) + np.array([0.45, 0.42, 0.38]) * 0.07 * suj * 0.4   # leve: a margem fica branca
        rug = rug + 0.10 * suj[..., 0]
    riscos = np.zeros((h, w), np.float32)
    for _ in range(4 if nivel == 2 else 16):
        x0, y0 = rnd.rand(2) * (w, h)
        ang, comp = rnd.rand() * np.pi, (0.15 + rnd.rand() * 0.45) * min(w, h)
        x1, y1 = x0 + np.cos(ang) * comp, y0 + np.sin(ang) * comp
        cv2.line(riscos, (int(x0), int(y0)), (int(x1), int(y1)), 0.35 + 0.5 * rnd.rand(),
                 max(1, int(HI * (0.06 if nivel == 2 else 0.1))), cv2.LINE_AA)
    riscos = cv2.GaussianBlur(riscos, (0, 0), HI * 0.03) * (0.35 if nivel == 2 else 0.8)
    rgb = rgb * (1 - riscos[..., None]) + VINIL * riscos[..., None]                # tinta riscada mostra o vinil
    return np.clip(rgb, 0, 1), np.clip(rug + riscos * 0.35, 0, 1)


def adesivo(slug, nivel, lado_cm, svg, semente):
    lado = lado_cm * 10.0
    im = rasterizar(os.path.join(LOGOS, svg), 1600)
    h0, w0 = im.shape[:2]
    k = (lado - 2 * MARGEM_MM) / max(h0, w0)                                   # mm por px do raster
    lw, lh = int(round(w0 * k * HI)), int(round(h0 * k * HI))
    logo = cv2.resize(im, (lw, lh), interpolation=cv2.INTER_AREA)
    p = int(round((MARGEM_MM + 3.5) * HI))
    tela = np.zeros((lh + 2 * p, lw + 2 * p, 4), np.float32)
    tela[p:p + lh, p:p + lw] = logo
    mascara, cont = recorte(tela[..., 3])
    ys, xs = np.nonzero(mascara)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    tela, mascara = tela[y0:y1, x0:x1], mascara[y0:y1, x0:x1]
    a = tela[..., 3:4]
    rgb = VINIL * (1 - a) + tela[..., :3]
    orig = rgb.copy()
    rgb, rug = desgaste(rgb, np.full(mascara.shape, RUG[nivel], np.float32), mascara, nivel, semente)
    contraste = medir_contraste(orig, rgb, mascara, np.array(FUNDO.get(slug, VINIL)))
    eps = 0.18 * HI
    c = cv2.approxPolyDP(cont, eps, True)[:, 0, :].astype(np.float64) - (x0, y0)
    H, W = mascara.shape
    mm = [[round((x - W / 2) / HI, 3), round((H / 2 - y) / HI, 3)] for x, y in c]
    if cv2.contourArea(np.float32(mm)) < 0:                                    # anti-horário visto de cima
        mm = mm[::-1]
    return {'slug': slug, 'nivel': nivel, 'lado_cm': lado_cm, 'tam_mm': [round(W / HI, 2), round(H / HI, 2)],
            'contorno_mm': mm, 'rgb': rgb, 'rug': rug, 'contraste': contraste}


def _lum(c):
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return c @ np.array([0.2126, 0.7152, 0.0722])


def medir_contraste(orig, gasto, mascara, fundo):
    """Contraste WCAG (já com o desgaste) entre a tinta do logo e o fundo sob ele: pixels cuja cor ORIGINAL difere do
    fundo (placa ou vinil) × pixels iguais a ele. Fundo: mediana. Tinta: o contraste que ao menos 25 % da tinta atinge
    (logo de duas cores, como Python e R, tem uma parte clara e outra escura)."""
    d = np.abs(orig - fundo).max(-1)
    tinta, base = mascara & (d > 0.15), mascara & (d < 0.04)
    lb = np.median(_lum(gasto[base]))
    lt = np.percentile(_lum(gasto[tinta]), 25 if lb > 0.2 else 75)
    return round(float((max(lt, lb) + 0.05) / (min(lt, lb) + 0.05)), 2)


def empacotar(itens, k):
    """Prateleiras em ATLAS² a k px/mm; o quadradinho do verso vai primeiro. Devolve {slug: (x, y, w, h)} ou None."""
    caixas = sorted(((s['slug'], int(np.ceil(s['tam_mm'][0] * k)), int(np.ceil(s['tam_mm'][1] * k))) for s in itens),
                    key=lambda t: -t[2])
    pos, x, y, alt = {'_verso': (PAD, PAD, VERSO, VERSO)}, 2 * PAD + VERSO, PAD, VERSO
    for slug, w, h in caixas:
        if x + w + PAD > ATLAS:
            x, y, alt = PAD, y + alt + PAD, 0
        if y + h + PAD > ATLAS:
            return None
        pos[slug] = (x, y, w, h)
        x, alt = x + w + PAD, max(alt, h)
    return pos


def main(saida):
    os.makedirs(saida, exist_ok=True)
    itens = [adesivo(s, n, l, f, 11 + i) for i, (s, n, l, f) in enumerate(ESTOQUE)]
    for k in (9.0, 8.0, 7.0, 6.5, 6.0, 5.5, 5.0):
        pos = empacotar(itens, k)
        if pos:
            break
    cor = np.ones((ATLAS, ATLAS, 3), np.float32) * VINIL
    orm = np.ones((ATLAS, ATLAS, 3), np.float32) * (1.0, RUG[1], 0.0)
    x, y, w, h = pos['_verso']
    cor[y:y + h, x:x + w] = 0.84                                                # verso: papel siliconado
    orm[y:y + h, x:x + w, 1] = 0.6
    out = {'atlas': ATLAS, 'px_por_mm': k, 'margem_mm': MARGEM_MM, 'verso_px': pos['_verso'], 'adesivos': []}
    for s in itens:
        x, y, w, h = pos[s['slug']]
        cor[y:y + h, x:x + w] = cv2.resize(s['rgb'], (w, h), interpolation=cv2.INTER_AREA)
        orm[y:y + h, x:x + w, 1] = cv2.resize(s['rug'], (w, h), interpolation=cv2.INTER_AREA)
        d = {c: s[c] for c in ('slug', 'nivel', 'lado_cm', 'tam_mm', 'contraste', 'contorno_mm')}
        d['atlas_px'] = [x, y, w, h]
        out['adesivos'].append(d)
    print('CONTRASTE', {s['slug']: s['contraste'] for s in itens})
    Image.fromarray((cor * 255 + 0.5).astype(np.uint8)).save(os.path.join(saida, 'atlas_cor.webp'), 'WEBP',
                                                            quality=90, method=6)
    orm = cv2.resize(orm, (ATLAS // 2, ATLAS // 2), interpolation=cv2.INTER_AREA)
    Image.fromarray((orm * 255 + 0.5).astype(np.uint8)).save(os.path.join(saida, 'atlas_orm.webp'), 'WEBP',
                                                            quality=85, method=6)
    Image.fromarray((cor * 255 + 0.5).astype(np.uint8)).save(os.path.join(saida, 'atlas_cor.png'))
    with open(os.path.join(saida, 'adesivos.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('ATLAS', k, 'px/mm', [(d['slug'], d['tam_mm'], len(d['contorno_mm'])) for d in out['adesivos']])


if __name__ == '__main__':
    main(sys.argv[1])
