"""Provas da vida `devops` v1 (chamadas por prop_devops.py com provas=<pasta>): medidas.json + folha de vistas.

Medidas: respiro borda de cima × lábio inferior (px nas 3 telas), caixa e bordas das partes VISÍVEIS (Fade ≥ 0,05),
folha na tela (cantos, px, inteira ou não) na escala do glb e na escala 0,8 do grupo (a do FullStack, em volta da
origem), folga prancheta × busto S13 (neutro e sorriso), inclinação, tamanhos, triângulos/kB/chamadas (glb.mjs).
"""
import json
import os
import subprocess

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import comum
import prop_devops_prancheta as P
import prop_financeiro_v6 as v6
import prop_vela_base as B

ESCALAS = (1.0, 0.8)


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


def _escalar(p, s):
    """Ponto do mundo do Blender com o grupo escalado `s` em volta da origem da prancheta."""
    o = Vector(comum.gl_para_bl(P.origem()))
    return o + (p - o) * s


def visiveis(ms):
    out = []
    for o in ms.values():
        f = _fade(o)
        out += [o.matrix_world @ v.co for v in o.data.vertices if f[v.index] >= 0.05]
    return out


def cantos_folha():
    Wf, Hf = P.R(P.FOLHA_MM[0]), P.R(P.FOLHA_MM[1])
    return [Vector(comum.gl_para_bl(P.glb((x, y, 0)))) for x in (-Wf / 2, Wf / 2) for y in (0, -Hf)]


def por_tela(busto, ms):
    lab = busto.raio(Vector((0.0, 0.1, 0.084)), Vector((0, -1, 0)))[0]
    vis = visiveis(ms)
    out = {}
    for tela in comum.TELAS:
        cam = comum.camera_site(tela, escala=1)
        bpy.context.view_layer.update()
        sc = bpy.context.scene
        W, H = sc.render.resolution_x, sc.render.resolution_y
        yl = _proj(cam, lab, W, H)[1]
        from prop_financeiro_direita_prova import caixa_px
        t = {'labio_px': round(yl, 1), 'busto': [round(v) for v in caixa_px(cam, [busto.pele], 7)]}
        for s in ESCALAS:
            pr = [_proj(cam, _escalar(p, s), W, H) for p in vis]
            xs, ys = [p[0] for p in pr], [p[1] for p in pr]
            fo = [_proj(cam, _escalar(p, s), W, H) for p in cantos_folha()]
            fy = [p[1] for p in fo]
            fx = [p[0] for p in fo]
            t['escala_%.1f' % s] = {
                'topo_px': round(min(ys), 1), 'respiro_px': round(min(ys) - yl, 1),
                'visivel': [round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys))],
                'bordas': {'esq': round(min(xs), 1), 'dir': round(W - max(xs), 1), 'baixo': round(H - max(ys), 1)},
                'folha': [round(min(fx)), round(min(fy)), round(max(fx)), round(max(fy))],
                'folha_px_larg_alt': [round(max(fx) - min(fx)), round(max(fy) - min(fy))],
                'folha_inteira_na_tela': max(fy) <= H and min(fx) >= 0 and max(fx) <= W,
                'folha_margem_baixo_px': round(H - max(fy), 1)}
        out[tela] = t
        bpy.data.objects.remove(cam)
    return out


def folgas(busto, ms):
    """Distância mínima (cm do scan) de cada malha à pele do S13, nos dois sentidos (pele → malha pelo BVH da malha,
    que tem faces grandes; vértices da malha → pele), neutro e sorriso."""
    arv = {}
    for k, o in ms.items():
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.transform(o.matrix_world)
        arv[k] = BVHTree.FromBMesh(bm)
        bm.free()
    out = {}
    # o S13 não tem jawOpen (chaves de boca: mouthSmileLeft/Right/Fix): a pose deformada da boca é o sorriso
    for nome, ch in (('neutro', {}), ('sorriso', {'mouthSmileLeft': 1.0, 'mouthSmileRight': 1.0})):
        busto.pose(**ch)
        pele = [v.co for v in busto.bm_pele.verts]
        out[nome] = {k: round(min(a.find_nearest(p)[3] for p in pele) * 100, 2) for k, a in arv.items()}
        out[nome + '_vertices'] = {k: round(B.folga(busto, [o], amostra=1)[0] * 100, 2) for k, o in ms.items()}
    busto.pose()
    return out


def geometria():
    Wt, Ht, Tt = P.TAMPO_MM
    topo = P.glb((0, P.R(P.TOPO_MM), P.z_madeira()))
    return {'inclinacao_graus': P.INCL, 'folha_mm_real': list(P.FOLHA_MM), 'tampo_mm_real': list(P.TAMPO_MM),
            'folha_scan_m': [round(P.R(v), 4) for v in P.FOLHA_MM], 'escala_scan_por_real': P.ESC,
            'origem_glb': [round(v, 4) for v in P.origem()], 'borda_cima_tampo_glb': [round(v, 4) for v in topo],
            'mesa_y_glb': round(P.y_mesa(), 4), 'regua_borda_mm_da_borda_cima_folha': P.REGUA_Y_MM,
            'regua_sobre_folha_mm': round(P.FOLHA_MM[1] + P.REGUA_Y_MM, 1)}


def rodar(busto, objs, pasta, glb, faixa):
    pasta = os.path.join(v6.ROOT, pasta)
    os.makedirs(pasta, exist_ok=True)
    ms = malhas(objs)
    busto.pose()
    m = {'telas': por_tela(busto, ms), 'geometria': geometria(), 'fade_y_glb': [round(v, 4) for v in faixa],
         'folga_busto_cm': folgas(busto, ms)}
    txt = subprocess.run(['node', os.path.join(v6.ROOT, '3d/tools/props/glb.mjs'), glb], capture_output=True,
                         text=True).stdout
    m['glb'] = txt.splitlines()[0] if txt else 'não obtido'
    with open(os.path.join(pasta, 'medidas.json'), 'w', encoding='utf-8') as f:
        json.dump(m, f, ensure_ascii=False, indent=1)
    print('MEDIDAS', json.dumps({k: m[k] for k in ('folga_busto_cm', 'glb', 'geometria')}, ensure_ascii=False))
    for t, v in m['telas'].items():
        for s in ESCALAS:
            e = v['escala_%.1f' % s]
            print('TELA', t, s, 'respiro', e['respiro_px'], 'bordas', e['bordas'], 'folha', e['folha'],
                  e['folha_px_larg_alt'], 'inteira', e['folha_inteira_na_tela'], e['folha_margem_baixo_px'])
    import prop_devops_prova_folha as folha
    folha.renders(busto, ms, pasta, m, rapido=bool(v6.ARGS.get('rapido')))
    return m
