"""E3: `beliche` (beliche de madeira do dormitório compartilhado) e `chave_quarto` (chave antiga com chaveiro torneado).

beliche: quatro colunas, travessas das duas camas, cabeceiras de ripas, guarda-corpo em cima e escada de degraus na
frente; colchões macios (chanfro largo), travesseiros e mantas dobradas. Tons de madeira variam por peça (tábuas
diferentes). Materiais: madeira (rug 0,55) e tecido (rug 0,9).
chave_quarto: argola de latão, chave de haste (anel, colarinhos, palhetão com dentes) e chaveiro de madeira torneada
com medalhão liso de latão (o número entra depois como canvas). Materiais: latão (metal 1, rug 0,35) e madeira (0,45).
"""
import math

import bmesh
from mathutils import Matrix, Vector

import prop_empreendedor_base as B

CM = {'madeira': '#a97b50', 'colchao': '#e2ded6', 'travesseiro': '#eeebe5', 'manta1': '#5b6a76',
      'manta2': '#98583b'}


def _tabua(bm, tam, centro, bev=0.0007, seg=1, i=0):
    f = B.anexar(bm, B.caixa(*tam, bev, seg), lambda p: p + Vector(centro))
    k = 0.9 + 0.2 * B.hash01(i, 5.3)
    h = CM['madeira'].lstrip('#')
    B.pintar(bm, f, '#' + ''.join('%02x' % min(255, int(int(h[j:j + 2], 16) * k)) for j in (0, 2, 4)))


def beliche(mats):
    madeira, tecido = mats('madeira', 0.0, 0.55), mats('tecido', 0.0, 0.9)
    LX, LY, HZ, P = 0.120, 0.058, 0.102, 0.0058
    xs, ys = (-LX / 2 + P / 2, LX / 2 - P / 2), (-LY / 2 + P / 2, LY / 2 - P / 2)
    bm = bmesh.new()
    i = 0
    for x in xs:
        for y in ys:
            _tabua(bm, (P, P, HZ), (x, y, HZ / 2), 0.0012, 1, i)
            i += 1
    for z in (0.016, 0.058):                      # travessas das camas (laterais e pontas)
        for y in ys:
            _tabua(bm, (LX - 2 * P, 0.0035, 0.010), (0, y, z), i=i)
            i += 1
        for x in xs:
            _tabua(bm, (0.0035, LY - 2 * P, 0.010), (x, 0, z), i=i)
            i += 1
    for x in xs:                                  # cabeceiras de ripas e guarda das pontas
        for z in (0.033, 0.041, 0.084, 0.093):
            _tabua(bm, (0.003, LY - 2 * P, 0.0055), (x, 0, z), i=i)
            i += 1
    _tabua(bm, (LX - 2 * P, 0.003, 0.0055), (0, ys[1], 0.084), i=i)          # guarda de trás
    _tabua(bm, (LX - 2 * P, 0.003, 0.0055), (0, ys[1], 0.093), i=i + 1)
    _tabua(bm, (0.066, 0.003, 0.0055), (-LX / 2 + P + 0.033, ys[0], 0.084), i=i + 2)   # guarda da frente
    _tabua(bm, (0.066, 0.003, 0.0055), (-LX / 2 + P + 0.033, ys[0], 0.093), i=i + 3)
    ex, ey = LX / 2 - P - 0.018, ys[0] - 0.0045    # escada presa na frente, perto da coluna direita
    for dx in (-0.0105, 0.0105):
        _tabua(bm, (0.0036, 0.0036, 0.096), (ex + dx, ey, 0.048), 0.0008, 1, i + 4)
    for n, z in enumerate((0.012, 0.030, 0.048, 0.068, 0.084)):
        _tabua(bm, (0.021, 0.0032, 0.0028), (ex, ey, z), 0.0007, 1, i + 5 + n)
    obj_m = B.objeto('beliche_madeira', bm, madeira, ang=60)
    bm = bmesh.new()
    for z0, manta, dobrada in ((0.021, 'manta1', True), (0.063, 'manta2', False)):
        B.pintar(bm, B.anexar(bm, B.caixa(LX - 2 * P - 0.002, LY - 2 * P - 0.002, 0.0095, 0.003, 2),
                              lambda p, z=z0: p + Vector((0, 0, z + 0.0048))), CM['colchao'])
        B.pintar(bm, B.anexar(bm, B.caixa(0.017, 0.036, 0.0062, 0.0026, 2),
                              lambda p, z=z0: p + Vector((-LX / 2 + P + 0.013, 0, z + 0.0122))), CM['travesseiro'])
        if dobrada:
            for k in range(2):
                B.pintar(bm, B.anexar(bm, B.caixa(0.026, 0.038, 0.0030, 0.0013, 2),
                                      lambda p, z=z0, k=k: p + Vector((0.028, 0.002, z + 0.0109 + k * 0.0031))),
                         CM[manta])
        else:
            B.pintar(bm, B.anexar(bm, B.caixa(0.064, LY - 2 * P + 0.003, 0.0022, 0.0010, 2),
                                  lambda p, z=z0: p + Vector((0.020, 0, z + 0.0103))), CM[manta])
            B.pintar(bm, B.anexar(bm, B.caixa(0.008, LY - 2 * P + 0.003, 0.0034, 0.0016, 2),
                                  lambda p, z=z0: p + Vector((-0.012, 0, z + 0.0116))), CM['colchao'])
    return [obj_m, B.objeto('beliche_tecido', bm, tecido, ang=60)]


CK = {'latao': '#b58d4c', 'medalhao': '#c29b58', 'madeira': '#6a3d25'}


def _toro(bm, R, r, seg, segr, lugar):
    perfil = [(R + r * math.cos(2 * math.pi * k / segr), r * math.sin(2 * math.pi * k / segr)) for k in range(segr)]
    perfil.append(perfil[0])
    return B.torno(bm, perfil, seg, mapa=lugar)


def chave_quarto(mats):
    latao, madeira = mats('latao', 1.0, 0.35), mats('madeira', 0.0, 0.45)
    piv = Vector((0, 0, 0.104))
    bm_l, bm_m = bmesh.new(), bmesh.new()
    # Chave: pende da argola, ligeiramente para −X; anel no plano da câmera (XZ).
    rc = Matrix.Translation(piv) @ Matrix.Rotation(0.22, 4, 'Y') @ Matrix.Translation(-piv)
    em_pe = Matrix.Rotation(math.pi / 2, 4, 'X')
    kl = lambda p: rc @ (p + Vector((0, -0.003, 0)))  # noqa: E731
    f = _toro(bm_l, 0.0080, 0.0019, 20, 6, lambda p: kl(em_pe @ p + Vector((0, 0, 0.0885))))
    haste = [(0, 0.030), (0.0021, 0.030), (0.0021, 0.070), (0.0031, 0.0712), (0.0031, 0.0735), (0.0021, 0.0747),
             (0.0021, 0.0762), (0.0034, 0.0772), (0.0034, 0.0800), (0, 0.0806)]
    f += B.torno(bm_l, haste, 10, mapa=kl)
    dentes = [(0.0015, 0.0305), (0.0102, 0.0305), (0.0102, 0.0345), (0.0072, 0.0345), (0.0072, 0.0372),
              (0.0102, 0.0372), (0.0102, 0.0405), (0.0082, 0.0405), (0.0082, 0.0428), (0.0102, 0.0428),
              (0.0102, 0.0455), (0.0015, 0.0455)]
    f += B.placa(bm_l, dentes, 0.0021, 0.00035, 1, lambda p: kl(Vector((p.x, p.z - 0.00105, p.y))))
    B.pintar(bm_l, f, CK['latao'])
    rf = Matrix.Translation(piv) @ Matrix.Rotation(-0.2, 4, 'Y') @ Matrix.Translation(-piv)
    chaveiro(bm_l, bm_m, lambda q: rf @ (q + Vector((0.004, 0.003, 0))))
    # Argola ENFIADA no anel da chave e no olhal do chaveiro: o fio apoia no topo interno dos dois furos (dailies:
    # antes flutuava ~4 mm acima deles, solta). Plano vertical pelos dois pontos de apoio; raio 10 mm, fio 1 mm.
    pk = kl(Vector((0, 0, 0.0885 + 0.0061 - 0.0010)))
    pf = rf @ Vector((0.004, 0.003, 0.0932 + 0.0020 - 0.0010))
    d = pf - pk
    s = min(0.0095, d.xy.length / 2)
    ga = Matrix.Rotation(math.atan2(d.y, d.x), 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'X')
    centro = (pk + pf) / 2 + Vector((0, 0, math.sqrt(0.0100 ** 2 - s ** 2)))
    B.pintar(bm_l, _toro(bm_l, 0.0100, 0.0010, 22, 6, lambda p: centro + ga @ p), CK['latao'])
    return [B.objeto('chave_latao', bm_l, latao, ang=50), B.objeto('chave_madeira', bm_m, madeira, ang=60)]


def chaveiro(bm_l, bm_m, mapa, seg=18):
    """Chaveiro torneado no espaço dele (olhal em z 0,0932): olhal de latão, colarinho, bojo achatado (y × 0,72) e
    medalhão liso na frente. `mapa` leva ao lugar; usado pela `chave_quarto` e, reduzido, pelo `chaves_negocios`."""
    em_pe = Matrix.Rotation(math.pi / 2, 4, 'X')
    B.pintar(bm_l, _toro(bm_l, 0.0027, 0.0007, seg - 2, 6, lambda p: mapa(em_pe @ p + Vector((0, 0, 0.0932)))),
             CK['latao'])
    perfil = [(0, 0.0905), (0.0026, 0.0900), (0.0034, 0.0880), (0.0030, 0.0858), (0.0043, 0.0840),
              (0.0043, 0.0818), (0.0034, 0.0802), (0.0052, 0.0740), (0.0082, 0.0640), (0.0102, 0.0520),
              (0.0108, 0.0440), (0.0102, 0.0360), (0.0085, 0.0290), (0.0060, 0.0240), (0.0036, 0.0215),
              (0.0038, 0.0192), (0.0026, 0.0168), (0, 0.0160)]
    B.pintar(bm_m, B.torno(bm_m, perfil, seg, mapa=lambda p: mapa(Vector((p.x, p.y * 0.72, p.z)))), CK['madeira'])
    disco = [(0, 0.0009), (0.0050, 0.0009), (0.0056, 0.0004), (0.0056, 0), (0, 0)]
    B.pintar(bm_l, B.torno(bm_l, disco, seg - 2, mapa=lambda p: mapa(Vector((p.x, -0.0108 * 0.72 + 0.0006 - p.z,
                                                                             0.046 + p.y)))), CK['medalhao'])
