"""Provas da vida `techlead` v1 (chamadas por prop_techlead.py com provas=<pasta>): medidas.json + folha de vistas.

Função primeiro (o que a daily cobra):
- folgas de cada malha à pele do S13 em TODAS as poses do busto (neutra, cada chave de sorriso e de sobrancelha em
  1,0 e o sorriso inteiro com mouthSmileFix), nos dois sentidos (vértices da peça → pele, com sinal; pele perto da
  peça → malha da peça);
- boca na câmera do site (1440×900, 1024×768, 360×740, px CSS): polígono dos lábios (vértices de cor de lábio na caixa
  da boca, na pose) × silhueta de todo o headset: px sobre a boca e distância mínima em px;
- cabo visível na câmera do site (silhueta com o busto na frente);
- orçamento pelo glb.mjs.
"""
import json
import os
import subprocess

import bmesh
import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import comum
import prop_financeiro_v6 as v6
import prop_techlead_geo as G

POSES = (('neutra', {}), ('sorriso', {'mouthSmileLeft': 1, 'mouthSmileRight': 1, 'mouthSmileFix': 1}),
         ('sorriso_E', {'mouthSmileLeft': 1}), ('sorriso_D', {'mouthSmileRight': 1}),
         ('browInnerUp', {'browInnerUp': 1}),
         ('browOuterUpLeft', {'browOuterUpLeft': 1}), ('browOuterUpRight', {'browOuterUpRight': 1}),
         ('browDownLeft', {'browDownLeft': 1}), ('browDownRight', {'browDownRight': 1}))


def _pontos(o):
    mw = o.matrix_world
    return [mw @ v.co for v in o.data.vertices]


def _bvh(o):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.transform(o.matrix_world)
    t = BVHTree.FromBMesh(bm)
    bm.free()
    return t


def folgas(ctx):
    """mm: por pose e malha, mínima com sinal (vértice → pele), mínima da pele à malha, nº de vértices dentro e
    penetração máxima."""
    busto, ms = ctx['busto'], ctx['malhas']
    pts = {k: _pontos(o) for k, o in ms.items()}
    arv = {k: _bvh(o) for k, o in ms.items()}
    caixa = {k: (np.min(np.array(p), 0) - 0.03, np.max(np.array(p), 0) + 0.03) for k, p in pts.items()}
    out = {}
    for nome, ch in POSES:
        busto.pose(**ch)
        pele = np.array([tuple(v.co) for v in busto.bm_pele.verts])
        r = {}
        for k in ms:
            d = [busto.perto(p)[2] for p in pts[k]]
            lo, hi = caixa[k]
            perto = pele[np.all((pele > lo) & (pele < hi), 1)]
            inv = min((arv[k].find_nearest(Vector(p))[3] for p in perto), default=9.0)
            r[k] = {'min_mm': round(min(d) * 1000, 2), 'pele_a_malha_mm': round(inv * 1000, 2),
                    'dentro': int(sum(x < 0 for x in d)), 'penetracao_max_mm': round(max(0.0, -min(d)) * 1000, 2)}
        out[nome] = r
        print('FOLGA', nome, {k: (v['min_mm'], v['pele_a_malha_mm']) for k, v in r.items()})
    busto.pose()
    return out


def cor_pele(busto):
    """Cor da textura por vértice da pele (sRGB 0..1)."""
    o = busto.pele
    img = next(n.image for n in o.active_material.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image)
    W, H = img.size
    px = np.array(img.pixels[:]).reshape(H, W, 4)
    uvl = o.data.uv_layers.active.data
    cor = np.zeros((len(o.data.vertices), 3))
    for p in o.data.polygons:
        for li, vi in zip(p.loop_indices, p.vertices):
            u, v = uvl[li].uv
            cor[vi] = px[min(H - 1, int(v * H)), min(W - 1, int(u * W)), :3]
    return cor


def labios(busto):
    """Índices dos vértices de lábio: caixa da boca (|x| < 0,040; y 0,078–0,100; frente) e cor de lábio (medido na
    textura: lábios avermelhados, barba e bigode escuros)."""
    cor = cor_pele(busto)
    lum = cor @ np.array([0.2126, 0.7152, 0.0722])
    red = cor[:, 0] - cor[:, 2]
    mw = busto.pele.matrix_world
    g = np.array([tuple(G.gl(mw @ v.co)) for v in busto.pele.data.vertices])
    m = (np.abs(g[:, 0]) < 0.040) & (g[:, 1] > 0.078) & (g[:, 1] < 0.100) & (g[:, 2] > -0.004)
    return np.nonzero(m & (red > 0.10) & (lum > 0.13))[0], g


def _casco(P):
    P = sorted(map(tuple, P))
    if len(P) < 3:
        return np.array(P)

    def cruz(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in P:
        while len(lo) >= 2 and cruz(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(P):
        while len(hi) >= 2 and cruz(hi[-2], hi[-1], p) <= 0:
            hi.pop()
        hi.append(p)
    return np.array(lo[:-1] + hi[:-1])


def _dist_poligono(Q, poly):
    """Distância (px) de cada ponto Q ao polígono convexo anti-horário (0 dentro)."""
    dmin = np.full(len(Q), np.inf)
    dentro = np.ones(len(Q), bool)
    for a, b in zip(poly, np.roll(poly, -1, 0)):
        e = b - a
        w = Q - a
        dentro &= (e[0] * w[:, 1] - e[1] * w[:, 0]) >= 0
        t = np.clip((w @ e) / (e @ e), 0, 1)
        dmin = np.minimum(dmin, np.linalg.norm(w - np.outer(t, e), axis=1))
    return np.where(dentro, 0.0, dmin)


def _mascara(arq):
    img = bpy.data.images.load(arq, check_existing=False)
    W, H = img.size
    a = np.array(img.pixels[:]).reshape(H, W, 4)[::-1, :, 0]
    bpy.data.images.remove(img)
    return a < 0.5


def boca(ctx, pasta):
    """px CSS por tela: headset × polígono dos lábios (neutra e sorriso inteiro) e cabo visível."""
    busto, ms = ctx['busto'], ctx['malhas']
    idx, _ = labios(busto)
    sc = bpy.context.scene
    pele = list(busto.malhas.values())
    out = {}
    for tela in comum.TELAS:
        cam = comum.camera_site(tela, escala=1)
        bpy.context.view_layer.update()
        W, H = sc.render.resolution_x, sc.render.resolution_y
        arq = os.path.join(pasta, '_sil_%s.png' % tela)
        comum.render_silhueta(arq, list(ms.values()))
        mask = _mascara(arq)
        comum.render_silhueta(arq, [ms['tl_cabo']], pele)
        cabo_px = int(_mascara(arq).sum())
        comum.render_silhueta(arq, [ms['tl_mic']])
        mic_mask = _mascara(arq)
        os.remove(arq)
        t = {'cabo_visivel_px': cabo_px}
        for nome, ch in POSES[:2]:
            busto.pose(**ch)
            vs = busto.bm_pele.verts
            vs.ensure_lookup_table()
            pr = []
            for i in idx:
                q = world_to_camera_view(sc, cam, vs[int(i)].co)
                pr.append((q.x * W, (1 - q.y) * H))
            poly = _casco(np.array(pr))
            ys, xs = np.nonzero(mask)
            d = _dist_poligono(np.stack([xs + 0.5, ys + 0.5], 1).astype(float), poly)
            ym, xm = np.nonzero(mic_mask)
            dm = _dist_poligono(np.stack([xm + 0.5, ym + 0.5], 1).astype(float), poly)
            t[nome] = {'px_sobre_boca': int((d == 0).sum()), 'dist_min_headset_px': round(float(d.min()), 1),
                       'dist_min_capsula_px': round(float(dm.min()), 1),
                       'boca_px': [round(float(v), 1) for v in (*poly.min(0), *poly.max(0))],
                       'capsula_px': [int(xm.min()), int(ym.min()), int(xm.max()), int(ym.max())],
                       'poligono': [[round(float(a), 1), round(float(b), 1)] for a, b in poly]}
        busto.pose()
        out[tela] = t
        print('BOCA', tela, t)
        bpy.data.objects.remove(cam)
    return out


def geometria(ctx):
    idx, g = labios(ctx['busto'])
    km = ctx['mic']
    frente_labios = float(g[idx, 2].max())
    q = ctx['q']
    return {'labios_z_max_glb': round(frente_labios, 4),
            'capsula_centro_glb': [round(float(v), 4) for v in km['centro']],
            'capsula_a_frente_do_plano_dos_labios_mm': round((float(km['centro'][2]) - frente_labios) * 1000, 1),
            'conchas': {('D' if s < 0 else 'E'): {'pele_glb': [round(float(v), 4) for v in q[s]['c_pele']],
                                                  'eixo_glb': [round(float(v), 3) for v in q[s]['n']],
                                                  'inclinacao_graus': round(q[s]['ang_graus'], 1),
                                                  'compressao_espuma_mm': ctx['conchas'][s]['compressao_mm']}
                        for s in (-1, 1)},
            **ctx['rel']}


def rodar(ctx, pasta, glb):
    pasta = os.path.join(v6.ROOT, pasta)
    os.makedirs(pasta, exist_ok=True)
    m = {'folga_mm': folgas(ctx), 'boca_px': boca(ctx, pasta), 'geometria': geometria(ctx)}
    txt = subprocess.run(['node', os.path.join(v6.ROOT, '3d/tools/props/glb.mjs'), glb], capture_output=True,
                         text=True).stdout
    m['glb'] = txt.splitlines()[0] if txt else 'não obtido'
    with open(os.path.join(pasta, 'medidas.json'), 'w', encoding='utf-8') as f:
        json.dump(m, f, ensure_ascii=False, indent=1)
    print('MEDIDAS', json.dumps(m['geometria'], ensure_ascii=False), m['glb'])
    if v6.ARGS.get('folha', '1') != '0':
        import prop_techlead_prova_folha as folha
        folha.renders(ctx, pasta, m)
    return m
