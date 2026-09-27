"""Provas da vida `qa` v1 (chamadas por prop_qa.py com provas=<pasta>): medidas.json + renders rotulados + folha.

Medidas de FUNÇÃO: patas (6, raízes no tórax), pegada (folga dos dedos no cabo, vértices dentro), alfinetes no tórax
dos espécimes, folgas de cada peça ao busto (browDown 0,5), tamanhos em px CSS nas 3 telas (bug, lente, caixa), nós e
chaves do glb e o orçamento (glb.mjs). Renders: prop_qa_prova_folha.py.
"""
import json
import os
import struct
import subprocess

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

import comum
import prop_financeiro_v6 as v6
import prop_qa_bug as BG
import prop_qa_lupa as LP
import prop_qa_util as U
import prop_vela_base as B

CABECA = 0.28                                    # altura da cabeça no glb (topo 0,32 → queixo 0,04)


def nos_glb(glb):
    """(nome → pai, malhas com chaves) lidos do JSON do glb."""
    with open(glb, 'rb') as f:
        f.seek(12)
        n, _ = struct.unpack('<II', f.read(8))
        j = json.loads(f.read(n))
    pai = {}
    for i, no in enumerate(j['nodes']):
        for c in no.get('children', []):
            pai[j['nodes'][c]['name']] = no['name']
    raiz = [j['nodes'][i]['name'] for i in j['scenes'][0]['nodes']]
    chaves = {m['name']: m.get('extras', {}).get('targetNames') for m in j['meshes'] if m.get('extras')}
    return {'raiz': raiz, 'pai': pai, 'chaves': chaves}


def _pts(objs, passo=1):
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in objs:
        me = o.evaluated_get(dg).to_mesh()
        mw = o.matrix_world
        out += [mw @ me.vertices[i].co for i in range(0, len(me.vertices), passo)]
        o.evaluated_get(dg).to_mesh_clear()
    return out


def caixa_px(pts, tela):
    cam = comum.camera_site(tela, escala=1)
    bpy.context.view_layer.update()
    sc = bpy.context.scene
    W, H = sc.render.resolution_x, sc.render.resolution_y
    q = [world_to_camera_view(sc, cam, p) for p in pts]
    xs, ys = [a.x * W for a in q], [(1 - a.y) * H for a in q]
    bpy.data.objects.remove(cam)
    return [round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys))], round(max(max(xs) - min(xs),
                                                                                       max(ys) - min(ys)), 1)


def bug_local(objs, no):
    """Caixa do bug no local do nó (glb): x, y, z (m)."""
    inv = no.matrix_world.inverted()
    P = np.array([(inv @ p)[:] for p in _pts(objs)])
    G = np.c_[P[:, 0], P[:, 2], -P[:, 1]]
    return G.min(0), G.max(0)


def medir(busto, objs, d, med_cx, quadros, glb):
    ob = {o.name: o for o in objs}
    M_lupa, M_bug, M_caixa = quadros
    corpo = [ob['qa_bug_corpo'], ob['qa_bug_elitro_esq_malha'], ob['qa_bug_elitro_dir_malha']]
    lo, hi = bug_local(corpo, ob['qa_bug'])
    lo2, hi2 = bug_local(corpo + [ob['qa_bug_patas_malha']], ob['qa_bug'])
    el = bug_local([ob['qa_bug_elitro_esq_malha'], ob['qa_bug_elitro_dir_malha']], ob['qa_bug'])
    frente = BG.BASE['cab'][2] + 0.0122 - BG.COM[2]
    m = {'bug': {'comprimento_cabeca_a_ponta_m': round(float(frente - el[0][2]), 4),
                 'comprimento_com_antenas_m': round(float(hi[2] - lo[2]), 4),
                 'largura_elitros_m': round(float(el[1][0] - el[0][0]), 4),
                 'envergadura_patas_m': round(float(hi2[0] - lo2[0]), 4),
                 'altura_m': round(float(hi[1] - lo[1]), 4),
                 'comprimento_sobre_cabeca': round(float(frente - el[0][2]) / CABECA, 3),
                 'patas': [{'par': k, 'lado': s, 'raiz_z_mm': round(BG.RAIZ[k][2] * 1000, 1),
                            'no_torax': BG.TORAX_Z[0] <= BG.RAIZ[k][2] <= BG.TORAX_Z[1]}
                           for k in range(3) for s in ('esq', 'dir')],
                 'torax_z_mm': [BG.TORAX_Z[0] * 1000, BG.TORAX_Z[1] * 1000]}}
    m['bug']['patas_no_torax'] = sum(p['no_torax'] for p in m['bug']['patas'])
    m['pegada'] = dict(d['folga_mm'], giro_graus=d['giro'], antebraco_blender=np.round(d['antebraco'], 2).tolist(),
                       h_pegada_m=round(d['h_q'], 4), h_no_cabo_m=round(d['lupa']['h_no'], 4),
                       comprimento_lupa_m=round(d['lupa']['comprimento_total'], 4), raio_cabo_m=LP.RG,
                       escala_mao=d['escala'])
    m['caixa'] = dict(med_cx, maior_lado_sobre_cabeca=round(max(med_cx['externo_m'][:2]) / CABECA, 3),
                      alfinetes_no_torax=sum(a['atravessa_torax'] for a in med_cx['alfinetes']))
    fol = {}
    for nome, grupo in (('bug', corpo + [ob['qa_bug_patas_malha']]), ('mao', [ob['qa_mao_malha']]),
                        ('lupa', [ob['qa_lupa_malha'], ob['qa_lupa_lente']]), ('caixa', [ob['qa_caixa_malha']])):
        dmin, dentro = B.folga(busto, grupo, amostra=2)
        fol[nome] = {'min_cm': round(dmin * 100, 2), 'vertices_dentro': dentro}
    m['folga_busto'] = fol
    tel = {}
    lente = [Vector(U.bl(M_lupa[:3, 3] + (M_lupa[:3, 0] * np.cos(a) + M_lupa[:3, 1] * np.sin(a)) * LP.R_ARO))
             for a in np.linspace(0, 2 * np.pi, 24, endpoint=False)]
    for tela in comum.TELAS:
        tel[tela] = {'bug': caixa_px(_pts(corpo), tela), 'bug_com_patas': caixa_px(_pts(corpo + [
            ob['qa_bug_patas_malha']]), tela)[1], 'aro': caixa_px(lente, tela),
            'caixa': caixa_px(_pts([ob['qa_caixa_malha']], 3), tela),
            'busto': caixa_px(_pts([busto.pele], 7), tela)}
    m['telas_px_css'] = tel
    m['nos'] = nos_glb(glb)
    txt = subprocess.run(['node', os.path.join(v6.ROOT, '3d/tools/props/glb.mjs'), glb], capture_output=True,
                         text=True).stdout
    m['glb'] = txt.splitlines()[0] if txt else 'não obtido'
    return m


def rodar(busto, objs, d, med_cx, quadros, pasta, glb):
    pasta = os.path.join(v6.ROOT, pasta)
    os.makedirs(pasta, exist_ok=True)
    m = medir(busto, objs, d, med_cx, quadros, glb)
    with open(os.path.join(pasta, 'medidas.json'), 'w', encoding='utf-8') as f:
        json.dump(m, f, ensure_ascii=False, indent=1, default=str)
    print('MEDIDAS', json.dumps({k: m[k] for k in ('bug', 'pegada', 'folga_busto', 'glb')}, ensure_ascii=False,
                                default=str)[:3000])
    for t, v in m['telas_px_css'].items():
        print('TELA', t, 'bug', v['bug'][1], 'patas', v['bug_com_patas'], 'aro', v['aro'][1], 'caixa', v['caixa'][1],
              'busto', v['busto'][0])
    import prop_qa_prova_folha as folha
    folha.renders(busto, objs, d, quadros, pasta, m)
    return m
