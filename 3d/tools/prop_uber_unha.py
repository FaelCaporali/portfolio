"""Unhas das mãos do `uber` (U5, ADENDO 4): placa curta (≈ 0,5 da falange distal) com espessura de 0,3 mm, rente à
pele (leito rebaixado; sem degrau de tampa), cutícula em arco, borda livre ≤ 1 mm, cor da pele com o rosado do leito,
material próprio (`uber_unha`, rugosidade 0,40).

A placa é gerada no repouso sobre o quadro de cada unha (prop_uber_mao_relevo.unhas): a superfície de cima é a pele
do leito projetada ao longo da normal da unha (+0,06 mm; o leito foi rebaixado 0,18 mm no relevo), a de baixo 0,3 mm
abaixo, com paredes; além do leito (borda livre) a placa segue a última inclinação. Depois vai para a pose com a
matriz do osso distal (FK da mão) e a matriz da pegada. Cor por vértice: leito rosado, lúnula clara, borda livre
marfim.
"""
import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import prop_empreendedor_base as EB
import prop_vela_base as B

ESP, TOPO, LIVRE = 0.00030, 0.00006, 0.0007           # placa rente à pele (sem degrau de tampa), borda livre curta
NS, NQ = 10, 7


def _cor(s):
    """Cor da pele com o rosado do leito (ADENDO 4: nada de branco, lilás ou cinza)."""
    if s < 0.18:
        return '#c98a74'                                         # lúnula, sutil
    if s > 0.9:
        return '#d49c86'                                         # borda livre, só um pouco mais clara
    return '#bf7c66'                                             # placa sobre o leito


def _placa(bm, f, arv):
    top = np.zeros((NS, NQ, 3))
    alt = np.full((NS, NQ), np.nan)
    ss, qs = np.linspace(0, 1, NS), np.linspace(-1, 1, NQ)
    for j, q in enumerate(qs):
        v = q * f['w'] * 0.95
        arco = f['w'] * (1 - np.sqrt(max(0.0, 1 - (v / f['w']) ** 2)))
        ui = f['u0'] + arco * 0.9
        uf = f['u1'] + LIVRE - 0.0008 * q * q
        for i, s in enumerate(ss):
            u = ui + s * (uf - ui)
            base = f['c'] + f['u'] * u + f['v'] * v
            if u <= f['u1'] - 0.0003:
                hit = arv.ray_cast(Vector(base + f['m'] * 0.008), Vector(-f['m']), 0.02)
                if hit[0] is not None:
                    alt[i, j] = (np.array(hit[0]) - base) @ f['m']
            if np.isnan(alt[i, j]) and i >= 2:                  # borda livre: segue a inclinação e desce de leve
                alt[i, j] = 2 * alt[i - 1, j] - alt[i - 2, j] - 0.00006
            if np.isnan(alt[i, j]):
                alt[i, j] = 0.0
            top[i, j] = base + f['m'] * (alt[i, j] + TOPO)
    fundo = top - f['m'] * ESP
    grade_t = [[Vector(p) for p in linha] for linha in top]
    grade_b = [[Vector(p) for p in linha[::-1]] for linha in fundo]
    ft = B.grade(bm, grade_t, uv=lambda i, j: (ss[i], (qs[j] + 1) / 2))
    fb = B.grade(bm, grade_b, uv=lambda i, j: (ss[i], 1 - (qs[j] + 1) / 2))
    for k, fc in enumerate(ft):
        EB.pintar(bm, [fc], _cor(ss[k // (NQ - 1)]))
    for k, fc in enumerate(fb):
        EB.pintar(bm, [fc], _cor(ss[k // (NQ - 1)]))
    # paredes: contorno (s = 0, q = +1, s = 1, q = −1)
    borda = ([(0, j) for j in range(NQ)] + [(i, NQ - 1) for i in range(1, NS)] +
             [(NS - 1, j) for j in range(NQ - 2, -1, -1)] + [(i, 0) for i in range(NS - 2, 0, -1)])
    vt = {}
    for i, j in borda:
        vt[(i, j)] = (bm.verts.new(top[i, j]), bm.verts.new(fundo[i, j]))
    for a, b in zip(borda, borda[1:] + borda[:1]):
        fc = bm.faces.new((vt[a][0], vt[b][0], vt[b][1], vt[a][1]))
        EB.pintar(bm, [fc], _cor(ss[max(a[0], b[0])]))


def construir(d, nome, mat):
    """Placas das cinco unhas de uma mão, posadas, num objeto (mundo)."""
    mao, T = d['mao'], d['T']
    me = d['ob'].data
    arv = BVHTree.FromPolygons([tuple(p) for p in d['Vr']], [tuple(p.vertices) for p in me.polygons])
    G = mao.globais()
    bm_total = bmesh.new()
    for dd, f in d['unhas'].items():
        bm = bmesh.new()
        f = dict(f)
        f['u0'] = max(f['u0'], f['u1'] - 0.5 * mao.dedo(dd)[2][2])     # placa ≈ 0,5 da falange distal
        _placa(bm, f, arv)
        M = T @ G['finger%d-3.%s' % (dd, mao.lado)]
        for v in bm.verts:
            v.co = Vector((M @ np.r_[np.array(v.co), 1])[:3])
        m2 = bpy.data.meshes.new('_u')
        bm.to_mesh(m2)
        bm_total.from_mesh(m2)
        bpy.data.meshes.remove(m2)
        bm.free()
    return EB.objeto(nome, bm_total, mat, ang=50, soldar=1e-7)


def material():
    return B.material('uber_unha', 0.0, 0.40)
