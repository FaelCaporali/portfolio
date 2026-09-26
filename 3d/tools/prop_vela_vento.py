"""ADENDO 8: o equipamento que mostra o vento nos dois barcos — biruta no topo do mastro e fitas indicadoras
(telltales) na vela. Cada peça é um NÓ próprio com origem no ponto de fixação e a peça apontando para +Z local do glb
(= −Y local no Blender); o site gira cada nó para o vento aparente.
- `vela_<barco>_biruta`: filha do pivô `vela_<barco>_casco` (o mastro é do casco); haste de 0,30 m, aleta e
  contrapeso, mancal vertical. `vela_<barco>_fita_<i>`: filhas do pivô do aparelho (a vela gira com ele), presas a
  ~22 % da corda, na face de sotavento, repouso ao longo da corda para ré.
- Tamanhos reais EXAGERADOS para ler na tela (fita real 12 × 200 mm → 35 × 300 mm; aleta 100 × 70 mm): com o Laser a
  ≈ 0,8 H no 1440 (≈ 68 px/m) a fita dá ~20 × 2,4 px. Registrado como desvio de proporção consciente.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

import prop_vela_base as B
import prop_vela_laser as laser
import prop_vela_optimist as optimist

COR = {'fita': '#c8452e', 'haste': '#1e2226', 'aleta': '#2e8fd6'}


def _vazio(nome, pai, loc, rot=(0, 0, 0)):
    o = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(o)
    o.parent, o.location, o.rotation_euler = pai, loc, rot
    return o


def _malha(nome, bm, mat, pai):
    obj = B.objeto(nome + '_malha', bm, mat, ang=50, normais=False)
    obj.parent = pai
    return obj


def biruta(nome, pai, topo, S, mat):
    """Biruta de topo de mastro: mancal vertical + haste para −Y (glb +Z) + aleta; contrapeso do outro lado."""
    g = _vazio(nome, pai, topo * S)
    bm = bmesh.new()
    k = S
    f = B.tubo_pts(bm, [Vector((0, 0, 0)), Vector((0, 0, 0.07 * k))], 0.012 * k, seg=8)
    f += B.tubo_pts(bm, [Vector((0, 0.06 * k, 0.06 * k)), Vector((0, -0.30 * k, 0.06 * k))], 0.008 * k, seg=6)
    f += B.torno(bm, [(0, -1), (0.7, -0.7), (1, 0), (0.7, 0.7), (0, 1)], 8,
                 mapa=lambda p: Vector((0, 0.07 * k, 0.06 * k)) + p * 0.022 * k)
    B.EB.pintar(bm, f, COR['haste'])
    a = B.anexar(bm, B.caixa(0.006 * k, 0.10 * k, 0.07 * k, 0.002 * k),
                 lambda p: p + Vector((0, -0.27 * k, 0.085 * k)))
    B.EB.pintar(bm, a, COR['aleta'])
    B.uv_reg(bm, bm.faces, 'plastico', 60)
    return [g, _malha(nome, bm, mat, g)]


def fita(nome, pai, ponto, corda_dir, S, mat, fase):
    """Fita de lã/náilon: tira fina ondulada ao longo de −Y local (glb +Z); o nó aponta para ré ao longo da corda."""
    ang = math.atan2(corda_dir.y, corda_dir.x) + math.pi / 2          # leva −Y local para a direção da corda
    g = _vazio(nome, pai, ponto * S, (0, 0, ang))
    bm = bmesh.new()
    L, w, e = 0.30 * S, 0.035 * S, 0.004 * S
    pts = [Vector((0.012 * S * math.sin(2.4 * t * math.pi + fase) * t, -L * t, -0.02 * S * t * t)) for t in
           (i / 8 for i in range(9))]
    A = [bm.verts.new(p + Vector((0, 0, w / 2))) for p in pts]
    C = [bm.verts.new(p + Vector((0, 0, -w / 2))) for p in pts]
    Ae = [bm.verts.new(p + Vector((e, 0, w / 2))) for p in pts]
    Ce = [bm.verts.new(p + Vector((e, 0, -w / 2))) for p in pts]
    for i in range(8):
        bm.faces.new((A[i], A[i + 1], C[i + 1], C[i]))
        bm.faces.new((Ce[i], Ce[i + 1], Ae[i + 1], Ae[i]))
        bm.faces.new((Ae[i], Ae[i + 1], A[i + 1], A[i]))
        bm.faces.new((C[i], C[i + 1], Ce[i + 1], Ce[i]))
    bm.faces.new((A[8], Ae[8], Ce[8], C[8]))
    bm.faces.new((C[0], Ce[0], Ae[0], A[0]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    B.EB.pintar(bm, bm.faces, COR['fita'])
    B.uv_reg(bm, bm.faces, 'cabo', 60)
    return [g, _malha(nome, bm, mat, g)]


def _na_vela(luff, leech, h, c, bojo, torcao, lado=-1.0):
    L, E = luff(h), leech(h)
    corda = Matrix.Rotation(torcao(h), 3, 'Z') @ (E - L)
    nrm = Vector((0, 0, 1)).cross(corda).normalized()
    if nrm.y * lado < 0:
        nrm = -nrm
    prof = bojo(h) * corda.length * math.sin(math.pi * c ** (math.log(0.5) / math.log(0.42)))
    return L + corda * c + nrm * (prof + 0.015), corda.normalized()


def equipar(barco, pc, pa, S, mat):
    objs = []
    if barco == 'laser':
        alto, zg = 6.02, laser.GARL
        z0 = laser.conves_z(laser.MASTRO_X, 0)
        topo = Vector((laser.MASTRO_X + laser.mastro_x(alto, alto), 0, z0 + alto + 0.02))
        luff = lambda h: Vector((laser.mastro_x(zg + 0.05 + h * 5.10, alto), 0, 0.05 + h * 5.10))   # noqa: E731
        clew, head = Vector((-2.70, 0, 0.09)), luff(1.0)
        leech = lambda h: clew + (head - clew) * h + Vector((-0.42 * math.sin(math.pi * min(h / 0.95, 1)) ** 1.2 *   # noqa
                                                              (1 - h) ** 0.3, 0, 0))
        pontos = [_na_vela(luff, leech, h, 0.22, lambda h: 0.09 * (1 - 0.5 * h), lambda h: 0.20 * h ** 1.3)
                  for h in (0.30, 0.52, 0.74)]
    else:
        zb = optimist.borda(optimist.MASTRO_X)
        topo = Vector((optimist.MASTRO_X, 0, zb + optimist.GARL + 2.16))
        luff = lambda h: Vector((0, 0, 0.03 + 2.10 * h))                                               # noqa: E731
        clew, peak = Vector((-2.00, 0, 0.04)), Vector((-1.02, 0, 2.58))
        leech = lambda h: clew + (peak - clew) * h + Vector((-0.10 * math.sin(math.pi * h), 0, 0))   # noqa: E731
        pontos = [_na_vela(luff, leech, h, 0.25, lambda h: 0.075, lambda h: 0.10 * h) for h in (0.35, 0.65)]
    objs += biruta('vela_%s_biruta' % barco, pc, topo, S, mat)
    for i, (p, d) in enumerate(pontos):
        objs += fita('vela_%s_fita_%d' % (barco, i), pa, p, d, S, mat, fase=1.3 * i)
    return objs
