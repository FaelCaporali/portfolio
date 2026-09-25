"""E1 `sup`: prancha de stand up paddle all-round EM PÉ (10'6" × 32": comprimento ≈ 4 × largura) e o remo encostado.

Prancha: estações ao longo do comprimento (Z, rabeta em 0, bico em L) com seção superelíptica (trilhos redondos,
deck levemente abaulado para −Y, fundo para +Y), rocker no bico e na rabeta, espessura que afina nas pontas. Deck pad
de EVA com ranhuras longitudinais e kicktail, alça embutida no centro de equilíbrio, quilha na rabeta.
Remo: cabo em T, haste de carbono, pá com nervura central e ângulo de 10° para a frente.
Materiais: verniz (casco, trilhos, quilha, remo; rug 0,3) e EVA fosco (deck pad e alça; rug 0,9).
"""
import math

import bmesh
from mathutils import Matrix, Vector

import prop_empreendedor_base as B

L, W, T = 0.19, 0.047, 0.0074                        # comprimento, largura, espessura máxima
NS, NR, NX = 19, 14, 2.7                             # estações, pontos da seção, expoente da superelipse
INCL = Matrix.Rotation(math.radians(-7), 4, 'X')     # em pé, topo recuado (encostada)
COR = {'casco': '#ebe7de', 'trilho': '#2f5667', 'quilha': '#2b2d30', 'pad': '#3b3d3f', 'alca': '#1c1d1f',
       'carbono': '#1f2124', 'pa': '#2f5667', 'ponteira': '#8d9196'}


def se(c, n=NX):
    return math.copysign(abs(c) ** (2 / n), c)


def meia(t):
    """Meia largura no ponto t (0 rabeta, 1 bico): rabeta quadrada de cantos redondos, bico elíptico."""
    if t <= 0.45:
        f = 0.72 + 0.28 * math.sin(math.pi / 2 * t / 0.45)
    else:
        f = max(0.0, 1 - ((t - 0.45) / 0.55) ** 2) ** 0.5
    if t < 0.035:
        f *= 1 - 0.3 * (1 - t / 0.035) ** 2
    return W / 2 * f


def esp(t):
    return T * (0.45 + 0.55 * math.sin(math.pi * (0.15 + 0.85 * t)) ** 0.5)


def rocker(t):
    return 0.045 * L * max(0.0, (t - 0.62) / 0.38) ** 2.2 + 0.008 * L * max(0.0, (0.2 - t) / 0.2) ** 2


def deck_y(t, u):
    return -rocker(t) - 0.5 * esp(t) * max(0.0, 1 - abs(u) ** NX) ** (1 / NX)


def prancha(bm):
    ts = [(1 - math.cos(math.pi * i / (NS - 1))) / 2 for i in range(NS)]
    aneis = []
    for t in ts[:-1]:
        w, h, r = meia(t), 0.5 * esp(t), rocker(t)
        aneis.append([bm.verts.new(INCL @ Vector((w * se(math.cos(a)), -r - h * se(math.sin(a)), t * L)))
                      for a in (2 * math.pi * k / NR for k in range(NR))])
    bico = bm.verts.new(INCL @ Vector((0, -rocker(1.0), L)))
    cauda = bm.verts.new(INCL @ Vector((0, -rocker(0.0), 0)))
    trilho = [abs(math.cos(2 * math.pi * (k + 0.5) / NR)) > 0.8 for k in range(NR)]
    for A, C in zip(aneis, aneis[1:]):
        for k in range(NR):
            f = bm.faces.new((A[k], A[(k + 1) % NR], C[(k + 1) % NR], C[k]))
            B.pintar(bm, [f], COR['trilho' if trilho[k] else 'casco'])
    for k in range(NR):
        B.pintar(bm, [bm.faces.new((aneis[-1][k], aneis[-1][(k + 1) % NR], bico))], COR['trilho' if trilho[k]
                                                                                           else 'casco'])
        B.pintar(bm, [bm.faces.new((aneis[0][(k + 1) % NR], aneis[0][k], cauda))], COR['casco'])


def quilha(bm):
    tf = 0.075
    yb, zf = -rocker(tf) + 0.5 * esp(tf), tf * L
    contorno = [(0.007, 0), (0.002, 0.008), (-0.006, 0.0145), (-0.0105, 0.0158), (-0.0118, 0.0146),
                (-0.0085, 0.0085), (-0.0085, 0.003), (-0.010, 0)]
    f = B.placa(bm, contorno, 0.0013, 0.00045, 2,
                lambda p: INCL @ Vector((p.z - 0.00065, yb + p.y - 0.0006, zf + p.x)))
    B.pintar(bm, f, COR['quilha'])


def pad(bm):
    """Deck pad de EVA: ranhuras longitudinais (nervura alta, sulco baixo) e o kicktail na rabeta."""
    t0, t1, U, NRIB, NT = 0.05, 0.50, 0.82, 5, 8
    baixo, alto = 0.00035, 0.0009
    us = []
    for i in range(NRIB):
        a, b = -U + 2 * U * i / NRIB, -U + 2 * U * (i + 1) / NRIB
        e, g = 0.03 * (b - a), 0.24 * (b - a)
        us += [(a, baixo), (a + e, alto), (b - g - e, alto), (b - g, baixo)]
    us.append((U, baixo))

    def topo(t, u, h):
        kick = 0.0026 * max(0.0, 1 - ((t - 0.085) / 0.03) ** 2)
        return INCL @ Vector((u * meia(t), deck_y(t, u) - h - kick, t * L))

    ts = [t0 + (t1 - t0) * i / (NT - 1) for i in range(NT)]
    G = [[bm.verts.new(topo(t, u, h)) for u, h in us] for t in ts]
    faces = [bm.faces.new((G[i][j], G[i][j + 1], G[i + 1][j + 1], G[i + 1][j]))
             for i in range(NT - 1) for j in range(len(us) - 1)]
    borda = [(0, j) for j in range(len(us))] + [(i, len(us) - 1) for i in range(1, NT)]
    borda += [(NT - 1, j) for j in range(len(us) - 2, -1, -1)] + [(i, 0) for i in range(NT - 2, 0, -1)]
    base = [bm.verts.new(INCL @ Vector((us[j][0] * meia(ts[i]), deck_y(ts[i], us[j][0]) + 0.0003, ts[i] * L)))
            for i, j in borda]
    for k in range(len(borda)):
        k1 = (k + 1) % len(borda)
        (i0, j0), (i1, j1) = borda[k], borda[k1]
        faces.append(bm.faces.new((G[i0][j0], base[k], base[k1], G[i1][j1])))
    B.pintar(bm, faces, COR['pad'])
    # Alça embutida no centro de equilíbrio (logo à frente do pad): aro oval rente ao deck e a barra.
    tc = 0.545
    perfil = [(0, -0.0001), (0.78, -0.0001), (0.88, -0.0005), (1.0, -0.0006), (1.1, 0.0001)]
    f = B.torno(bm, perfil, 14, mapa=lambda p: INCL @ Vector((p.x * 0.0075, deck_y(tc, p.x * 0.0075 / meia(tc)) + p.z,
                                                                 tc * L + p.y * 0.0042)))
    f += B.anexar(bm, B.caixa(0.0118, 0.0017, 0.0013, 0.0004),
                  lambda p: INCL @ Vector((p.x, deck_y(tc, 0) - 0.0001 + p.z, tc * L + p.y)))
    B.pintar(bm, f, COR['alca'])


def remo(bm):
    """Remo encostado ao lado da prancha (lado de fora, −X): pá em baixo, cabo em T em cima."""
    BL, BW, PT, R = 0.036, 0.0128, 0.132, 0.00145
    b = [0.80, 0.94, 1.0, 1.0, 0.95, 0.80, 0.55, 0.24]
    s = [0.0, 0.05, 0.15, 0.32, 0.5, 0.68, 0.84, 1.0]
    lado = [(BW / 2 * bi, BL * si + (0.0006 if si == 0 else 0)) for bi, si in zip(b, s)]
    contorno = [(0, 0)] + lado + [(-x, y) for x, y in reversed(lado)]
    eixo = Vector((0.13, 0.05, 1)).normalized()
    Rm = Vector((0, 0, 1)).rotation_difference(eixo).to_matrix().to_4x4()
    P0 = Vector((-(W / 2 + 0.0105), -0.009, 0.0))
    ang = Matrix.Rotation(math.radians(10), 4, 'X')
    garg = Vector((0, 0, BL))

    def lugar(q):
        return P0 + Rm @ q

    def na_pa(q):
        return lugar(garg + ang @ (q - garg))

    fa = B.placa(bm, contorno, 0.0011, 0.0003, 1, lambda p: na_pa(Vector((p.x, p.z - 0.00055, p.y))))
    fa += B.anexar(bm, B.caixa(0.0016, 0.0009, BL * 0.78, 0.0004),
                   lambda p: na_pa(Vector((p.x, p.y - 0.0007, p.z + BL * 0.5))))
    B.pintar(bm, fa, COR['pa'])
    fh = B.torno(bm, [(0, BL - 0.004), (R, BL - 0.004), (R, PT - 0.003), (0, PT - 0.003)], 8, mapa=lugar)
    fh += B.anexar(bm, B.caixa(0.0155, 0.0036, 0.0046, 0.0015, 2), lambda p: lugar(p + Vector((0, 0, PT - 0.0018))))
    B.pintar(bm, fh, COR['carbono'])


def construir(mats):
    verniz, fosco = mats('verniz', 0.0, 0.3), mats('eva', 0.0, 0.9)
    bm = bmesh.new()
    prancha(bm)
    quilha(bm)
    remo(bm)
    casco = B.objeto('sup_casco', bm, verniz, ang=50)
    bm = bmesh.new()
    pad(bm)
    return [casco, B.objeto('sup_deckpad', bm, fosco, ang=50)]
