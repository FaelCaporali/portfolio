"""Provas da vida `uber` v1 (ficha "Provas" 1 e 2), chamadas por prop_uber.py com provas=<pasta>.

medidas.json: folga dedos × aro (por dedo, mm), folga busto × volante/mãos/celular (pose triste e triste + piscar),
respiro aro × lábio inferior (px no 1440), caixas px nas 3 telas, largura da gota e altura da tela do celular no 1440,
ΔE2000 dorso da mão × bochecha (Cycles, câmera do 1440, luz nas direções do site; máscaras por geometria),
triângulos, kB e chamadas (do glb). Folha ≤ 1568 px.
"""
import json
import os
import subprocess

import bmesh
import bpy
import numpy as np
from mathutils import Vector

import comum
import prop_financeiro_v6 as v6
import prop_vela_base as B
import prop_vela_prova_olho as olho
from prop_financeiro_direita_prova import caixa_px
from prop_vela_prova import render_cycles

TRISTE = dict(browInnerUp=0.8)


def grupos(objs):
    g = {'volante': [], 'maos': [], 'lagrimas': [], 'celular': []}
    for o in objs:
        if o.type != 'MESH':
            continue
        n = o.name
        k = 'maos' if 'mao' in n else 'lagrimas' if 'lagrima' in n else 'celular' if 'celular' in n else 'volante'
        g[k].append(o)
    return g


def _lab(rgb):
    """sRGB 0..1 → CIELAB (D65)."""
    c = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def de2000(l1, l2):
    L1, a1, b1 = np.moveaxis(np.asarray(l1, float), -1, 0)
    L2, a2, b2 = np.moveaxis(np.asarray(l2, float), -1, 0)
    C1, C2 = np.hypot(a1, b1), np.hypot(a2, b2)
    Cm = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
    a1p, a2p = a1 * (1 + G), a2 * (1 + G)
    C1p, C2p = np.hypot(a1p, b1), np.hypot(a2p, b2)
    h1, h2 = np.degrees(np.arctan2(b1, a1p)) % 360, np.degrees(np.arctan2(b2, a2p)) % 360
    dL, dC = L2 - L1, C2p - C1p
    dh = h2 - h1
    dh = np.where(dh > 180, dh - 360, np.where(dh < -180, dh + 360, dh))
    dH = 2 * np.sqrt(C1p * C2p) * np.sin(np.radians(dh / 2))
    Lm, Cpm = (L1 + L2) / 2, (C1p + C2p) / 2
    hm = np.where(np.abs(h1 - h2) > 180, (h1 + h2 + 360) / 2, (h1 + h2) / 2)
    T = (1 - 0.17 * np.cos(np.radians(hm - 30)) + 0.24 * np.cos(np.radians(2 * hm))
         + 0.32 * np.cos(np.radians(3 * hm + 6)) - 0.20 * np.cos(np.radians(4 * hm - 63)))
    SL = 1 + 0.015 * (Lm - 50) ** 2 / np.sqrt(20 + (Lm - 50) ** 2)
    SC, SH = 1 + 0.045 * Cpm, 1 + 0.015 * Cpm * T
    RT = -2 * np.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7)) * np.sin(np.radians(60 * np.exp(-((hm - 275) / 25) ** 2)))
    return np.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH))


def _parte(ob, manter, nome, empurra=0.00008):
    """Cópia só com as faces `manter(face) → bool`, 0,08 mm para fora (máscara sem briga de profundidade)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.normal_update()
    fora = [f for f in bm.faces if not manter(f)]
    bmesh.ops.delete(bm, geom=fora, context='FACES')
    for v in bm.verts:
        v.co += v.normal * empurra
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(o)
    o.matrix_world = ob.matrix_world
    return o


def mascaras(busto, g, dados):
    """Objetos temporários: dorso dos dedos e dorso do metacarpo (sem unha, lado dorsal no repouso) e bochechas."""
    dorso, meta = [], []
    for d in dados:
        mao = d['mao']
        _, _, _, n = mao.quadro()
        ok = (mao.unha < 0.25) & ((d['Nr'] @ n) < -0.2) & (mao.t > 0.01)
        mc = sum(mao.W[:, mao.idx[b + '.' + mao.lado]] for b in ('wrist', 'metacarpal1', 'metacarpal2', 'metacarpal3',
                                                                    'metacarpal4')) > 0.5
        dorso.append(_parte(d['ob'], lambda f, ok=ok & ~mc: all(ok[v.index] for v in f.verts), '_dorso'))
        meta.append(_parte(d['ob'], lambda f, ok=ok & mc: all(ok[v.index] for v in f.verts), '_meta'))
    mw = busto.pele.matrix_world

    def boch(f):
        c = mw @ f.calc_center_median()
        return 0.03 < abs(c.x) < 0.065 and 0.12 < c.z < 0.155 and c.y < 0.03
    return dorso, meta, [_parte(busto.pele, boch, '_bochecha')]


def delta_e(busto, g, dados, pasta):
    """ΔE2000 entre a média Lab do dorso visível das mãos e a da bochecha, no Cycles pela câmera do 1440 (2×)."""
    dorso, meta, boch = mascaras(busto, g, dados)
    pele = list(busto.malhas.values())
    for m in busto.pele.data.materials:
        if m.name == '3DModel':
            next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Roughness'].default_value = 0.72
    cam = comum.camera_site('1440x900', escala=2)
    sc = bpy.context.scene
    W, H = sc.render.resolution_x, sc.render.resolution_y
    todos = pele + g['volante'] + g['maos']
    for o in todos + dorso + boch:
        o.color = (0, 0, 0, 1)
    for o in dorso:
        o.color = (1, 0, 0, 1)
    for o in meta:
        o.color = (0, 0, 1, 1)
    for o in boch:
        o.color = (0, 1, 0, 1)
    sh = comum._workbench('FLAT', 'OFF')
    sh.color_type = 'OBJECT'
    arq_m = os.path.join(pasta, '_de-mascara.png')
    comum._render(arq_m, todos + dorso + meta + boch)
    olho.estudio()
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.cycles.samples = 64
    arq = os.path.join(pasta, '_de-cycles.png')
    render_cycles(arq, todos, (0, 1, 0, 1))
    m, a = olho._img(arq_m), olho._img(arq)
    mm = (m[..., 2] > 0.5) & (m[..., 0] < 0.5) & (m[..., 1] < 0.5)
    md = ((m[..., 0] > 0.5) & (m[..., 1] < 0.5)) | mm
    mb = (m[..., 1] > 0.5) & (m[..., 0] < 0.5)
    ld, lb = _lab(a[md]), _lab(a[mb])
    lm = _lab(a[mm]) if mm.any() else None
    out = {'dE2000_medias': round(float(de2000(ld.mean(0), lb.mean(0))), 2),
           'dE2000_pixel_mediana': round(float(np.median(de2000(ld, lb.mean(0)))), 2),
           'lab_dorso': [round(float(v), 1) for v in ld.mean(0)],
           'lab_bochecha': [round(float(v), 1) for v in lb.mean(0)],
           'px_dorso': int(md.sum()), 'px_bochecha': int(mb.sum()), 'px_dorso_metacarpo': int(mm.sum()),
           'dE2000_pixel_mediana_so_metacarpo': None if lm is None else
           round(float(np.median(de2000(lm, lb.mean(0)))), 2),
           'dE2000_bochecha_propria_mediana': round(float(np.median(de2000(lb, lb.mean(0)))), 2),
           'L_p10_p50_p90_dorso': [round(float(v), 1) for v in np.percentile(ld[:, 0], (10, 50, 90))],
           'L_p10_p50_p90_bochecha': [round(float(v), 1) for v in np.percentile(lb[:, 0], (10, 50, 90))],
           'ab_mediana_dorso': [round(float(v), 1) for v in np.median(ld[:, 1:], 0)],
           'croma_dorso': round(float(np.hypot(*ld.mean(0)[1:])), 1),
           'croma_bochecha': round(float(np.hypot(*lb.mean(0)[1:])), 1),
           'k_sugerido(lin)': [round(float(v), 3) for v in (_lin(a[mb]).mean(0) / _lin(a[md]).mean(0))]}
    for o in dorso + meta + boch:
        bpy.data.meshes.remove(o.data)
    bpy.data.objects.remove(cam)
    print('DELTA_E', out)
    return out


def _lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def folgas_busto(busto, g):
    out = {}
    for nome, ch in (('triste', TRISTE), ('triste_piscar', dict(TRISTE, eyeBlinkLeft=1, eyeBlinkRight=1))):
        busto.pose(**ch)
        out[nome] = {k: round(B.folga(busto, g[k], amostra=2)[0] * 1000, 1) for k in ('volante', 'maos', 'celular')}
    busto.pose(**TRISTE)
    print('FOLGA_BUSTO_MM', out)
    return out


def respiro_labio(busto, g):
    """px (1440) entre o lábio inferior (x = 0, transição lábio → barba medida no S13, y_glb 0,084) e o ponto mais alto
    da silhueta do volante/mãos na faixa da boca (|x| ≤ 0,035)."""
    cam = comum.camera_site('1440x900', escala=1)
    bpy.context.view_layer.update()
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    h = busto.raio(Vector((0.0, 0.1, 0.084)), Vector((0, -1, 0)))
    y_labio = (1 - world_to_camera_view(sc, cam, h[0]).y) * 900
    topo = {}
    for k in ('volante', 'maos'):
        topo[k] = 1e9
        for o in g[k]:
            for v in o.data.vertices:
                p = o.matrix_world @ v.co
                if abs(p.x) <= 0.035:
                    topo[k] = min(topo[k], (1 - world_to_camera_view(sc, cam, p).y) * 900)
    bpy.data.objects.remove(cam)
    t = min(topo.values())
    return {'labio_px': round(y_labio, 1), 'topo_aro_px': round(topo['volante'], 1),
            'topo_maos_faixa_boca_px': round(topo['maos'], 1) if topo['maos'] < 1e8 else None,
            'respiro_px': round(t - y_labio, 1)}


def _fade(o):
    lay = o.data.uv_layers.get('Fade')
    f = np.ones(len(o.data.vertices))
    if lay is not None:
        for p in o.data.polygons:
            for li, vi in zip(p.loop_indices, p.vertices):
                f[vi] = lay.data[li].uv[0]
    return f


def borda(g):
    """Por tela e grupo: distância (px CSS) das partes VISÍVEIS (Fade ≥ 0,05) às bordas de baixo, esquerda e direita."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    out = {}
    for tela in comum.TELAS:
        cam = comum.camera_site(tela, escala=1)
        bpy.context.view_layer.update()
        W, H = sc.render.resolution_x, sc.render.resolution_y
        out[tela] = {}
        for k, objs in g.items():
            xs, ys = [], []
            for o in objs:
                f = _fade(o)
                for v in o.data.vertices:
                    if f[v.index] >= 0.05:
                        q = world_to_camera_view(sc, cam, o.matrix_world @ v.co)
                        xs.append(q.x * W)
                        ys.append((1 - q.y) * H)
            if xs:
                out[tela][k] = {'baixo': round(H - max(ys), 1), 'esq': round(min(xs), 1), 'dir': round(W - max(xs), 1)}
        bpy.data.objects.remove(cam)
    print('BORDA', out)
    return out


def caixas(g, busto):
    med = {}
    for tela in comum.TELAS:
        cam = comum.camera_site(tela, escala=1)
        bpy.context.view_layer.update()
        med[tela] = {'busto': [round(v) for v in caixa_px(cam, [busto.pele], 7)]}
        for k, objs in g.items():
            med[tela][k] = [round(v) for v in caixa_px(cam, objs)]
        for o in g['lagrimas'] + g['celular']:
            if o.name.endswith('gota_malha') or o.name.endswith('tela'):
                b = caixa_px(cam, [o])
                med[tela][o.name] = [round(b[2] - b[0], 1), round(b[3] - b[1], 1)]
        bpy.data.objects.remove(cam)
    return med


def rodar(busto, objs, dados, pasta, glb):
    pasta = os.path.join(v6.ROOT, pasta)
    os.makedirs(pasta, exist_ok=True)
    g = grupos(objs)
    busto.pose(**TRISTE)
    med = {'folga_dedos_aro_mm': {n: d['folga_mm'] for n, d in zip(('esq', 'dir'), dados)},
           'folga_busto_mm': folgas_busto(busto, g), 'respiro_aro_labio_1440': respiro_labio(busto, g),
           'caixas_px': caixas(g, busto), 'borda_visivel_px': borda(g)}
    med['deltaE'] = delta_e(busto, g, dados, pasta)
    import prop_uber_prova_pegada as PP
    med['pegada_adendo2'] = PP.checar(dados)
    med['proporcoes_adendo4'] = {PP.ROTULO[n]: d['escala'] for n, d in zip(('esq', 'dir'), dados)}
    med['tela_1440_adendo4'] = PP.tela(g, busto, dados)
    import prop_uber_prova_folha as folha
    if not v6.ARGS.get('rapido'):
        folha.renders(busto, g, pasta, med)
    txt = subprocess.run(['node', os.path.join(v6.ROOT, '3d/tools/props/glb.mjs'), glb], capture_output=True,
                         text=True).stdout
    med['glb'] = txt.splitlines()[0] if txt else 'não obtido'
    with open(os.path.join(pasta, 'medidas.json'), 'w', encoding='utf-8') as f:
        json.dump(med, f, ensure_ascii=False, indent=1)
    if not v6.ARGS.get('rapido'):
        folha.montar(pasta, med)
    return med

