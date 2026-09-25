"""E2, volta 2: `cupcake` e `muffin`, candidatos a comparar com o `bolo` (Fael, 25/09: "Doce - Bolo. E acho que um
muffin ou um cupcake poderia talvez ser melhor").

cupcake: forminha de papel creme com 20 pregas reais (vale e crista, borda com espessura), massa de chocolate que estufa
acima da forminha (ombro de casca mais escura) e cobertura de buttercream de framboesa dessaturada feita como no bico
pitanga: seção em estrela varrida numa hélice cônica que sobe em camadas, com a estrela torcendo ao longo do caminho
(sulcos em espiral, sulco mais escuro na cor por vértice), começo afinado e término em bico; no topo uma framboesa com
drupas e raspas de chocolate. Materiais: cobertura (rug 0,45) e papel/massa (rug 0,8, dupla face).
muffin: forminha tulipa de papel kraft (folha quadrada prensada: quatro pontas altas pela geometria do quadrado, vincos
irregulares, espessura na borda), abraçando o chapéu que transborda (cogumelo) e dourado, com rachadura ramificada no
topo mostrando o miolo claro, lábios da rachadura mais assados, relevo leve de massa assada e gotas de chocolate
meio afundadas. Materiais: massa (rug 0,72) e papel (rug 0,9, dupla face).
Espaço local: Z para cima, frente para −Y, origem no centro da base.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import prop_empreendedor_base as B
import prop_financeiro_v6 as v6

Z = Vector((0, 0, 1))


def _rgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def mistura(h1, h2, k):
    k = max(0.0, min(1.0, k))
    return '#' + ''.join('%02x' % round(a + (b - a) * k) for a, b in zip(_rgb(h1), _rgb(h2)))


def pintar_v(bm, faces, fn):
    """Cor por VÉRTICE (degradê sem degrau entre faces): fn(BMVert) → hex."""
    camada, memo = B.cores(bm), {}
    for f in faces:
        for lp in f.loops:
            h = fn(lp.vert)
            lp[camada] = memo.setdefault(h, v6.srgb(h))


def ondula(p, s=1.0):
    """Relevo suave determinístico (bolhas de massa assada), −1,5..1,5, comprimento de onda ~5 mm."""
    return (math.sin(p.x * 1300 * s + 1.3) * math.sin(p.y * 1100 * s + 0.7) * math.sin(p.z * 900 * s + 2.1)
            + 0.5 * math.sin(p.x * 2700 * s - p.y * 2300 * s + 0.4))


def grade(bm, nu, nv, pos, cor):
    """Grade fechada ao redor: pos(i, j) → (Vector, hex); devolve os anéis de vértices."""
    an = []
    for j in range(nv):
        anel = []
        for i in range(nu):
            p, c = pos(i, j)
            v = bm.verts.new(p)
            cor[v] = c
            anel.append(v)
        an.append(anel)
    for A, C_ in zip(an, an[1:]):
        for i in range(nu):
            i1 = (i + 1) % nu
            bm.faces.new((A[i], A[i1], C_[i1], C_[i]))
    return an


def polo(bm, anel, p, c, cor):
    v = bm.verts.new(p)
    cor[v] = c
    for i in range(len(anel)):
        bm.faces.new((v, anel[(i + 1) % len(anel)], anel[i]))


# ---------------------------------------------------------------- cupcake
C = {'forminha': '#e4dccb', 'prega': '#bfb29b', 'massa': '#5b3626', 'casca': '#3f271c', 'creme': '#d6b1a7',
     'sulco': '#ad847c', 'framboesa': '#8a2f3c', 'raspa': '#35211a'}
NP = 20                                             # pregas da forminha (2 amostras por prega: vale e crista)


def _crista(a):
    return abs(2 * ((a * NP / (2 * math.pi)) % 1.0) - 1)      # 1 na crista, 0 no vale


def espiral(bm, zb, R0, rc0, H, voltas=2.3, passos=36, ncs=12, a0=-math.pi / 2):
    """Cobertura de bico pitanga: estrela de ncs/2 pontas varrida numa hélice cônica em camadas, torcendo."""
    P, RC, quadro, aneis, cor = [], [], [], [], {}
    antes = len(bm.faces)
    for i in range(passos + 1):
        t = i / passos
        a = a0 + 2 * math.pi * voltas * t
        r = R0 * (1 - t) ** 0.85 + 0.0012
        rc = rc0 * (1 - 0.38 * t) * (0.55 + 0.45 * min(1.0, t / 0.07))
        z = zb + 0.72 * rc + H * t
        if t > 0.84:                                # o bico: afina e sobe, como a manga saindo
            u = (t - 0.84) / 0.16
            rc *= max(0.0, math.cos(u * math.pi / 2)) ** 0.6 + 0.05
            z += 0.005 * u ** 1.5
        P.append(Vector((r * math.cos(a), r * math.sin(a), z)))
        RC.append((rc, a))
    for i, p in enumerate(P):
        T = (P[min(i + 1, passos)] - P[max(i - 1, 0)]).normalized()
        lado = T.cross(Z).normalized()
        cima = lado.cross(T)
        rc, a = RC[i]
        anel = []
        for j in range(ncs):
            phi = 2 * math.pi * j / ncs + 1.6 * a
            s = math.sin(phi)
            rr = rc * (1.0 if j % 2 == 0 else 0.74)
            v = bm.verts.new(p + lado * (rr * math.cos(phi)) + cima * (rr * s * (0.85 if s > 0 else 0.6)))
            cor[v] = mistura(C['creme'], C['sulco'], (0.0 if j % 2 == 0 else 0.8) + max(0.0, -s) * 0.4)
            anel.append(v)
        aneis.append(anel)
        quadro.append((lado, cima))
    for A, C_ in zip(aneis, aneis[1:]):
        for j in range(ncs):
            j1 = (j + 1) % ncs
            bm.faces.new((A[j], A[j1], C_[j1], C_[j]))
    polo(bm, aneis[0][::-1], P[0] - (P[1] - P[0]).normalized() * RC[0][0] * 0.5, C['sulco'], cor)
    polo(bm, aneis[-1], P[-1] + Vector((0, 0, 0.0028)), C['creme'], cor)
    pintar_v(bm, B.desde(bm, antes), lambda v: cor[v])
    return P, RC, quadro


def cupcake(mats):
    creme, papel = mats('cobertura', 0.0, 0.45), mats('papel', 0.0, 0.8, double=True)
    bm = bmesh.new()
    forminha = [(0, 0.0), (0.0200, 0.0), (0.0212, 0.0009), (0.0281, 0.0312), (0.0276, 0.0317), (0.0270, 0.0296)]
    fs = B.torno(bm, forminha, 2 * NP,
                 raio=lambda r, z, a: r * (1 + 0.055 * (_crista(a) - 0.5) * min(1.0, 0.25 + z / 0.004)))
    pintar_v(bm, fs, lambda v: mistura(C['prega'], C['forminha'],
                                       _crista(math.atan2(v.co.y, v.co.x)) * (0.55 + 0.45 * min(1, v.co.z / 0.03))))
    massa = [(0.0266, 0.0292), (0.0293, 0.0328), (0.0288, 0.0362), (0.0215, 0.0392), (0, 0.0408)]
    fs = B.torno(bm, massa, 28, raio=lambda r, z, a: r * (1 + 0.025 * ondula(Vector((math.cos(a), math.sin(a),
                                                                                         z)) * 0.03, 1.4)))
    pintar_v(bm, fs, lambda v: mistura(C['massa'], C['casca'], (v.co.z - 0.0305) / 0.005))
    obj_papel = B.objeto('cupcake_forminha', bm, papel, ang=70, normais=False)

    bm = bmesh.new()
    P, RC, quadro = espiral(bm, zb=0.0352, R0=0.0220, rc0=0.0098, H=0.036, voltas=2.8, passos=38)
    fruta = [(0, 0), (0.0042, 0.0012), (0.0049, 0.0042), (0.0028, 0.0078), (0.0010, 0.0084), (0, 0.0078)]
    zs = [z for _, z in fruta]
    rot = Matrix.Rotation(0.42, 3, 'X') @ Matrix.Rotation(0.3, 3, 'Y')
    fs = B.torno(bm, fruta, 12, raio=lambda r, z, a: r * (1 + 0.11 * math.cos(6 * a + math.pi * zs.index(z))),
                 mapa=lambda p: rot @ p + Vector((0.0046, -0.0040, P[-1].z - 0.0085)))
    B.pintar(bm, fs, C['framboesa'])
    for k, t in enumerate((0.34, 0.52, 0.68, 0.80)):   # raspas de chocolate assentadas nas voltas de cima
        i = round(t * (len(P) - 1))
        (lado, cima), rc, g = quadro[i], RC[i][0], B.hash01(k, 5)
        c = P[i] + lado * rc * 0.4 + cima * rc * 0.72
        cont = [(0.0014 * (0.7 + 0.5 * B.hash01(k, m)) * math.cos(2 * math.pi * m / 5 + g),
                 0.0010 * (0.7 + 0.5 * B.hash01(m, k)) * math.sin(2 * math.pi * m / 5 + g)) for m in range(5)]
        r3 = Matrix.Rotation(0.5 + g, 3, 'X') @ Matrix.Rotation(6.28 * g, 3, 'Z')
        B.pintar(bm, B.placa(bm, cont, 0.0005, bev=0.00012, seg=1, mapa=lambda p, r3=r3, c=c: r3 @ Vector(p) + c),
                 C['raspa'])
    return [B.objeto('cupcake_cobertura', bm, creme, ang=60, normais=False), obj_papel]


# ---------------------------------------------------------------- muffin
M = {'kraft': '#a07f5d', 'vinco': '#7f6247', 'kraft_in': '#b39474', 'baixo': '#bf9562', 'dourado': '#a57642',
     'crosta': '#7c5029', 'miolo': '#dcbb88', 'gota': '#2c1b13'}
DOMO = [(0.0270, 0.0332), (0.0328, 0.0368), (0.0366, 0.0408), (0.0371, 0.0434), (0.0356, 0.0472), (0.0322, 0.0515),
        (0.0275, 0.0555), (0.0215, 0.0590), (0.0150, 0.0617), (0.0080, 0.0636)]      # chapéu; polo em z 0,0642
RACHA = [((-0.025, 0.008), (-0.010, -0.001), 0.0016, 0.0042), ((-0.010, -0.001), (0.004, 0.003), 0.0042, 0.0046),
         ((0.004, 0.003), (0.023, -0.007), 0.0044, 0.0016), ((-0.010, -0.001), (-0.006, -0.017), 0.0032, 0.0012),
         ((0.004, 0.003), (0.009, 0.018), 0.0030, 0.0012)]      # rachadura principal com dois galhos (x, y)
ZC, NU, NF = 0.034, 36, 32                          # boca da forminha; amostras do chapéu e do papel


def _dist_seg(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy), t


def _racha(x, y):
    fundo = borda = 0.0
    for a, b, w0, w1 in RACHA:
        d, t = _dist_seg((x, y), a, b)
        w = w0 + (w1 - w0) * t
        if d < w:
            fundo = max(fundo, 1 - (d / w) ** 2)
        elif d < 2 * w:
            borda = max(borda, 1 - abs(d - 1.5 * w) / (0.5 * w))
    return fundo, borda


def _domo_r(z):
    """Raio máximo do chapéu até a altura z (envelope): o papel não volta para dentro depois do transbordo."""
    r = 0.0
    for (r0, z0), (r1, z1) in zip(DOMO, DOMO[1:]):
        r = max(r, r0 + (r1 - r0) * (min(z, z1) - z0) / (z1 - z0)) if z >= z0 else r
    return r


def _chapeu(r, z, a, rachas):
    p = Vector((r * math.cos(a), r * math.sin(a), z))
    p += (p - Vector((0, 0, 0.030))).normalized() * 0.0006 * ondula(p)
    f = min(1.0, max(0.0, (z - 0.044) / 0.008))
    fundo, borda = _racha(p.x, p.y)
    p.z += f * (0.0015 * borda - 0.0070 * fundo)
    tom = mistura(M['baixo'], M['dourado'], (z - 0.036) / 0.006)
    tom = mistura(tom, M['crosta'], (z - 0.047) / 0.016 * 0.8 + 0.12 * ondula(p, 0.6) + 0.5 * f * borda)
    rachas[p.to_tuple(6)] = f * fundo
    return p, mistura(tom, M['miolo'], f * fundo * 1.3)


def muffin(mats):
    massa, papel = mats('massa', 0.0, 0.72), mats('papel', 0.0, 0.9, double=True)
    bm, cor, rachas = bmesh.new(), {}, {}
    perfil = DOMO[:4]
    for a_, b_ in zip(DOMO[3:], DOMO[4:]):          # topo mais denso (a rachadura precisa de amostras)
        perfil += [((a_[0] + b_[0]) / 2, (a_[1] + b_[1]) / 2), b_]
    an = grade(bm, NU, len(perfil), lambda i, j: _chapeu(*perfil[j], 2 * math.pi * i / NU, rachas), cor)
    polo(bm, an[-1], _chapeu(0, 0.0642, 0, rachas)[0], _chapeu(0, 0.0642, 0, rachas)[1], cor)
    polo(bm, an[0][::-1], Vector((0, 0, 0.033)), M['baixo'], cor)
    pintar_v(bm, list(bm.faces), lambda v: cor[v])
    gota = [(0, 0), (0.0023, 0.0003), (0.0012, 0.0021), (0, 0.0032)]
    for k, (i, j) in enumerate(((3, 2), (13, 3), (24, 2), (33, 4), (7, 7), (18, 8), (29, 6), (35, 9), (11, 11))):
        v = an[j][i]
        if rachas.get(v.co.to_tuple(6), 0) > 0.05:
            continue
        n = (v.co - Vector((0, 0, 0.030))).normalized()
        rot = Z.rotation_difference(n).to_matrix() @ Matrix.Rotation(6.28 * B.hash01(k, 9), 3, 'Z')
        fs = B.torno(bm, gota, 7, mapa=lambda p, rot=rot, c=v.co - n * 0.0011: rot @ p + c)
        B.pintar(bm, fs, M['gota'])
    obj_massa = B.objeto('muffin_massa', bm, massa, ang=70, normais=False)

    bm, cor = bmesh.new(), {}
    a_canto = -math.pi / 4                          # frente entre duas pontas: o chapéu transborda o lado baixo
    alt = [0.0, 0.0010, 0.012, 0.024, ZC]

    def z_de(i, j):
        a = 2 * math.pi * i / NF
        b = a - a_canto
        topo = 0.0395 + 0.042 * (1 / max(abs(math.cos(b)), abs(math.sin(b))) - 1) / (math.sqrt(2) - 1)
        return a, (alt[j] if j < len(alt) else ZC + (topo - ZC) * (j - len(alt) + 1) / 3)

    def papel_pt(i, j, dentro=0.0):
        a, z = z_de(i, j)
        if j == 0:
            r = 0.0200
        elif z <= ZC:
            r = 0.0212 + (0.028 - 0.0212) * z / ZC
        else:
            r = max(0.028 + (z - ZC) * 0.22, _domo_r(z) + 0.0013)    # pétalas quase verticais, abraçando
        amp = (0.022 + 0.03 * min(1.0, max(0.0, z - ZC) / 0.015)) * (0.6 + 0.8 * B.hash01(i, 3))
        vale = i % 2
        r = r * (1 + amp * (0.5 - vale) * min(1.0, 0.25 + z / 0.004)) - dentro
        base = M['kraft_in'] if dentro else M['kraft']
        return Vector((r * math.cos(a), r * math.sin(a), z)), mistura(base, M['vinco'], vale * 0.7 * (0.5 + amp * 12))

    fora = grade(bm, NF, len(alt) + 3, papel_pt, cor)
    dentro = grade(bm, NF, 4, lambda i, j: papel_pt(i, j + len(alt) - 1, 0.00045), cor)
    for i in range(NF):                             # espessura da borda: fora → dentro
        i1 = (i + 1) % NF
        bm.faces.new((fora[-1][i], fora[-1][i1], dentro[-1][i1], dentro[-1][i]))
    polo(bm, fora[0][::-1], Vector((0, 0, 0)), M['vinco'], cor)
    pintar_v(bm, list(bm.faces), lambda v: cor[v])
    return [obj_massa, B.objeto('muffin_forminha', bm, papel, ang=60, normais=False)]
