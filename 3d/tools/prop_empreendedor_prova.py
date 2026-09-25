"""Provas do mostruário do "Entrepreneur" (chamado por prop_empreendedor.py com provas=<pasta>).

1. Medida (json): caixa em px CSS de cada candidato e do busto nas 3 telas, pela câmera do site (comum.camera_site),
   se cabe na faixa livre da ficha, altura relativa à cabeça, tris e kB do glb.
2. Argila (Workbench, cavidade) na câmera do 1440 com o busto: recorte com a cabeça em escala ao lado.
3. Material: Cycles no estúdio da v6 (mesmas direções de luz do site), câmera na direção da câmera do site.
4. Folha de contato ≤ 1568 px: por candidato, material + argila, rótulo E# id e medidas.
"""
import json
import math
import os
import subprocess

import bpy
from mathutils import Vector

import comum
import prop_financeiro_v6 as v6
from prop_financeiro_direita_prova import caixa_px

CABECA = {'1440x900': 539, '1024x768': 383, '360x740': 196}
FAIXA = {'1440x900': (690, 860), '1024x768': (470, 600), '360x740': (0, 98)}
LADO = (380, 475)


BANDAS = {'1440x900': (698, 852), '1024x768': (478, 592), '360x740': (18, 96)}   # faixas com folga de 8 px


def _caixa(tela, cam, objs):
    c = comum.ler_camera_site(tela)['css']
    bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = c['w'], c['h']
    bpy.context.view_layer.update()
    return caixa_px(cam, objs)


def ajustar(raiz, objs, alvo_h, telas=None):
    """Escala até `alvo_h` da cabeça no 1440 e desloca a raiz em x até caber nas faixas de `telas` (todas se None;
    parte 2: só 1440 e 1024, decisão do orquestrador); se não houver x que sirva a todas, reduz a escala 7 % e tenta
    de novo. Devolve (escala, x) medidos."""
    bandas = {t: BANDAS[t] for t in (telas or BANDAS)}
    cams = {t: comum.camera_site(t, escala=1) for t in bandas}
    a = _caixa('1440x900', cams['1440x900'], objs)
    raiz.scale *= min(1.8, alvo_h * CABECA['1440x900'] / (a[3] - a[1]))
    for _ in range(24):
        a = {t: _caixa(t, c, objs) for t, c in cams.items()}
        raiz.location.x += 0.01
        b = {t: _caixa(t, c, objs) for t, c in cams.items()}
        raiz.location.x -= 0.01
        lo, hi = -1e9, 1e9
        for t, (b0, b1) in bandas.items():
            ppm = (b[t][0] - a[t][0]) / 0.01
            lo, hi = max(lo, (b0 - a[t][0]) / ppm), min(hi, (b1 - a[t][2]) / ppm)
        if lo <= hi:
            raiz.location.x += (lo + hi) / 2
            break
        raiz.scale *= 0.93
    for c in cams.values():
        bpy.data.objects.remove(c)
    bpy.context.view_layer.update()
    return round(raiz.scale.x, 3), round(raiz.location.x, 4)


def medir(feitos, malhas_b):
    med = {'busto': {}}
    for tela in comum.TELAS:
        cam = comum.camera_site(tela, escala=1)
        bpy.context.view_layer.update()
        W, H = bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y
        med['busto'][tela] = [round(v) for v in caixa_px(cam, malhas_b, 7)]
        for cid, f in feitos.items():
            x0, y0, x1, y1 = caixa_px(cam, f['objs'])
            fx0, fx1 = FAIXA[tela]
            ok = x0 >= max(fx0, 16) and x1 <= fx1 and y0 >= 16 and y1 <= H - 16
            if tela == '360x740':
                ok = ok and y0 >= 100 and y1 <= 350
            med.setdefault(cid, {'e': f['e'], 'tris': f['tris'], 'kB': f['kB'], 'glb': f['glb']})[tela] = {
                'caixa': [round(x0), round(y0), round(x1), round(y1)], 'h_px': round(y1 - y0),
                'h_cabeca': round((y1 - y0) / CABECA[tela], 2), 'na_faixa': ok}
        bpy.data.objects.remove(cam)
    return med


def rodar(feitos, pasta, nome_folha='folha-mostruario-e1e4.png'):
    pasta_abs = os.path.join(v6.ROOT, pasta)
    os.makedirs(pasta_abs, exist_ok=True)
    if bpy.context.scene.world is None:
        bpy.context.scene.world = bpy.data.worlds.new('Mundo')
    busto = [o for o in comum.importar_busto() if o.type == 'MESH']
    med = medir(feitos, busto)
    for cid, f in feitos.items():
        med[cid]['faixas_ajuste'] = list(f.get('telas') or comum.TELAS)
    arq_med = os.path.join(pasta_abs, 'medidas.json')
    todas = {}
    if os.path.exists(arq_med):                    # acrescenta: os candidatos de outras chamadas ficam
        with open(arq_med, encoding='utf-8') as fh:
            todas = json.load(fh)
    todas.update(med)
    with open(arq_med, 'w', encoding='utf-8') as fh:
        json.dump(todas, fh, ensure_ascii=False, indent=1)
    for cid, m in med.items():
        if cid != 'busto':
            print('MEDIDA', cid, m['tris'], 'tris', m['kB'], 'kB |',
                  ' | '.join('%s %s h%.2f %s' % (t, m[t]['caixa'], m[t]['h_cabeca'], 'ok' if m[t]['na_faixa']
                                                  else 'FORA') for t in comum.TELAS))
    # Argila na câmera do 1440, com o busto (a cabeça em escala ao lado).
    cam = comum.camera_site('1440x900', escala=1)
    bx = med['busto']['1440x900']
    for cid, f in feitos.items():
        arq = os.path.join(pasta_abs, 'argila-%s.png' % cid)
        comum.render_argila(arq, f['objs'] + busto)
        cx = med[cid]['1440x900']['caixa']
        x0, x1 = max(0, min(cx[0], bx[0]) - 30), min(1440, max(cx[2] + 30, cx[0] + 560))
        y0, y1 = max(0, min(cx[1], 40) - 20), min(900, max(cx[3], 700) + 20)
        subprocess.run(['convert', arq, '-crop', '%dx%d+%d+%d' % (x1 - x0, y1 - y0, x0, y0), '+repage',
                        '-resize', '%dx%d' % LADO, '-background', '#d8d8d8', '-gravity', 'center',
                        '-extent', '%dx%d' % LADO, arq], check=True)
    bpy.context.scene.camera = None
    local = cam.matrix_world.translation.copy()
    bpy.data.objects.remove(cam)
    # Material: um Cycles por vez, câmera na direção da do site, enquadrando a peça.
    v6.RENDERS, v6.TAG = pasta, 'mat'
    v6.studio()
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = LADO
    sc.cycles.samples = 64
    for cid, f in feitos.items():
        pts = [o.matrix_world @ Vector(c) for o in f['objs'] for c in o.bound_box]
        lo = Vector([min(p[i] for p in pts) for i in range(3)])
        hi = Vector([max(p[i] for p in pts) for i in range(3)])
        alvo, raio = (lo + hi) / 2, (hi - lo).length / 2
        d = (local - alvo).normalized()
        az, el = math.degrees(math.atan2(d.x, -d.y)), math.degrees(math.asin(d.z)) + 6
        v6.camera_on(alvo, raio / math.tan(math.radians(11.5)) * 1.12, az, el, lens=85)
        v6.only({o.name for o in f['objs']})
        v6.shoot(cid)
    folha(feitos, med, pasta_abs, nome_folha)


def folha(feitos, med, pasta_abs, nome='folha-mostruario-e1e4.png'):
    blocos = []
    for cid, f in feitos.items():
        m = med[cid]
        rot = '%s  %s   1440 h%.2f cab  |  %d tris  %.0f kB' % (f['e'], cid, m['1440x900']['h_cabeca'], m['tris'],
                                                                  m['kB'])
        telas = m['faixas_ajuste']
        fora = [t for t in telas if not m[t]['na_faixa']]
        rot += ('   FORA: ' + ','.join(fora)) if fora else '   faixa ok' + ('' if len(telas) == 3 else ' (1440+1024)')
        saida = os.path.join(pasta_abs, 'bloco-%s.png' % cid)
        subprocess.run(['convert', os.path.join(pasta_abs, 'mat-%s.png' % cid),
                        os.path.join(pasta_abs, 'argila-%s.png' % cid), '+append', '-background', '#141414',
                        '-gravity', 'north', '-splice', '0x30', '-gravity', 'northwest', '-fill', '#f0f0f0',
                        '-pointsize', '19', '-annotate', '+10+5', rot, saida], check=True)
        blocos.append(saida)
    arq = os.path.join(pasta_abs, nome)
    subprocess.run(['montage', *blocos, '-tile', '2x', '-geometry', '+6+6', '-background', '#0c0c0c', arq], check=True)
    print('FOLHA', arq)
