"""Prova do leque de cartões (E8, volta 2): constrói pelo registro de prop_empreendedor.py (id `cartoes`), ajusta à
vitrine (faixas do 1440 e do 1024), exporta `3d/export/props/lab/emp_cartoes.glb`, mede nas 3 telas (acrescenta ao
medidas.json da v1) e monta UMA folha ≤ 1568 px:
  material (Cycles, luz do estúdio da v6 = direções do site) · pixels REAIS do 1440 ampliados 3× (legibilidade) ·
  argila com a cabeça em escala (câmera do site) · atlas das 5 faces (a arte-rascunho inteira).

    blender -b --python 3d/tools/prop_empreendedor_cartoes_prova.py -- so=cartoes [giro=1.0] [rapido=1]
"""
import json
import math
import os
import subprocess
import sys

import bpy
from mathutils import Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [AQUI, os.path.join(AQUI, 'props')]
import prop_empreendedor as E  # noqa: E402
import comum  # noqa: E402
import prop_empreendedor_prova as prova  # noqa: E402
import prop_financeiro_v6 as v6  # noqa: E402
from prop_financeiro_direita_prova import caixa_px  # noqa: E402

PASTA = os.path.join(v6.ROOT, '3d/captura/props/empreendedor/v2/cartoes')
MEDIDAS = os.path.join(v6.ROOT, '3d/captura/props/empreendedor/v1/mostruario/medidas.json')


def construir():
    v6.reset()
    e, fn, raiz_gl, giro, alvo = E.CANDIDATOS['cartoes']
    giro = float(E.ARGS.get('giro', giro))
    E.CANDIDATOS['cartoes'] = (e, fn, raiz_gl, giro, alvo)
    raiz, objs = E.construir('cartoes')
    escala, x = prova.ajustar(raiz, objs, alvo, E.SO_DESKTOP.get('cartoes'))
    arq = os.path.join(E.PASTA_GLB, 'emp_cartoes.glb')
    comum.exportar_glb([raiz] + objs, arq, draco=False)
    print('AJUSTE cartoes escala', escala, 'raiz_gl', (x, *raiz_gl[1:]), 'giro', giro)
    return {'e': e, 'raiz': raiz, 'escala': escala, 'x': x, 'objs': objs, 'telas': E.SO_DESKTOP['cartoes'],
            'glb': os.path.relpath(arq, v6.ROOT), 'kB': round(os.path.getsize(arq) / 1024, 1), 'tris': E.tris(objs),
            'giro': giro}


def medir(f, busto):
    med = prova.medir({'cartoes': f}, busto)
    m = med['cartoes']
    m.update(faixas_ajuste=list(f['telas']), escala=f['escala'], raiz_gl_x=f['x'], giro=f['giro'], volta=2)
    print('MEDIDA cartoes', m['tris'], 'tris', m['kB'], 'kB |', ' | '.join(
        '%s %s h%.2f %s' % (t, m[t]['caixa'], m[t]['h_cabeca'], 'ok' if m[t]['na_faixa'] else 'FORA')
        for t in comum.TELAS))
    return med


def gravar(med):
    todas = {}
    if os.path.exists(MEDIDAS):
        with open(MEDIDAS, encoding='utf-8') as fh:
            todas = json.load(fh)
    todas['cartoes'] = med['cartoes']
    with open(MEDIDAS, 'w', encoding='utf-8') as fh:
        json.dump(todas, fh, ensure_ascii=False, indent=1)


def im(*args):
    subprocess.run(['convert', *args], check=True)


def renders(f, med, busto):
    sc = bpy.context.scene
    cx = med['cartoes']['1440x900']['caixa']
    bx = med['busto']['1440x900']
    # 1. Argila com o busto, câmera do 1440.
    cam = comum.camera_site('1440x900', escala=1)
    sc.camera = cam
    arg = os.path.join(PASTA, 'argila-cartoes.png')
    comum.render_argila(arg, f['objs'] + busto)
    x0, x1 = max(0, min(cx[0], bx[0]) - 30), min(1440, max(cx[2], bx[2]) + 30)
    y0, y1 = max(0, min(cx[1], bx[1]) - 20), min(900, max(cx[3], bx[3]) + 20)
    im(arg, '-crop', '%dx%d+%d+%d' % (x1 - x0, y1 - y0, x0, y0), '+repage', '-resize', 'x560', arg)
    # 2. Material no 1440, câmera do site, só a região do leque: os pixels que o site mostra, ampliados 3×.
    v6.studio()
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 1440, 900
    sc.cycles.samples = 96
    m = 14
    sc.render.use_border, sc.render.use_crop_to_border = True, True
    sc.render.border_min_x, sc.render.border_max_x = (cx[0] - m) / 1440, (cx[2] + m) / 1440
    sc.render.border_min_y, sc.render.border_max_y = 1 - (cx[3] + m) / 900, 1 - (cx[1] - m) / 900
    v6.only({o.name for o in f['objs']})
    site = os.path.join(PASTA, 'site1440-cartoes.png')
    sc.render.filepath = site
    bpy.ops.render.render(write_still=True)
    im(site, '-scale', '300%', site)
    sc.render.use_border = False
    # 3. Material de perto, na direção da câmera do site.
    local = cam.matrix_world.translation.copy()
    pts = [o.matrix_world @ Vector(c) for o in f['objs'] for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    alvo, raio = (lo + hi) / 2, (hi - lo).length / 2
    d = (local - alvo).normalized()
    sc.camera = None
    sc.render.resolution_x, sc.render.resolution_y = 560, 560
    v6.RENDERS, v6.TAG = os.path.relpath(PASTA, v6.ROOT), 'mat'
    v6.camera_on(alvo, raio / math.tan(math.radians(11.5)) * 0.8, math.degrees(math.atan2(d.x, -d.y)),
                 math.degrees(math.asin(d.z)) + 4, lens=85)
    v6.shoot('cartoes')
    return os.path.join(PASTA, 'mat-cartoes.png'), site, arg


def folha(f, med, mat, site, arg):
    m = med['cartoes']

    def rot(arq, txt, saida):
        im(arq, '-background', '#141414', '-gravity', 'north', '-splice', '0x28', '-gravity', 'northwest',
           '-fill', '#f0f0f0', '-pointsize', '17', '-annotate', '+8+5', txt, saida)
        return saida

    t = [rot(mat, 'E8 material (luz do estudio v6)', os.path.join(PASTA, 't1.png')),
         rot(site, 'E8 legibilidade: pixels reais do 1440, 3x', os.path.join(PASTA, 't2.png')),
         rot(arg, 'argila + cabeca em escala (1440)', os.path.join(PASTA, 't3.png'))]
    linha1 = os.path.join(PASTA, 'l1.png')
    subprocess.run(['montage', *t, '-tile', '3x', '-geometry', '+5+5', '-background', '#0c0c0c', linha1], check=True)
    atl = os.path.join(PASTA, 't4.png')
    im(os.path.join(PASTA, 'atlas-cartoes.jpg'), '-crop', '1024x864+0+0', '-resize', '1024x', atl)
    txt = 'E8 faces (atlas rascunho, UV contrato no modulo)  |  %d tris  %.1f kB  |  %s' % (m['tris'], m['kB'], '  '.join(
        '%s h%.2f cab %s' % (x.split('x')[0], m[x]['h_cabeca'], 'ok' if m[x]['na_faixa'] else 'FORA')
        for x in comum.TELAS))
    rot(atl, txt, atl)
    arq = os.path.join(PASTA, 'folha-cartoes.png')
    im(linha1, atl, '-background', '#0c0c0c', '-gravity', 'center', '-append', '-resize', '1568x>', arq)
    for x in t + [linha1, atl]:
        os.remove(x)
    print('FOLHA', arq)


def main():
    os.makedirs(PASTA, exist_ok=True)
    f = construir()
    if bpy.context.scene.world is None:
        bpy.context.scene.world = bpy.data.worlds.new('Mundo')
    busto = [o for o in comum.importar_busto() if o.type == 'MESH']
    med = medir(f, busto)
    if E.ARGS.get('rapido'):
        return
    gravar(med)
    folha(f, med, *renders(f, med, busto))


main()
