"""Provas da vida `fullstack` v1 (chamadas por prop_fullstack.py com provas=<pasta>): medidas.json + folha.

Medidas: respiro borda de cima da tampa × lábio inferior (px nas 3 telas), caixas e distância às bordas das partes
VISÍVEIS (Fade ≥ 0,05), tamanho em tela de cada adesivo (px CSS nas 3 telas) e em cm reais, adesivos inteiros na faixa
Fade = 1, folga notebook × busto S13 (neutro e boca aberta), triângulos/kB/chamadas (glb.mjs).
"""
import json
import os
import subprocess

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

import comum
import prop_financeiro_v6 as v6
import prop_fullstack_notebook as NB
import prop_vela_base as B


def malhas(objs):
    return {o.name: o for o in objs if o.type == 'MESH'}


def _fade(o):
    lay = o.data.uv_layers.get('Fade')
    f = [1.0] * len(o.data.vertices)
    for p in o.data.polygons:
        for li, vi in zip(p.loop_indices, p.vertices):
            f[vi] = lay.data[li].uv[0]
    return f


def _proj(cam, p, W, H):
    q = world_to_camera_view(bpy.context.scene, cam, p)
    return q.x * W, (1 - q.y) * H


def pontos_visiveis(ms):
    out = []
    for o in ms.values():
        f = _fade(o)
        mw = o.matrix_world
        out += [mw @ v.co for v in o.data.vertices if f[v.index] >= 0.05]
    return out


def pols_mundo(med):
    """Contornos dos adesivos (mm do scan no quadro `fs_adesivos`) → pontos do mundo do Blender."""
    M = NB.para_bl(NB.m_gl('adesivos'))
    return {s: [M @ (NB.C @ Vector((u / 1000, v / 1000, 0))) for u, v in pts]
            for s, pts in med['poligonos_mm_scan'].items()}


def por_tela(busto, ms, med):
    """Por tela: lábio, topo da tampa na faixa da boca, caixas, bordas, px de cada adesivo."""
    lab = busto.raio(Vector((0.0, 0.1, 0.084)), Vector((0, -1, 0)))[0]
    vis = pontos_visiveis(ms)
    boca = [p for p in vis if abs(p.x) <= 0.035]
    pols = pols_mundo(med)
    out = {}
    for tela in comum.TELAS:
        cam = comum.camera_site(tela, escala=1)
        bpy.context.view_layer.update()
        sc = bpy.context.scene
        W, H = sc.render.resolution_x, sc.render.resolution_y
        pr = [_proj(cam, p, W, H) for p in vis]
        xs, ys = [p[0] for p in pr], [p[1] for p in pr]
        yl = _proj(cam, lab, W, H)[1]
        yt = min(ys)                          # a borda de cima é reta e horizontal: sem vértices na faixa da boca
        yt_boca = min(_proj(cam, p, W, H)[1] for p in boca)
        from prop_financeiro_direita_prova import caixa_px
        cb = [round(v) for v in caixa_px(cam, [busto.pele], 7)]
        ad = {}
        for s, pts in pols.items():
            q = [_proj(cam, p, W, H) for p in pts]
            a = [p[0] for p in q]
            b = [p[1] for p in q]
            ad[s] = {'w': round(max(a) - min(a), 1), 'h': round(max(b) - min(b), 1),
                     'caixa': [round(min(a)), round(min(b)), round(max(a)), round(max(b))]}
        out[tela] = {'labio_px': round(yl, 1), 'topo_tampa_px': round(yt, 1), 'respiro_px': round(yt - yl, 1),
                     'topo_vertices_faixa_boca_px': round(yt_boca, 1),
                     'busto': cb, 'notebook_visivel': [round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys))],
                     'borda_visivel': {'baixo': round(H - max(ys), 1), 'esq': round(min(xs), 1),
                                       'dir': round(W - max(xs), 1)},
                     'adesivos_px': ad}
        bpy.data.objects.remove(cam)
    return out


def faixa(ms, fade_y):
    """Adesivos inteiros na faixa Fade = 1: y mínimo (glb) de cada um × início do degradê."""
    o = ms['fs_adesivos_malha']
    y = min((o.matrix_world @ v.co).z for v in o.data.vertices)
    t = ms['fs_notebook_tampa']
    ymax = max((t.matrix_world @ v.co).z for v in t.data.vertices)
    return {'y_min_adesivos_glb': round(y, 4), 'fade_1_acima_de_y': fade_y[1], 'inteiros': y >= fade_y[1],
            'topo_tampa_y_glb': round(ymax, 4)}


def folgas(busto, ms):
    """Distância mínima (cm do scan) de cada malha do notebook à pele do S13: dos vértices da pele (densos) ao ponto
    mais próximo da malha (BVH), porque a tampa tem faces grandes sem vértices no meio."""
    import bmesh
    from mathutils.bvhtree import BVHTree
    arv = {}
    for k, o in ms.items():
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.transform(o.matrix_world)
        arv[k] = BVHTree.FromBMesh(bm)
        bm.free()
    out = {}
    for nome, ch in (('neutro', {}), ('boca_aberta', {'jawOpen': 1.0})):
        busto.pose(**ch)
        pele = [v.co for v in busto.bm_pele.verts]
        out[nome] = {k: round(min(a.find_nearest(p)[3] for p in pele) * 100, 2) for k, a in arv.items()}
        out[nome + '_vertices_do_adereco'] = {k: round(B.folga(busto, [o], amostra=1)[0] * 100, 2)
                                              for k, o in ms.items()}
    busto.pose()
    print('FOLGA_BUSTO_CM', out)
    return out


def tamanhos(dados):
    return {d['slug']: {'nivel': d['nivel'], 'contraste_logo_fundo': d.get('contraste'),
                        'real_cm': [round(d['tam_mm'][0] / 10, 2), round(d['tam_mm'][1] / 10, 2)],
                        'scan_cm': [round(d['tam_mm'][0] * NB.ESC / 10, 2), round(d['tam_mm'][1] * NB.ESC / 10, 2)]}
            for d in dados['adesivos']}


def rodar(busto, objs, dados, med, pasta, glb, fade_y):
    pasta = os.path.join(v6.ROOT, pasta)
    os.makedirs(pasta, exist_ok=True)
    ms = malhas(objs)
    busto.pose()
    m = {'telas': por_tela(busto, ms, med), 'faixa_fade': faixa(ms, fade_y), 'adesivos_cm': tamanhos(dados),
         'sobreposicao_mm2_scan': med['sobreposicao_mm2_scan'], 'camadas': med['camada'],
         'folga_busto_cm': folgas(busto, ms),
         'abertura_graus': NB.ABERTURA, 'tampa_real_cm': [NB.W / NB.ESC * 100, NB.H / NB.ESC * 100]}
    txt = subprocess.run(['node', os.path.join(v6.ROOT, '3d/tools/props/glb.mjs'), glb], capture_output=True,
                         text=True).stdout
    m['glb'] = txt.splitlines()[0] if txt else 'não obtido'
    with open(os.path.join(pasta, 'medidas.json'), 'w', encoding='utf-8') as f:
        json.dump(m, f, ensure_ascii=False, indent=1)
    print('MEDIDAS', json.dumps({k: m[k] for k in ('faixa_fade', 'folga_busto_cm', 'glb')}, ensure_ascii=False))
    for t, v in m['telas'].items():
        print('TELA', t, v['respiro_px'], v['notebook_visivel'], v['borda_visivel'],
              {s: max(a['w'], a['h']) for s, a in v['adesivos_px'].items()})
    import prop_fullstack_prova_folha as folha
    folha.renders(busto, ms, pasta, m, rapido=bool(v6.ARGS.get('rapido')))
    return m
