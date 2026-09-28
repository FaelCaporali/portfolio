"""Base, corpo, tampa e placa do robô da vida `ai` (quadro local do robô, convenção glb, mm reais → `R`).

Robô de mesa de kit de desenvolvimento: base de alumínio anodizado grafite com pés de borracha e cabo USB-C por trás;
corpo em caixa de alumínio (parede de 2 mm, cantos de raio 4, chanfro de 1,6 mm) com parafusos aparentes; janela na
lateral ESQUERDA do robô (+x local, a que a câmera vê) coberta pela tampa de policarbonato fumê em rebaixo de 0,8 mm e
presa por 4 parafusos; a placa (chips, blindagem, conector, barra de pinos, cristal, fita flat) de pé atrás da janela;
servo de giro (tamanho SG90) encaixado no tampo pelas abas, com o eixo no centro do corpo.
"""
import math

from mathutils import Vector

import prop_ai_geo as G
from prop_ai_geo import R, T, rot
from prop_vela_base import tubo_pts

# ----------------------------------------------------------------------------------------------- medidas (mm reais)
PE_H, PE_D = 2.5, 10.0
BASE = (78.0, 5.0, 66.0)                     # largura (x), espessura (y), profundidade (z)
Y_BASE = PE_H + BASE[1]                      # topo da base = pé do corpo
CORPO = (60.0, 28.0, 48.0)                   # 28 de altura: cabeça ≥ 12 / 8 / 4 px abaixo do lábio na faixa toda
Y_TOPO = Y_BASE + CORPO[1]                   # tampo do corpo
PAREDE = 2.0
JANELA = (32.0, 15.5)                        # z × y, na lateral +x
TAMPA = (38.0, 22.0, 1.5)                    # z × y × espessura
REBAIXO = 0.8
Y_MEIO = Y_BASE + CORPO[1] / 2
# servo SG90 (datasheet): corpo 22,8 × 12,2 × 22,7; abas 32,2 × 2,5 a 15,9 do fundo; eixo a 5,9 da ponta; ressalto
# Ø11,8 × 4; estria Ø4,8 × 3
SERVO = dict(c=22.8, l=12.2, a=22.7, aba_c=32.2, aba_e=2.5, aba_y=15.9, eixo=5.9, ress_d=11.8, ress_a=4.0,
             estria_d=4.8, estria_a=3.0)
Y_SERVO0 = Y_TOPO - SERVO['aba_y']           # fundo do servo de giro (abas apoiadas no tampo)
Y_EIXO_GIRO = Y_SERVO0 + SERVO['a'] + SERVO['ress_a'] + SERVO['estria_a']   # topo da estria = pé do chifre
Y_USB = Y_BASE + 7.0
C = {}                                       # cores, preenchidas por prop_ai.py (MT.COR)


def _p(x, y, z):
    return T(R(x), R(y), R(z))


def _parafuso(P, M, d=3.8, h=1.2, reg='aco'):
    """Parafuso de cabeça abaulada com o sextavado escuro; M leva o eixo +y ao lugar (y 0 = face apoiada)."""
    P.add(G.parafuso(d, h), M, reg, C['aco'], dens=7.9, rotulo='parafuso')
    P.add(G.sextavado(d * 0.42, 0.25), M @ T(0, R(h) - R(0.2), 0), 'plastico', C['sextavado'])


def servo(P, M, cor, com_estria=True):
    """Servo SG90 no quadro do servo: fundo em y 0, comprimento em x (eixo a `eixo` mm da ponta −x, em x 0), largura
    em z, eixo de saída +y. Corpo, abas com 2 parafusos, ressalto, ressalto menor, estria."""
    s = SERVO
    x0 = -s['eixo']
    cx = x0 + s['c'] / 2
    P.add(G.caixa(R(s['c']), R(s['a']), R(s['l']), 0, R(0.6), 2), M @ _p(cx, 0, 0), 'plastico', cor, dens=1.3,
          rotulo='servo')
    P.add(G.caixa(R(s['aba_c']), R(s['aba_e']), R(s['l']), 0, R(0.4), 2), M @ _p(cx, s['aba_y'], 0), 'plastico', cor)
    for sx in (-1, 1):
        _parafuso(P, M @ _p(cx + sx * (s['aba_c'] / 2 - 2.4), s['aba_y'] + s['aba_e'], 0), d=3.4, h=1.0)
    y1 = s['a']
    P.add(G.cilindro(R(s['ress_d'] / 2), R(s['ress_a']), R(0.5)), M @ _p(0, y1, 0), 'plastico', cor)
    P.add(G.cilindro(R(2.8), R(s['ress_a'] - 1), R(0.4), 16), M @ _p(7.0, y1, 0), 'plastico', cor)
    if com_estria:
        P.add(G.cilindro(R(s['estria_d'] / 2), R(s['estria_a']), R(0.3), 18), M @ _p(0, y1 + s['ress_a'], 0),
              'aco', C['aco'])


# ---------------------------------------------------------------------------------------------------------- base
def base(P, trajeto_cabo):
    """Placa da base, 4 pés, 4 parafusos do corpo e o cabo USB-C (conector sobremoldado + cabo até sumir na mesa)."""
    w, h, d = BASE
    P.add(G.caixa(R(w), R(h), R(d), R(10), R(1.0), 3), _p(0, PE_H, 0), 'anodizado', C['grafite'], dens=2.7,
          rotulo='base')
    for sx in (-1, 1):
        for sz in (-1, 1):
            P.add(G.cilindro(R(PE_D / 2), R(PE_H + 0.3), R(0.6)), _p(sx * 29, 0, sz * 23), 'borracha', C['pe'],
                  dens=1.2, rotulo='pé')
            _parafuso(P, _p(sx * 32.5, Y_BASE, sz * 26.5), d=5.0, h=1.6)
    zc = -CORPO[2] / 2 - 0.2                  # face de trás do corpo
    P.add(G.caixa(R(8.3), R(2.5), R(6.5), R(1.1), R(0.2)), _p(0, Y_USB - 1.25, zc + 3.0), 'aco', C['usb'])
    P.add(G.caixa(R(12.5), R(6.6), R(17.0), R(3.0), R(0.9), 3), _p(0, Y_USB - 3.3, zc - 8.5), 'borracha',
          C['cabo'], dens=1.2, rotulo='conector USB-C')
    P.add(G.caixa(R(7.0), R(5.0), R(6.0), R(2.4), R(0.6), 3), _p(0, Y_USB - 2.5, zc - 19.0), 'borracha', C['cabo'])
    pts = [Vector(p) for p in trajeto_cabo]
    P.bm_tubo = tubo_pts(P.bm, pts, R(2.1), seg=10)
    for f in P.bm_tubo:
        f[P.reg] = G.MT.REGIOES['borracha']
        for lp in f.loops:
            lp[P.col] = G.MT.lin4(C['cabo'])


def trajeto_cabo(dir_mundo_local):
    """Cabo saindo do conector para trás, descendo à mesa e seguindo `dir_mundo_local` (direção no plano da mesa,
    quadro local) até afundar abaixo da mesa (lá o Fade é 0). Pontos em metros, quadro local."""
    import numpy as np

    def bez(p0, p1, p2, p3, n):
        t = np.linspace(0, 1, n)[1:, None]
        return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3
    v = lambda *c: np.array([R(k) for k in c])                                  # noqa: E731
    d = np.array((dir_mundo_local[0], 0.0, dir_mundo_local[1]))
    z0 = -CORPO[2] / 2 - 0.2 - 22.0
    a = v(0, Y_USB, z0)
    c = v(0, 2.2, z0 - 22)                     # deitado na mesa (raio do cabo 2,1 mm)
    e = c + d * R(34)
    f = e + d * R(22) + v(0, -24, 0)           # afunda na borda: some pelo Fade
    p = [a] + list(bez(a, a + v(0, 0, -9), c + v(0, 0, 10), c, 9))
    p += list(bez(c, c + v(0, 0, -12), e - d * R(12), e, 11))
    p += list(bez(e, e + d * R(10), f + v(0, 12, 0) - d * R(4), f, 9))
    return [tuple(float(k) for k in q) for q in p]


# --------------------------------------------------------------------------------------------------------- corpo
def corpo(P):
    """Casca de alumínio (booleana Exact: miolo, janela, rebaixo da tampa, furo do servo, porta USB-C; chanfro),
    parafusos da frente, de trás e do tampo, e o servo de giro."""
    w, h, d = CORPO
    fora = G.caixa(R(w), R(h), R(d), R(4), R(1.6), 3)
    fora.transform(_p(0, Y_BASE, 0))
    miolo = G.caixa(R(w - 2 * PAREDE), R(h - 2 * PAREDE), R(d - 2 * PAREDE), R(2.5))
    miolo.transform(_p(0, Y_BASE + PAREDE, 0))
    lado = rot('z', -90)                      # prisma em +y → +x; o 1º eixo do contorno vira −y
    jan = G.prisma(G.sec_ret(R(JANELA[1]), R(JANELA[0]), R(2.5)), R(6))
    jan.transform(_p(w / 2 - 4, Y_MEIO, 0) @ lado)
    reb = G.prisma(G.sec_ret(R(TAMPA[1] + 0.6), R(TAMPA[0] + 0.6), R(3.8)), R(3))
    reb.transform(_p(w / 2 - REBAIXO, Y_MEIO, 0) @ lado)
    s = SERVO
    furo = G.caixa(R(s['c'] + 0.4), R(8), R(s['l'] + 0.4))
    furo.transform(_p(-s['eixo'] + s['c'] / 2, Y_TOPO - 5, 0))
    usb = G.prisma(G.sec_ret(R(3.4), R(9.2), R(1.6)), R(6))
    usb.transform(_p(0, Y_USB, -d / 2 - 3) @ rot('z', 90) @ rot('x', 90))
    casca = G.booleana(fora, [miolo, jan, reb, furo, usb], bev=R(0.45), seg=2)
    P.add(casca, T(), 'anodizado', C['grafite'], dens=2.7, rotulo='casca do corpo')
    frente = rot('x', 90)                     # eixo +y → +z
    for sx in (-1, 1):
        for y in (Y_BASE + 5, Y_TOPO - 5):
            _parafuso(P, _p(sx * (w / 2 - 5), y, d / 2) @ frente)
        _parafuso(P, _p(sx * (w / 2 - 5), Y_MEIO, -d / 2) @ rot('x', -90))
        for sz in (-1, 1):
            _parafuso(P, _p(sx * (w / 2 - 5), Y_TOPO, sz * (d / 2 - 5)))
    n0 = len(P.bm.faces)
    servo(P, _p(0, Y_SERVO0, 0), C['servo'])
    P.marcar(n0, 2)                           # servo de giro: fora da medida suporte × corpo (o chifre encaixa nele)
    P.pontos['eixo_giro'] = (0.0, R(Y_EIXO_GIRO), 0.0)


# --------------------------------------------------------------------------------------------------------- tampa
def tampa(P):
    """Policarbonato fumê (material 1) no rebaixo da lateral +x e os 4 parafusos (material 0, ai_rigido)."""
    zt, yt, e = TAMPA
    x0 = CORPO[0] / 2 - REBAIXO
    placa = G.prisma(G.sec_ret(R(yt), R(zt), R(3.5)), R(e), R(0.35), 2)
    P.add(placa, _p(x0, Y_MEIO, 0) @ rot('z', -90), 'vidro', '#ffffff', dens=1.2, rotulo='tampa', mat=1)
    for sy in (-1, 1):
        for sz in (-1, 1):
            _parafuso(P, _p(x0 + e, Y_MEIO + sy * (yt / 2 - 3), sz * (zt / 2 - 3)) @ rot('z', -90), d=3.4, h=1.0)
    P.pontos['encaixe_tampa'] = (R(x0), R(Y_MEIO), 0.0)


# --------------------------------------------------------------------------------------------------------- placa
def placa(P):
    """Placa de pé atrás da janela (face dos componentes para +x): blindagem do módulo, chip, conector da fita flat,
    barra de pinos 2 × 5 com pinos dourados, cristal, passivos, bornes dourados na borda, 4 parafusos e a fita flat
    subindo do conector para o servo de giro."""
    xp = CORPO[0] / 2 - PAREDE - 8.0          # face de trás da placa (pinos a 1,6 mm da tampa)
    pz, py, pe = 40.0, 22.0, 1.6
    M0 = _p(xp, Y_MEIO, 0) @ rot('z', -90)    # quadro da placa: +y local = +x do robô; x local = −y do robô
    P.add(G.caixa(R(py), R(pe), R(pz), R(1.0), R(0.2)), M0, 'pcb', C['pcb'], dens=1.9, rotulo='placa')

    def comp(yy, zz, dy, dz, alt, reg, cor, bev=0.15, dens=None):
        """Componente em (y, z) do robô relativos ao centro da placa, tamanho dy × dz, altura alt para +x."""
        P.add(G.caixa(R(dy), R(alt), R(dz), 0, R(bev)), M0 @ _p(-yy, pe, zz), reg, C[cor], dens=dens)
    comp(1.5, -8.0, 12.0, 16.0, 2.4, 'aco', 'blindagem', 0.3, 7.9)          # módulo com blindagem
    comp(-4.0, 9.0, 6.0, 6.0, 0.9, 'plastico', 'chip', 0.1)                 # MCU QFN
    comp(6.0, 8.0, 3.0, 13.0, 2.6, 'nylon', 'conector', 0.2)                # conector da fita flat
    comp(-7.5, -9.0, 5.0, 12.7, 2.5, 'plastico', 'chip', 0.2)               # barra de pinos 2 × 5
    for i in range(5):
        for j in range(2):
            comp(-8.77 + j * 2.54, -14.08 + i * 2.54, 0.64, 0.64, 6.0, 'aco', 'ouro', 0.05)
    comp(-3.0, 3.0, 2.5, 3.2, 0.8, 'aco', 'blindagem', 0.1)                 # cristal
    for k, (yy, zz) in enumerate(((-9.5, 4.0), (-9.5, 7.0), (4.0, 16.0), (1.0, 16.5), (-1.0, 17.0), (9.5, -14.0))):
        comp(yy, zz, 0.8, 1.6, 0.5, 'plastico', 'fita' if k % 2 else 'chip', 0.05)
    for sy in (-1, 1):
        for sz in (-1, 1):
            _parafuso(P, M0 @ _p(sy * (py / 2 - 2.2), pe, sz * (pz / 2 - 2.2)), d=3.0, h=0.9)
    # fita flat: sai do conector (alto), faz a curva para +x e sobe até o teto, entrando para o servo de giro
    x1 = xp + pe + 2.6
    teto = Y_TOPO - PAREDE - 0.6
    pts = [(x1, Y_MEIO + 7.5), (x1 + 2.0, Y_MEIO + 9.0), (x1 + 1.0, teto - 1.0), (x1 - 3.0, teto),
           (17.4, teto - 0.4)]
    fita = []
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        for t in (0.0, 0.25, 0.5, 0.75):
            fita.append(((xa + (xb - xa) * t), (ya + (yb - ya) * t)))
    fita.append(pts[-1])
    bm = G.bmesh.new()
    V = [[bm.verts.new((R(x), R(y), R(z))) for z in (3.0, 13.0)] for x, y in fita]
    for A, B in zip(V, V[1:]):
        bm.faces.new((A[0], B[0], B[1], A[1]))
    G.bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=R(0.3))
    P.add(bm, T(), 'plastico', C['fita'])
    P.pontos['encaixe_placa'] = (R(xp), R(Y_MEIO), 0.0)
