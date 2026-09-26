"""V5 `vela_optimist`: um Optimist em miniatura, velejando. Medidas reais (m) e escala S no fim (a mesma do Laser).

Casco em caixa ("prancha de pão"): 2,31 × 1,13 m, proa quadrada (espelho de proa alto, fundo subindo), fundo chato com
leve V e quinas vivas, costado abrindo; casca com espessura, verdugo (friso) na borda, banco do mastro, caixa da bolina.
Três flutuadores (proa e dois laterais) com as cintas. Bolina e leme de perfil; cana e extensão. Aparelho de espicha
(nó `vela_optimist_vela`, origem no eixo do mastro na garlindéu): mastro no casco; vela de 4 lados (gurutil no mastro,
esteira na retranca, pique sustentado pela espicha diagonal), retranca, espicha e escota.
"""
import math

import bmesh
import bpy
from mathutils import Vector

import prop_vela_barco as BB

PROA, POPA, L = 1.00, -1.31, 2.31
MASTRO_X, GARL = 0.62, 0.24                 # pé do mastro; garlindéu acima da borda
COR = {'fora': '#3f93cf', 'dentro': '#e2dfd7', 'friso': '#d9d5cc', 'banco': '#cfcac0', 'lamina': '#d6d4ce',
       'aluminio': '#a9adb2', 'flut': '#e6e3dc', 'cinta': '#2a3038', 'escota': '#c7ccd2', 'madeira': '#8a6a4a'}


def t_de(x):
    return min(max((PROA - x) / L, 0.0), 1.0)


def boca(x):
    """(meia boca na borda, meia boca na quina)."""
    t = t_de(x)
    bb = 0.335 + (0.565 - 0.335) * math.sin(math.pi / 2 * min(t / 0.55, 1)) ** 0.9
    if t > 0.55:
        bb = 0.565 - (0.565 - 0.47) * ((t - 0.55) / 0.45) ** 2
    return bb, bb - 0.10


def borda(x):
    return 0.28 + 0.10 * (1 - t_de(x)) ** 3


def fundo(x):
    t = t_de(x)
    return -0.10 + 0.22 * max(0.0, 1 - t / 0.42) ** 1.8 + 0.07 * max(0.0, (t - 0.75) / 0.25) ** 2


def anel(x):
    """U aberto: borda de boreste → quina → centro (V leve) → quina → borda de bombordo."""
    bb, bq = boca(x)
    zs, zf = borda(x), fundo(x)
    pts = []
    for k in range(5):                                            # costado de boreste (borda → quina)
        f = k / 4
        pts.append(Vector((x, -(bb + (bq - bb) * f), zs + (zf + 0.03 - zs) * f)))
    for k in range(1, 8):                                         # fundo (quina → quina)
        y = -bq + 2 * bq * k / 8
        pts.append(Vector((x, y, zf + 0.03 * abs(y) / bq)))
    for k in range(5):
        f = 1 - k / 4
        pts.append(Vector((x, bb + (bq - bb) * f, zs + (zf + 0.03 - zs) * f)))
    return pts


def casco(bm):
    xs = [POPA + L * i / 18 for i in range(19)]
    t = bmesh.new()
    faces, aneis = BB.casco_estacoes(t, xs, anel, fechar_popa=True, fechar_proa=True)
    me = bpy.data.meshes.new('_opti')
    t.to_mesh(me)
    t.free()
    o = bpy.data.objects.new('_opti', me)
    bpy.context.scene.collection.objects.link(o)
    s = o.modifiers.new('Esp', 'SOLIDIFY')
    s.thickness, s.offset, s.use_rim, s.use_even_offset = 0.022, -1.0, True, True
    dg = bpy.context.evaluated_depsgraph_get()
    t = bmesh.new()
    t.from_object(o, dg)
    bpy.data.objects.remove(o)
    bpy.data.meshes.remove(me)
    bmesh.ops.recalc_face_normals(t, faces=t.faces)
    t.normal_update()
    faces = BB.B.anexar(bm, t, lambda p: p)
    bm.normal_update()
    for f in faces:
        c, n = f.calc_center_median(), f.normal
        bb, _ = boca(c.x)
        dentro = (n.z > 0.3 and c.z < borda(c.x) - 0.03) or abs(c.y) < bb - 0.03 and abs(n.y) > 0.5 and \
            (n.y * c.y) < 0
        BB.pintar_reg(bm, [f], COR['dentro'] if dentro else COR['fora'], 'gelcoat')
    # Verdugo: friso arredondado na borda dos dois lados.
    for s_ in (-1, 1):
        pts = [Vector((x, s_ * (boca(x)[0] + 0.012), borda(x) - 0.012)) for x in xs]
        BB.pintar_reg(bm, BB.tubo(bm, pts, 0.022, seg=8), COR['friso'], 'borracha')


def interior(bm):
    """Banco do mastro, caixa da bolina, flutuadores com cintas."""
    zb = borda(MASTRO_X) - 0.06
    bb, _ = boca(MASTRO_X)
    f = BB.EB.anexar(bm, BB.EB.caixa(0.22, 2 * bb - 0.06, 0.03, 0.01), lambda p: p + Vector((MASTRO_X, 0, zb)))
    BB.pintar_reg(bm, f, COR['banco'], 'gelcoat')
    zf = fundo(0.2)
    f = BB.EB.anexar(bm, BB.EB.caixa(0.40, 0.06, zb - zf, 0.01), lambda p: p + Vector((0.22, 0, (zb + zf) / 2)))
    BB.pintar_reg(bm, f, COR['banco'], 'gelcoat')
    fl = []
    perfil = [(0.0, -0.5), (0.7, -0.48), (0.95, -0.35), (1.0, 0.0), (0.95, 0.35), (0.7, 0.48), (0.0, 0.5)]

    def almofada(cx, cy, cz, sx, sy, sz):
        return BB.B.torno(bm, perfil, 14, mapa=lambda p: Vector((cx + p.x * sx, cy + p.y * sy, cz + p.z * sz)))
    fl += almofada(PROA - 0.20, 0, borda(PROA - 0.2) - 0.14, 0.14, 0.30, 0.24)
    for s_ in (-1, 1):
        x = -0.55
        fl += almofada(x, s_ * (boca(x)[0] - 0.13), borda(x) - 0.15, 0.40, 0.10, 0.22)
    BB.pintar_reg(bm, fl, COR['flut'], 'plastico')
    for s_ in (-1, 1):
        for x in (-0.30, -0.80):
            y = s_ * (boca(x)[0] - 0.13)
            c = BB.cabo(bm, (x, y - 0.12, borda(x) - 0.03), (x, y + 0.12, borda(x) - 0.03), 0.012, seca=-0.07)
            BB.pintar_reg(bm, c, COR['cinta'], 'borracha')


def apendices(bm):
    f = BB.lamina(bm, 0.36, 0.84, 0.08, lambda p: Vector((0.22 + p.x * 0.9, p.y, p.z + borda(0.22) + 0.10)))
    BB.pintar_reg(bm, f, COR['lamina'], 'lamina')
    zr = borda(POPA)
    f = BB.lamina(bm, 0.28, 0.72, 0.08, lambda p: Vector((POPA - 0.10 - p.x * 0.9, p.y, p.z + zr + 0.04)), afina=0.8)
    BB.pintar_reg(bm, f, COR['lamina'], 'lamina')
    cana = [Vector((POPA - 0.05, 0, zr + 0.05)), Vector((POPA + 0.40, 0, zr + 0.08)), Vector((POPA + 0.72, 0, zr + 0.09))]
    f = BB.tubo(bm, cana, 0.016)
    ext = [cana[-1], cana[-1] + Vector((0.35, 0.22, 0.01)), cana[-1] + Vector((0.62, 0.40, -0.04))]
    f += BB.tubo(bm, ext, 0.010)
    BB.pintar_reg(bm, f, COR['madeira'], 'lamina')


def mastro(bm):
    zf = fundo(MASTRO_X)
    alto = borda(MASTRO_X) + GARL + 2.14 - zf
    pts = [Vector((MASTRO_X, 0, zf + 0.02 + alto * k / 6)) for k in range(7)]
    BB.pintar_reg(bm, BB.B.tubo_pts(bm, pts, 0.024, seg=10), COR['aluminio'], 'aluminio')
    return borda(MASTRO_X)


def aparelho(bm_r, bm_v, lado=-1.0):
    """Vela de espicha no espaço do nó (origem: eixo do mastro na garlindéu). Vela primeiro no bm_v."""
    luff = lambda h: Vector((0, 0, 0.03 + 2.10 * h))         # noqa: E731
    clew, peak = Vector((-2.00, 0, 0.04)), Vector((-1.02, 0, 2.58))

    def leech(h):
        p = clew + (peak - clew) * h
        return p + Vector((-0.10 * math.sin(math.pi * h), 0, 0))
    # A última linha (h = 1) é a testa: do topo do mastro ao pique.
    faces, P, Q = BB.vela(bm_v, luff, leech, 12, 18, lambda h: 0.075, lambda h: 0.10 * h, (0.5, 0.0, 1.0, 1.0),
                          lado=lado, pos_bojo=0.40)
    chave = {i * 19 + j: Q[i][j] for i in range(len(Q)) for j in range(19)}
    f = BB.tubo(bm_r, [Vector((0.02, 0, 0)), Vector((-2.02, 0, 0))], 0.022, seg=8)
    pe = Vector((0.02, 0, 0.55))
    pique = P[-1][-1]
    esp = pique + Vector((0, 0.025 * -lado, 0))
    f += BB.tubo(bm_r, [pe + Vector((0, 0.03 * -lado, 0)), esp], 0.020, seg=8)
    BB.pintar_reg(bm_r, f, COR['aluminio'], 'aluminio')
    f = BB.cabo(bm_r, (-1.60, 0, -0.03), (-1.35, 0, -GARL - 0.32), 0.008)
    f += BB.cabo(bm_r, (0.03, 0.02 * -lado, 0.55), (0.03, 0.02 * -lado, 0.30), 0.008)
    BB.pintar_reg(bm_r, f, COR['escota'], 'cabo')
    return chave


def construir(S, mat_rigido, mat_vela):
    bm = bmesh.new()
    casco(bm)
    interior(bm)
    apendices(bm)
    zb = mastro(bm)
    obj_c = BB.B.objeto('vela_optimist_casco', bm, mat_rigido, ang=38)
    BB.finalizar(obj_c, S)
    bm_r, bm_v = bmesh.new(), bmesh.new()
    chave = aparelho(bm_r, bm_v)
    obj_a = BB.objeto_aparelho('vela_optimist_vela', bm_r, bm_v, mat_rigido, mat_vela, chave)
    BB.finalizar(obj_a, S)
    return obj_c, obj_a, Vector((MASTRO_X, 0, zb + GARL)) * S
