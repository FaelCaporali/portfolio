"""Leque de cartões de visita (E8) do "Entrepreneur": geometria do leque (compartilhada com o Blender) e a arte-RASCUNHO
da face de cada cartão, desenhada com PIL. Roda com o python3 do sistema (o Blender não tem PIL):

    python3 3d/tools/prop_empreendedor_cartoes_arte.py <saida.jpg>

CONTRATO DE UV (para o TD, se o texto definitivo virar canvas do site):
- Malha única `cartoes` (5 cartões, 1 material `cartoes_papel`, 1 chamada de desenho).
- TEXCOORD_0 `UVMap` = atlas 1024×864 (JPEG embutido como baseColor). Cartão k (0 = fundo/mais antigo … 4 = frente/hoje)
  na célula col = k % 2, lin = k // 2 (lin 0 no topo da imagem), 512×288 px; a face impressa ocupa 504×280 px a partir de
  (col·512 + 4, lin·288 + 4); 4 px de sangria com a cor de fundo. Célula 5 (col 1, lin 2): faixas lisas do verso e das
  bordas, uma por cartão (k·84 px a partir de x = 516).
- TEXCOORD_1 `UVCartao` = 0..1 próprio de cada face: u = 0 na borda curta LONGE do pivô, u = 1 na borda do pivô;
  v = 0 na borda de baixo, v = 1 na de cima (texto em pé com v para cima). Verso e bordas: (0, 0).
- Impressão em mm: d = u·90 (a partir da borda longe do pivô), y = v·50.
"""
import math
import sys

W, H, ESP, RAIO = 90.0, 50.0, 0.5, 2.5          # cartão de visita (mm): 90×50, papel 0,5 mm, cantos 2,5 mm
N, PASSO, PHI0, DESLIZA = 5, 12.0, -20.0, 9.0   # 5 cartões, 12° entre eles, o da frente a −20°, 9 mm de escorregão
ATLAS, CEL, PAD = (1024, 864), (512, 288), 4
PX = 11.2                                        # px/mm do desenho (2× supersample; 504 px finais = 90 mm)

# k: (nome em runs [(texto, fonte, cor)], sub-linha em runs, carimbo, tinta, fundo, verso)
F = {'serif_it': '/usr/share/fonts/opentype/urw-base35/C059-BdIta.otf',
     'slab': '/usr/share/fonts/opentype/urw-base35/P052-Bold.otf',
     'gothic': '/usr/share/fonts/opentype/urw-base35/URWGothic-Demi.otf',
     'ub': '/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf', 'um': '/usr/share/fonts/truetype/ubuntu/Ubuntu-M.ttf',
     'mono': '/usr/share/fonts/truetype/ubuntu/UbuntuMono-B.ttf',
     'sans': '/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf',
     'stamp': '/usr/share/fonts/opentype/urw-base35/NimbusSansNarrow-Bold.otf'}
CARTOES = [
    dict(nome=[('WadiBrownies', 'serif_it', '#4a2a1b')], sub=[], carimbo='PIVOTED', tinta='#4b3591',
         fundo='#f3e5cf', verso='#4a2a1b'),
    dict(nome=[('Hostel', 'slab', '#2f4a34')], sub=[('Piedade do Paraopeba', 'ub', '#9a4c2c')], carimbo='CLOSED',
         tinta='#b3261e', fundo='#eee8da', verso='#2f4a34'),
    dict(nome=[('Escola de Vela', 'gothic', '#1d3557')], sub=[('Lagoa dos Ingleses', 'ub', '#2f7fb0')],
         carimbo='VALIDATED', tinta='#2b7a34', fundo='#f5f7f9', verso='#1d3557', sub_alt=4.4),
    dict(nome=[('SUP ', 'ub', '#0f6b70'), ('Lagoa Santa', 'um', '#d0603f')], sub=[], carimbo='PANDEMIC',
         tinta='#1e1e22', fundo='#e4f1f0', verso='#0f6b70'),
    dict(nome=[('caporali', 'mono', '#16191d'), ('.dev', 'mono', '#1f9d55')], sub=[('Fael Caporali', 'sans', '#56606c')],
         carimbo='IN PROGRESS', tinta='#1f4fa3', fundo='#f4f5f7', verso='#16191d'),
]
MIOLO = '#f1ede4'


def phi(k):
    return PHI0 + (N - 1 - k) * PASSO


def para_mundo(k, d, y):
    """Impressão (d, y) mm do cartão k → plano do leque (X, Y) mm, pivô na origem; o cartão vai para −X."""
    a = math.radians(phi(k))
    x, yy = d - W, y + DESLIZA * (N - 1 - k)
    return x * math.cos(a) + yy * math.sin(a), -x * math.sin(a) + yy * math.cos(a)


def de_mundo(k, X, Y):
    a = math.radians(phi(k))
    return X * math.cos(a) - Y * math.sin(a) + W, X * math.sin(a) + Y * math.cos(a) - DESLIZA * (N - 1 - k)


def celula(k):
    """Retângulo (u0, v0, u1, v1) da face impressa do cartão k no atlas, em UV do Blender (v para cima)."""
    x0, y0 = (k % 2) * CEL[0] + PAD, (k // 2) * CEL[1] + PAD
    return x0 / ATLAS[0], 1 - (y0 + 280) / ATLAS[1], (x0 + 504) / ATLAS[0], 1 - y0 / ATLAS[1]


def uv_atlas(k, u, v):
    u0, v0, u1, v1 = celula(k)
    return u0 + (u1 - u0) * u, v0 + (v1 - v0) * v


def uv_verso(k):
    return (CEL[0] + PAD + 84 * k + 42) / ATLAS[0], 1 - (2 * CEL[1] + CEL[1] / 2) / ATLAS[1]


# ------------------------------------------------------------------------------------------------------------------
# Arte (PIL só aqui dentro)
def _p(d, y):
    return d * PX, (H - y) * PX


def _cobertura(k):
    """Máscara (L) do que os cartões da frente cobrem na face do cartão k (coordenadas do desenho)."""
    from PIL import Image, ImageDraw
    m = Image.new('L', (round(W * PX), round(H * PX)), 0)
    dr = ImageDraw.Draw(m)
    for j in range(k + 1, N):
        cont = [para_mundo(j, d, y) for d, y in ((0, 0), (W, 0), (W, H), (0, H))]
        dr.polygon([_p(*de_mundo(k, X, Y)) for X, Y in cont], fill=255)
    return m


def _fonte(chave, px):
    from PIL import ImageFont
    return ImageFont.truetype(F[chave], max(6, round(px)))


def _runs(dr, runs, esc, x, y_topo, desenhar=True):
    """Desenha runs com o topo da caixa de tinta em y_topo; devolve (largura, altura) em px."""
    caixas = [dr.textbbox((0, 0), t, font=_fonte(f, esc), anchor='ls') for t, f, _ in runs]
    topo, base = min(c[1] for c in caixas), max(c[3] for c in caixas)
    cx = x
    for (t, f, cor), c in zip(runs, caixas):
        if desenhar:
            dr.text((cx, y_topo - topo), t, font=_fonte(f, esc), fill=cor, anchor='ls')
        cx += dr.textlength(t, font=_fonte(f, esc))
    return cx - x, base - topo


def _livre(cob, y_base_mm, margem=1.0):
    """Maior d (mm) até onde a faixa acima de y_base_mm está livre dos cartões da frente."""
    col = cob.crop((0, round((H - y_base_mm - margem) * PX), cob.width, round((H - y_base_mm) * PX + 1)))
    bb = col.getbbox()
    return (bb[0] / PX) if bb else W


def _texto_ajustado(img, runs, y_topo, alt_mm, d0, cob, desenhar=True):
    """Maior corpo que cabe em alt_mm de altura e na faixa livre; devolve (y da base da caixa em mm, altura mm)."""
    from PIL import ImageDraw
    dr = ImageDraw.Draw(img)
    esc = alt_mm * PX
    for _ in range(40):
        w, h = _runs(dr, runs, esc, 0, 0, False)
        if h / PX <= alt_mm and d0 + w / PX <= _livre(cob, y_topo - h / PX) - 0.5:
            break
        esc *= 0.96
    w, h = _runs(dr, runs, esc, d0 * PX, (H - y_topo) * PX, desenhar)
    return y_topo - h / PX, h / PX, w / PX


def _carimbo(texto, cap_mm, ang, semente):
    """Carimbo de borracha: moldura dupla de cantos redondos + texto em caixa alta, gasto e girado; devolve máscara L."""
    from PIL import Image, ImageChops, ImageDraw, ImageFilter
    f = _fonte('stamp', cap_mm * PX / 0.72)
    esp = cap_mm * PX * 0.04
    larg = sum(ImageDraw.Draw(Image.new('L', (1, 1))).textlength(c, font=f) for c in texto) + esp * (len(texto) - 1)
    w, h = round(larg + 3.2 * PX), round(cap_mm * PX + 2.8 * PX)
    m = Image.new('L', (w, h), 0)
    dr = ImageDraw.Draw(m)
    dr.rounded_rectangle((2, 2, w - 3, h - 3), radius=1.2 * PX, outline=255, width=round(0.55 * PX))
    dr.rounded_rectangle((0.85 * PX, 0.85 * PX, w - 0.85 * PX, h - 0.85 * PX), radius=0.7 * PX, outline=255,
                         width=round(0.22 * PX))
    x = 1.6 * PX
    for c in texto:
        dr.text((x, h / 2 + cap_mm * PX / 2), c, font=f, fill=255, anchor='ls')
        x += dr.textlength(c, font=f) + esp
    import random
    random.seed(semente)
    fino = Image.effect_noise((w, h), 60).filter(ImageFilter.GaussianBlur(1.1))
    grosso = Image.effect_noise((max(2, w // 18), max(2, h // 18)), 40).resize((w, h), Image.BICUBIC)
    gasto = ImageChops.multiply(fino.point(lambda v: 255 if v < 150 else max(0, 255 - (v - 150) * 9)),
                                grosso.point(lambda v: min(255, 150 + v)))
    m = ImageChops.multiply(m.filter(ImageFilter.GaussianBlur(0.7)), gasto)
    return m.rotate(ang, resample=Image.BICUBIC, expand=True)


def _decoracao(dr, k, c):
    """Elementos gráficos de cada marca (a parte baixa dos cartões de trás fica escondida no leque, mas existe)."""
    P = _p
    if k == 0:                                   # brownies: faixa de chocolate e quatro quadrados de brownie
        dr.rectangle((*P(0, 8), *P(W, 0)), fill=c['verso'])
        for i, j in ((0, 0), (1, 0), (0, 1), (1, 1)):
            dr.rounded_rectangle((*P(70 + 7.5 * i, 26 - 7.5 * j), *P(76.5 + 7.5 * i, 19.5 - 7.5 * j)),
                                 radius=0.9 * PX, fill='#5b3423')
    elif k == 1:                                 # hostel: serra e sol
        dr.ellipse((*P(66, 25), *P(76, 15)), fill='#d98a4e')
        dr.polygon([P(*q) for q in ((0, 0), (0, 9), (18, 20), (33, 11), (52, 24), (70, 10), (90, 17), (90, 0))],
                   fill=c['verso'])
    elif k == 2:                                 # vela: vela triangular e ondas
        dr.polygon([P(72, 30), P(72, 11), P(84, 11)], fill=c['verso'])
        dr.polygon([P(70, 27), P(70, 11), P(62, 11)], fill='#2f7fb0')
        dr.polygon([P(60, 9.5), P(86, 9.5), P(82, 6.5), P(64, 6.5)], fill=c['verso'])
        for i in range(3):
            dr.line([P(4 + 28 * i + 7 * t / 6, 3 + 1.2 * math.sin(t)) for t in range(0, 38, 2)], fill='#9cc3da',
                    width=round(0.6 * PX))
    elif k == 3:                                 # SUP: sol se pondo, remo e linhas d'água
        dr.ellipse((*P(64, 26), *P(84, 6)), fill='#f0a07e')
        dr.rectangle((*P(0, 12), *P(W, 0)), fill='#bfe0de')
        dr.line([P(30, 5), P(56, 30)], fill=c['verso'], width=round(0.9 * PX))
        dr.ellipse((*P(26, 7.5), *P(32, 2)), fill=c['verso'])
        for y in (9, 5.5):
            dr.line([P(0, y), P(W, y)], fill='#8cc6c3', width=round(0.5 * PX))
    else:                                        # caporali.dev: barra de terminal e o sinal de código
        dr.rectangle((*P(0, 6), *P(W, 0)), fill=c['verso'])
        dr.text(P(6, 17), '</>', font=_fonte('mono', 8 * PX), fill='#1f9d55', anchor='ls')
        for i, cor in enumerate(('#e0605a', '#e6b84a', '#4fb36a')):
            dr.ellipse((*P(80 + 3 * i, 4), *P(82 + 3 * i, 2)), fill=cor)


def cartao(k):
    from PIL import Image, ImageChops, ImageDraw, ImageFilter
    c = CARTOES[k]
    img = Image.new('RGB', (round(W * PX), round(H * PX)), c['fundo'])
    dr = ImageDraw.Draw(img)
    _decoracao(dr, k, c)
    cob, antes = _cobertura(k), img.copy()
    y_nome, h_nome, w_nome = _texto_ajustado(img, c['nome'], 47.5, 8.0 if k < 4 else 9.0, 4.0, cob)
    rel = {'nome_mm': round(h_nome, 1), 'nome_larg_mm': round(w_nome, 1)}
    y_fim = y_nome
    if c['sub']:
        y_fim, h_sub, _ = _texto_ajustado(img, c['sub'], y_nome - 0.9, c.get('sub_alt', 5.2), 4.3, cob)
        rel['sub_mm'] = round(h_sub, 1)
    # Carimbo: nos cartões de trás, girado com a borda do cartão da frente, o mais baixo possível e sem tocar a tinta
    # do nome e da sub-linha (máscara real das letras, com 0,5 mm de folga); no da frente, à direita, abaixo do nome.
    letras = ImageChops.difference(antes, img).convert('L').point(lambda v: 255 if v > 8 else 0)
    letras = letras.filter(ImageFilter.MaxFilter(5))
    ang = PASSO if k < N - 1 else -7.0
    if k < N - 1:          # o mais baixo possível, 1 mm acima do cartão da frente, sem pisar nome nem sub-linha
        x0, borda = round(2.2 * PX), cob.filter(ImageFilter.MaxFilter(11))
        for cap in (4.4, 4.1, 3.8):
            m, melhor = _carimbo(c['carimbo'], cap, ang, k), None
            for yy in range(img.height - m.height, -1, -3):
                cam = Image.new('L', img.size, 0)
                cam.paste(m, (x0, yy))
                if not ImageChops.multiply(cam, borda).getbbox():
                    melhor = yy
                    break
            cam = Image.new('L', img.size, 0)
            cam.paste(m, (x0, melhor or 0))
            pisa = ImageChops.multiply(cam.point(lambda v: 255 if v > 40 else 0), letras).getbbox() is not None
            if melhor is not None and not pisa:
                break
        assert melhor is not None, 'carimbo sem lugar no cartão %d' % k
        rel['carimbo_cap_mm'], rel['carimbo_pisa_letras'] = cap, round(sum(ImageChops.multiply(
            cam.point(lambda v: 255 if v > 40 else 0), letras).histogram()[128:]) / max(1, sum(letras.histogram()[128:])), 3)
    else:
        m = _carimbo(c['carimbo'], 5.2, ang, k)                                       # o da frente: à direita, no meio do espaço abaixo do nome
        x0 = round(88 * PX) - m.width
        melhor = round((H - (y_fim - 3 + 7) / 2) * PX - m.height / 2)
    cam = Image.new('L', img.size, 0)
    cam.paste(m, (x0, melhor))
    tinta = Image.new('RGB', img.size, c['tinta'])
    camada = Image.composite(tinta, Image.new('RGB', img.size, '#ffffff'), cam.point(lambda v: v * 0.9))
    img = ImageChops.multiply(img, camada)
    coberto = ImageChops.multiply(cam, cob).getbbox()
    rel.update(carimbo_mm=[round(m.width / PX, 1), round(m.height / PX, 1)], carimbo_coberto=bool(coberto))
    return img, rel


def atlas(saida):
    from PIL import Image, ImageDraw
    at = Image.new('RGB', ATLAS, MIOLO)
    dr = ImageDraw.Draw(at)
    for k in range(N):
        col, lin = k % 2, k // 2
        dr.rectangle((col * CEL[0], lin * CEL[1], (col + 1) * CEL[0] - 1, (lin + 1) * CEL[1] - 1),
                     fill=CARTOES[k]['fundo'])
        img, rel = cartao(k)
        at.paste(img.resize((504, 280), Image.LANCZOS), (col * CEL[0] + PAD, lin * CEL[1] + PAD))
        dr.rectangle((CEL[0] + PAD + 84 * k, 2 * CEL[1], CEL[0] + PAD + 84 * k + 83, 3 * CEL[1] - 1),
                     fill=CARTOES[k]['verso'])
        print('CARTAO', k, CARTOES[k]['carimbo'], rel)
    at.save(saida, quality=int(sys.argv[2]) if len(sys.argv) > 2 else 80, optimize=True, subsampling=0)
    print('ATLAS', saida)


if __name__ == '__main__':
    atlas(sys.argv[1])
