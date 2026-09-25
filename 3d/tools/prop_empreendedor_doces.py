"""E2: `bolo` (bolo de confeitaria com a fatia retirada, sobre boleira) e `brigadeiros` (doces finos em forminhas).

bolo: boleira de porcelana com pé alto (torno); bolo alto de um andar (diâmetro ≈ altura, como os bolos altos de
confeitaria) com cobertura de buttercream, topo de ganache com escorridos, rosetas de bico pitanga (torno com estrias
torcidas) e a fatia de 55° retirada virada para a câmera, mostrando três camadas de massa de chocolate e duas de
recheio. Materiais: cobertura/porcelana (rug 0,4) e massa/recheio (rug 0,8, dupla face).
brigadeiros: suporte de doces de dois andares em madeira torneada (bandejas com borda, haste com anel e pomo) e cinco
doces finos em forminhas plissadas; cada doce com a sua casca (granulado, pistache, coco, cacau) em relevo leve e cor
por vértice. Vertical para caber na faixa livre (a tábua deitada media 0,15 da cabeça). Materiais: chocolate
(rug 0,5) e papel/madeira (rug 0,85).
"""
import math

import bmesh
from mathutils import Vector

import prop_empreendedor_base as B

CB = {'porcelana': '#e6e6e3', 'creme': '#e3d2b4', 'ganache': '#3a2219', 'massa': '#5b3626', 'recheio': '#dcc7a2',
      'roseta': '#e8dac0'}


def bolo(mats):
    cobertura, massa = mats('cobertura', 0.0, 0.4), mats('massa', 0.0, 0.8, double=True)
    z0, R, H = 0.0314, 0.028, 0.052
    ab = math.radians(55)
    a0 = -math.pi / 2 + ab / 2                      # fatia retirada centrada em −Y (câmera)
    arco = 2 * math.pi - ab
    SEG = 24

    def escorrido(a):
        k = int((a - a0) / arco * SEG * 0.5)
        return 0.004 + 0.014 * B.hash01(k, 3.1) ** 2

    bm = bmesh.new()
    boleira = [(0, 0), (0.022, 0), (0.0232, 0.0012), (0.022, 0.0026), (0.010, 0.0042), (0.0055, 0.008),
               (0.0048, 0.022), (0.0068, 0.0265), (0.034, 0.0292), (0.0385, 0.0305), (0.0372, 0.0318), (0, 0.0314)]
    B.pintar(bm, B.torno(bm, boleira, 24), CB['porcelana'])
    zs = [z0 + H * i / 7 for i in range(8)]
    perfil = [(0, z0), (R - 0.0012, z0), (R + 0.0013, z0 + 0.0013), (R, z0 + 0.0028)] + \
             [(R, z) for z in zs[1:-1]] + [(R - 0.0006, z0 + H - 0.0004), (R - 0.0025, z0 + H), (0, z0 + H)]

    def raio(r, z, a):
        return r + (0.0006 if z > z0 + H - escorrido(a) and z0 + 0.003 < z < z0 + H - 0.001 else 0.0)

    fs = B.torno(bm, perfil, SEG, a0, arco, raio)

    def cor(f):
        c = f.calc_center_median()
        a = math.atan2(c.y, c.x)
        a = a if a >= a0 else a + 2 * math.pi
        topo = c.z > z0 + H - 0.0008 or c.z > z0 + H - escorrido(a)
        return CB['ganache'] if topo and c.z > z0 + 0.003 else CB['creme']
    B.pintar(bm, fs, cor)
    # Rosetas de bico pitanga sobre a borda do topo (não sobre a fatia retirada).
    perfil_r = [(0, 0), (0.0034, 0), (0.0037, 0.0013), (0.0027, 0.0030), (0.0014, 0.0044), (0, 0.0053)]
    for i in range(6):
        a = a0 + arco * (i + 0.5) / 6
        c = Vector((math.cos(a) * (R - 0.0048), math.sin(a) * (R - 0.0048), z0 + H - 0.0006))
        giro = B.hash01(i, 7) * 6.28
        fs = B.torno(bm, perfil_r, 10, raio=lambda r, z, t, g=giro: r * (1 + 0.24 * math.cos(8 * t + g + 900 * z)),
                     mapa=lambda p, c=c: p + c)
        B.pintar(bm, fs, CB['roseta'])
    obj_cob = B.objeto('bolo_cobertura', bm, cobertura, ang=45)
    # Faces do corte: camadas de massa e recheio, casca de creme por fora, ganache no topo.
    bandas = [(0.0135, 'massa'), (0.0045, 'recheio'), (0.0130, 'massa'), (0.0045, 'recheio'), (0.0125, 'massa'),
              (0.0040, 'ganache')]
    rs = [0, 0.010, 0.020, R - 0.0018, R]
    bm = bmesh.new()
    for a in (a0, a0 + arco):
        d = Vector((math.cos(a), math.sin(a), 0))
        z = z0
        for alt, nome in bandas:
            for r0, r1 in zip(rs, rs[1:]):
                q = [d * r0 + Vector((0, 0, z)), d * r1 + Vector((0, 0, z)), d * r1 + Vector((0, 0, z + alt)),
                     d * r0 + Vector((0, 0, z + alt))]
                f = bm.faces.new([bm.verts.new(p) for p in q])
                casca = r0 >= R - 0.0019 and nome != 'ganache'
                base = CB['creme'] if casca else CB[nome]
                sombra = 0.9 + 0.1 * B.hash01(r0 * 900, z * 900)
                B.pintar(bm, [f], base if nome != 'massa' or casca else _escurece(base, sombra))
            z += alt
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    return [obj_cob, B.objeto('bolo_massa', bm, massa, ang=30, normais=False)]


def fatia():
    """Volta 4 (movimento): a fatia que falta no `bolo`, com as mesmas camadas, NO LUGAR dela (dentro do vão).
    Devolve (bm_cobertura, bm_massa) para juntar às malhas do bolo; o movimento a assenta no prato. Mesmos números
    do `bolo` (z0, R, H, vão de 55° centrado em −Y, perfil, bandas); uma roseta no topo, sobre a borda."""
    z0, R, H, ab = 0.0314, 0.028, 0.052, math.radians(55)
    a0 = -math.pi / 2 - ab / 2
    zs = [z0 + H * i / 7 for i in range(8)]
    perfil = [(0, z0), (R - 0.0012, z0), (R + 0.0013, z0 + 0.0013), (R, z0 + 0.0028)] + \
             [(R, z) for z in zs[1:-1]] + [(R - 0.0006, z0 + H - 0.0004), (R - 0.0025, z0 + H), (0, z0 + H)]
    escorre = [0.004 + 0.014 * B.hash01(k, 8.3) ** 2 for k in range(4)]

    def raio(r, z, a):
        e = escorre[min(3, int((a - a0) / ab * 4))]
        return r + (0.0006 if z > z0 + H - e and z0 + 0.003 < z < z0 + H - 0.001 else 0.0)

    bm = bmesh.new()
    fs = B.torno(bm, perfil, 6, a0, ab, raio)

    def cor(f):
        c = f.calc_center_median()
        e = escorre[min(3, max(0, int((math.atan2(c.y, c.x) - a0) / ab * 4)))]
        return CB['ganache'] if c.z > z0 + H - max(0.0008, e) and c.z > z0 + 0.003 else CB['creme']
    B.pintar(bm, fs, cor)
    perfil_r = [(0, 0), (0.0034, 0), (0.0037, 0.0013), (0.0027, 0.0030), (0.0014, 0.0044), (0, 0.0053)]
    c = Vector((0, -(R - 0.0048), z0 + H - 0.0006))
    B.pintar(bm, B.torno(bm, perfil_r, 10, raio=lambda r, z, t: r * (1 + 0.24 * math.cos(8 * t + 2.0 + 900 * z)),
                         mapa=lambda p: p + c), CB['roseta'])
    bm_m = bmesh.new()
    bandas = [(0.0135, 'massa'), (0.0045, 'recheio'), (0.0130, 'massa'), (0.0045, 'recheio'), (0.0125, 'massa'),
              (0.0040, 'ganache')]
    rs = [0, 0.010, 0.020, R - 0.0018, R]
    for a in (a0, a0 + ab):
        d, z = Vector((math.cos(a), math.sin(a), 0)), z0
        for alt, nome in bandas:
            for r0, r1 in zip(rs, rs[1:]):
                q = [d * r0 + Vector((0, 0, z)), d * r1 + Vector((0, 0, z)), d * r1 + Vector((0, 0, z + alt)),
                     d * r0 + Vector((0, 0, z + alt))]
                f = bm_m.faces.new([bm_m.verts.new(p) for p in q])
                casca = r0 >= R - 0.0019 and nome != 'ganache'
                base = CB['creme'] if casca else CB[nome]
                sombra = 0.9 + 0.1 * B.hash01(r0 * 700, z * 700)
                B.pintar(bm_m, [f], base if nome != 'massa' or casca else _escurece(base, sombra))
            z += alt
    bmesh.ops.remove_doubles(bm_m, verts=bm_m.verts, dist=1e-7)
    return bm, bm_m



def _escurece(hexcor, k):
    h = hexcor.lstrip('#')
    return '#' + ''.join('%02x' % int(int(h[i:i + 2], 16) * k) for i in (0, 2, 4))


CG = {'madeira': '#8a6040', 'haste': '#6b4a32', 'forminha': '#ebe4d6'}
CASCAS = [('#2a1911', '#3f281b', 0.07), ('#7f8b55', '#5f6a3b', 0.06), ('#efe8da', '#d9ceb9', 0.08),
          ('#5a3928', '#4a2e20', 0.015), ('#2a1911', '#452c1d', 0.07), ('#efe8da', '#d9ceb9', 0.08)]
ANDAR = [(0.0, 0.0335), (0.050, 0.0235)]            # (altura, raio) das bandejas
DOCES = [(0, 0.0205, -2.1), (0, 0.0205, -0.55), (0, 0.0205, 1.6), (1, 0.0125, math.pi),
         (1, 0.0125, 0.0)]                          # (andar, raio, ângulo); cinco doces (orçamento de 60 kB)


def brigadeiros(mats):
    chocolate, papel = mats('chocolate', 0.0, 0.5), mats('papel', 0.0, 0.85)
    bm_p, bm_c = bmesh.new(), bmesh.new()
    for z, r in ANDAR:
        bandeja = [(0, z), (r, z), (r + 0.0014, z + 0.0012), (r + 0.0014, z + 0.0040), (r, z + 0.0042),
                   (r - 0.0010, z + 0.0022), (0, z + 0.0022)]
        B.pintar(bm_p, B.torno(bm_p, bandeja, 20), CG['madeira'])
    haste = [(0, 0.002), (0.0022, 0.002), (0.0022, 0.026), (0.0034, 0.029), (0.0022, 0.032), (0.0022, 0.074),
             (0.0030, 0.0755), (0.0018, 0.077), (0.0042, 0.0815), (0.0038, 0.0855), (0.0016, 0.0880), (0, 0.0884)]
    B.pintar(bm_p, B.torno(bm_p, haste, 12), CG['haste'])
    forminha = [(0, 0), (0.0074, 0), (0.0104, 0.0085), (0.0100, 0.0088), (0.0071, 0.0005), (0, 0.0005)]
    for i, (andar, rd, ang) in enumerate(DOCES):
        c = Vector((rd * math.cos(ang), rd * math.sin(ang), ANDAR[andar][0] + 0.0022))
        rot = B.hash01(i, 2) * 6.28
        fs = B.torno(bm_p, forminha, 14,
                     raio=lambda r, z, a, g=rot: r * (1 + 0.07 * math.cos(7 * a + g) * min(1.0, r / 0.0074)),
                     mapa=lambda p, c=c: p + c)
        B.pintar(bm_p, fs, CG['forminha'])
        c1, c2, amp = CASCAS[i]
        rs = 0.0093
        perfil = [(rs * math.sin(math.pi * k / 6), -rs * 0.9 * math.cos(math.pi * k / 6)) for k in range(7)]
        perfil = [(0 if abs(r) < 1e-6 else r, z) for r, z in perfil]
        fs = B.torno(bm_c, perfil, 9,
                     raio=lambda r, z, a, n=i: r * (1 + amp * (B.hash01(round(z * 4000), round(a * 30), n) - 0.5)),
                     mapa=lambda p, c=c: p + c + Vector((0, 0, 0.0083 * 0.9 + 0.0012)))
        B.pintar(bm_c, fs, lambda f, n=i: c1 if B.hash01(*(f.calc_center_median() * 3000), n) > 0.45 else c2)
    return [B.objeto('brig_doces', bm_c, chocolate, ang=60, normais=False),
            B.objeto('brig_suporte', bm_p, papel, ang=70)]
