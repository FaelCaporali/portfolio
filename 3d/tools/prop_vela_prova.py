"""Provas da vela v1 (ficha "Provas" 1 e 2), chamadas por prop_vela.py com provas=<pasta>.

Medidas (medidas.json): folga/interpenetração boné e óculos × pele (e olhos) no neutro, em mouthSmile 1 (+Fix) e no
piscar; pele atravessando a copa (raio do centro do crânio); vão da faixa; caixas em px CSS nas 3 telas pela câmera do
site; contraste íris × esclera pela lente (Cycles, 1440 recortado); estouro do boné (≥ 250); sombra de contato na testa.
Folha ≤ 1568 px: argila e material na câmera do 1440, recortes 2× do rosto (neutro, sorriso, piscar, 3 olhares), barcos.
"""
import json
import math
import os
import subprocess

import bpy
import numpy as np
from mathutils import Euler, Vector
from mathutils.bvhtree import BVHTree

import comum
import prop_financeiro_v6 as v6
import prop_vela_base as B
from prop_financeiro_direita_prova import caixa_px

SMILE = dict(mouthSmileLeft=1, mouthSmileRight=1, mouthSmileFix=1)
BLINK = dict(eyeBlinkLeft=1, eyeBlinkRight=1)
POSES = {'neutro': {}, 'sorriso': SMILE, 'piscar': BLINK}
OLHAR = {'olhar_esq': (0, 18), 'olhar_dir': (0, -18), 'olhar_cima': (-12, 0)}
OLHOS = ('Olho_D_malha', 'Olho_E_malha', 'Conj_D_malha', 'Conj_E_malha')
K = 2                                                    # recorte do rosto em 2×


def grupos(objs):
    g = {}
    for o in objs:
        if o.type != 'MESH':
            continue
        p = o
        while p.parent is not None and p.parent.name != 'vela':
            p = p.parent
        g.setdefault(p.name, []).append(o)
    return g


def atravessa_copa(busto, cap, centro):
    """Vértices da pele fora da casca do boné (dentro da projeção da copa): raio do centro para o vértice."""
    dg = bpy.context.evaluated_depsgraph_get()
    import bmesh
    bm = bmesh.new()
    for o in cap:
        bm.from_object(o, dg)
    bm.transform(cap[0].matrix_world)
    arv = BVHTree.FromBMesh(bm)
    from prop_vela_bone import z_faixa
    n = 0
    pior = 0.0
    for v in busto.bm_pele.verts:
        if v.co.z < z_faixa(v.co.y, v.co.x) + 0.002:              # só a pele sob a copa (acima da faixa)
            continue
        d = v.co - centro
        if d.length < 1e-6:
            continue
        h = arv.ray_cast(centro, d.normalized(), 0.4)
        if h[0] is not None and h[3] < d.length:
            n += 1
            if d.length - h[3] > pior:
                pior, onde = d.length - h[3], tuple(round(c, 3) for c in v.co)
    if n:
        print('ATRAVESSA pior em (Blender)', onde)
    bm.free()
    return n, pior


def folgas(busto, g):
    from prop_vela_bone import C as CENTRO
    out = {}
    for nome, chaves in POSES.items():
        busto.pose(**chaves)
        cap, ocl = g['vela_bone'], g['vela_oculos']
        dmin_c, dentro_c = B.folga(busto, cap)
        n_at, pior = atravessa_copa(busto, cap, CENTRO)
        dmin_o, dentro_o = B.folga(busto, ocl)
        dmin_l, dentro_l = B.folga(busto, [o for o in ocl if 'lente' in o.name], nomes=(B.PELE,) + OLHOS)
        out[nome] = {'bone_folga_min_mm': round(dmin_c * 1000, 2), 'bone_vertices_dentro': dentro_c,
                     'pele_atravessa_copa_vertices': n_at, 'pele_atravessa_copa_mm': round(pior * 1000, 2),
                     'oculos_folga_min_mm': round(dmin_o * 1000, 2), 'oculos_vertices_dentro': dentro_o,
                     'lente_folga_min_mm(pele+olho)': round(dmin_l * 1000, 2), 'lente_vertices_dentro': dentro_l}
        print('FOLGA', nome, out[nome])
    busto.pose()
    return out


def visivel(busto, g, tela='1440x900'):
    """Fração dos vértices de cada grupo que a câmera do site vê (raio até a câmera sem bater na pele do busto)."""
    cam = comum.camera_site(tela, escala=1)
    bpy.context.view_layer.update()
    olho_cam = cam.matrix_world.translation
    arv = busto.arvores[B.PELE]
    out = {}
    for nome, objs in g.items():
        n = vis = 0
        for o in objs:
            for i in range(0, len(o.data.vertices), 3):
                p = o.matrix_world @ o.data.vertices[i].co
                d = olho_cam - p
                h = arv.ray_cast(p + d.normalized() * 1e-4, d.normalized(), d.length)
                n += 1
                vis += h[0] is None
        out[nome] = round(vis / max(n, 1), 3)
    bpy.data.objects.remove(cam)
    print('VISIVEL', out)
    return out


def caixas(g, busto_malhas):
    med = {}
    for tela in comum.TELAS:
        cam = comum.camera_site(tela, escala=1)
        bpy.context.view_layer.update()
        med[tela] = {'busto': [round(v) for v in caixa_px(cam, busto_malhas, 7)]}
        for nome, objs in g.items():
            med[tela][nome] = [round(v) for v in caixa_px(cam, objs)]
        bpy.data.objects.remove(cam)
    return med


def _lum(arq):
    img = bpy.data.images.load(arq, check_existing=False)
    w, h = img.size
    a = np.array(img.pixels[:]).reshape(h, w, 4)[::-1, :, :3]
    bpy.data.images.remove(img)
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def olhar(ang):
    for n in ('Olho_D', 'Olho_E'):
        o = bpy.data.objects.get(n)
        if o is not None:
            if 'rot0' not in o:
                o['rot0'] = list(o.rotation_euler)
            r0 = Euler(o['rot0'])
            o.rotation_euler = (r0.x + math.radians(ang[0]), r0.y, r0.z + math.radians(ang[1]))


def render_cycles(arq, visiveis, borda):
    sc = bpy.context.scene
    sc.render.use_border, sc.render.use_crop_to_border = True, True
    sc.render.border_min_x, sc.render.border_max_x, sc.render.border_min_y, sc.render.border_max_y = borda
    v6.only({o.name for o in visiveis})
    sc.render.filepath = arq
    bpy.ops.render.render(write_still=True)
    sc.render.use_border = False
    return arq


def rodar(busto, objs, pasta):
    pasta = os.path.join(v6.ROOT, pasta)
    os.makedirs(pasta, exist_ok=True)
    g = grupos(objs)
    pele = list(busto.malhas.values())
    med = {'folgas': folgas(busto, g), 'caixas_px': caixas(g, [busto.pele])}
    med['visivel_1440'] = visivel(busto, g)
    pecas = [o for v in g.values() for o in v]
    # ---- argila na câmera do 1440 (Workbench), inteira e recorte do rosto
    cam = comum.camera_site('1440x900', escala=1)
    comum.render_argila(os.path.join(pasta, 'argila-1440.png'), pecas + pele)
    cab = med['caixas_px']['1440x900']['busto']
    bpy.data.objects.remove(cam)
    import prop_vela_prova_olho as olho
    med['contraste'] = olho.medir(busto, g['vela_oculos'], pasta)
    # ---- material (Cycles, estúdio com as direções da luz do site), rosto recortado 2×
    cam = comum.camera_site('1440x900', escala=K)
    olho.estudio()
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 1440 * K, 900 * K    # o estúdio pôs 900 × 900
    sc.cycles.samples = 48
    x0, x1 = (cab[0] - 20) / 1440, (cab[2] + 20) / 1440
    y0, y1 = 1 - (cab[1] + 380) / 900, 1 - (cab[1] - 30) / 900
    borda_rosto = (max(0, x0), min(1, x1), max(0, y0), min(1, y1))
    rostos = []
    for nome, chaves in list(POSES.items()) + [(k, {}) for k in OLHAR]:
        busto.pose(**chaves)
        olhar(OLHAR.get(nome, (0, 0)))
        rostos.append(render_cycles(os.path.join(pasta, 'rosto-%s.png' % nome), pele + g['vela_bone'] +
                                    g['vela_oculos'], borda_rosto))
    olhar((0, 0))
    busto.pose()
    render_cycles(os.path.join(pasta, 'rosto-sem.png'), pele, borda_rosto)
    sc.render.use_border = False
    render_cycles(os.path.join(pasta, 'material-1440.png'), pecas + pele, (0, 1, 0, 1))
    med['estouro_bone'], med['sombra_testa'] = estouro_sombra(pasta, borda_rosto, g, cam)
    med['apito'] = olho.apito(pasta, g, pele)
    print('APITO_PX', med['apito'])
    olho.estudio()
    # ---- barcos isolados de 3/4 (câmera própria, sem o deslocamento de lente da câmera do site)
    sc.camera = None
    for nome in ('vela_laser', 'vela_optimist'):
        pts = [o.matrix_world @ Vector(c) for o in g[nome] for c in o.bound_box]
        lo = Vector([min(p[i] for p in pts) for i in range(3)])
        hi = Vector([max(p[i] for p in pts) for i in range(3)])
        sc.render.resolution_x, sc.render.resolution_y = 400, 470
        v6.only({o.name for o in g[nome]})
        for vista, az, el in (('34', -35, 12), ('popa', 150, 14), ('baixo', 70, -28)):   # a volta mostra todos
            v6.camera_on((lo + hi) / 2, (hi - lo).length * 3.0, az, el, lens=85)
            sc.render.filepath = os.path.join(pasta, 'barco-%s-%s.png' % (nome, vista))
            bpy.ops.render.render(write_still=True)
    with open(os.path.join(pasta, 'medidas.json'), 'w', encoding='utf-8') as f:
        json.dump(med, f, ensure_ascii=False, indent=1)
    folha(pasta, med)
    return med


def estouro_sombra(pasta, borda, g, cam):
    """Estouro: fração dos pixels do boné (máscara por projeção) com algum canal ≥ 250. Sombra: luminância média de uma
    faixa da testa sob a aba, com e sem boné."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    img = bpy.data.images.load(os.path.join(pasta, 'rosto-neutro.png'), check_existing=False)
    w, h = img.size
    a = np.array(img.pixels[:]).reshape(h, w, 4)[::-1, :, :3]
    bpy.data.images.remove(img)
    sem = _lum(os.path.join(pasta, 'rosto-sem.png'))
    com = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    W, H = 1440 * K, 900 * K
    xa, ya = borda[0] * W, (1 - borda[3]) * H

    def px(p):
        q = world_to_camera_view(sc, cam, Vector(p))
        return int(q.x * W - xa), int((1 - q.y) * H - ya)
    pts = [px(o.matrix_world @ o.data.vertices[i].co) for o in g['vela_bone']
           for i in range(0, len(o.data.vertices), 5)]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    reg = a[max(0, min(ys)):max(ys), max(0, min(xs)):max(xs)]
    difer = np.abs(com - sem)[max(0, min(ys)):max(ys), max(0, min(xs)):max(xs)] > 0.02
    estouro = float((reg.max(2) >= 250 / 255)[difer].mean()) if difer.any() else None
    fa, fb = px((-0.025, -0.012, 0.236)), px((0.025, -0.012, 0.226))
    fx0, fx1 = sorted((fa[0], fb[0]))
    fy0, fy1 = sorted((fa[1], fb[1]))
    s_com, s_sem = com[fy0:fy1 + 1, fx0:fx1 + 1].mean(), sem[fy0:fy1 + 1, fx0:fx1 + 1].mean()
    sombra = {'lum_com': round(float(s_com), 4), 'lum_sem': round(float(s_sem), 4),
              'queda': round(float(1 - s_com / s_sem), 3), 'faixa_px': [fx0, fy0, fx1, fy1]}
    print('ESTOURO', estouro, 'SOMBRA', sombra)
    return estouro, sombra


def folha(pasta, med):
    j = lambda n: os.path.join(pasta, n)                         # noqa: E731
    rot = ['rosto-%s.png' % n for n in ['sem'] + list(POSES) + list(OLHAR)]
    subprocess.run(['montage', *[j(r) for r in rot], '-tile', '7x1', '-geometry', '220x+2+2', '-background', '#111',
                    j('_rostos.png')], check=True)
    subprocess.run(['convert', j('material-1440.png'), '-resize', '780x', j('argila-1440.png'), '-resize', '780x',
                    '+append', j('_topo.png')], check=True)
    barcos = [j('barco-%s-%s.png' % (n, v)) for n in ('vela_laser', 'vela_optimist') for v in ('34', 'popa', 'baixo')]
    subprocess.run(['montage', *barcos, '-tile', '6x1', '-geometry', '255x+2+2', '-background', '#111',
                    j('_barcos.png')], check=True)
    subprocess.run(['montage', j('apito-silhueta-1440.png'), j('apito-material-4x.png'), '-tile', '2x1', '-geometry',
                    'x420+2+2', '-background', '#111', j('_apito.png')], check=True)
    f = med['folgas']
    txt = 'folga min mm (neutro/sorriso/piscar): bone %s | oculos %s | lente %s   contraste iris %s' % (
        [f[p]['bone_folga_min_mm'] for p in POSES], [f[p]['oculos_folga_min_mm'] for p in POSES],
        [f[p]['lente_folga_min_mm(pele+olho)'] for p in POSES],
        [med['contraste'][t]['razao'] for t in med['contraste']])
    subprocess.run(['convert', j('_topo.png'), j('_rostos.png'), j('_barcos.png'), j('_apito.png'), '-background',
                    '#111', '-gravity',
                    'center', '-append', '-resize', '1560x>', '-gravity', 'north', '-splice', '0x28', '-fill', '#eee',
                    '-pointsize', '17', '-annotate', '+0+5', txt, j('folha-v1.png')], check=True)
    print('FOLHA', j('folha-v1.png'))
