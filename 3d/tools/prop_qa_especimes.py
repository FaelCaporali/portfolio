"""E7: os 8 espécimes da caixa entomológica, em LOD (≈ 250–400 tri cada), com FORMAS de inseto diferentes: besouro
alongado (elaterídeo), besouro vermelho (o do bug), besouro-rinoceronte com chifre, percevejo-escudo (vermelho e
preto), joaninha (vermelho-alaranjado com pintas), gorgulho com rostro, formiga (cabeça, mesossoma, pecíolo e gáster)
e mosca (olhos grandes, asas abertas). Três vermelhos; os outros em cores dessaturadas.

Local de cada espécime (glb): frente +Z, dorso +Y, base ventral perto de y = 0. `construir` devolve o ponto do
alfinete (no TÓRAX, em cima), a faixa z do tórax (para a prova) e a altura do dorso no alfinete.
"""
import math

import numpy as np

import prop_qa_util as U

PRETO = '#121214'


def _pernas(m, raizes, comp, ang, esp=1.0, cor=PRETO):
    """6 pernas de 4 pontos (coxa, joelho, tornozelo, ponta), abertas em pose de coleção."""
    up = np.array((0, 1.0, 0))
    for s in (1, -1):
        for k in range(3):
            r = np.array(raizes[k]) * (s, 1, 1)
            a = math.radians(ang[k])
            hd = np.array((s * math.cos(a), 0, math.sin(a)))
            L = np.array(comp[k])
            kn = r + (hd * math.cos(0.38) + up * math.sin(0.38)) * L[0]
            an = kn + (hd * math.cos(-1.0) + up * math.sin(-1.0)) * L[1]
            tp = an + (hd * math.cos(-0.2) + up * math.sin(-0.2)) * L[2]
            m.tubo(np.array([r, kn, an, tp]), np.array((0.00055, 0.00046, 0.00034, 0.00016)) * esp, seg=3,
                   cel='pata', cor=cor, tampa=False)


def _antenas(m, base, rel, r0, cor=PRETO, clava=0.0):
    for s in (1, -1):
        b = np.array(base) * (s, 1, 1)
        P = [b] + [b + np.array(q) * (s, 1, 1) for q in rel]
        rr = np.linspace(r0, r0 * 0.7, len(P))
        rr[-1] += clava
        m.tubo(np.array(P), rr, seg=3, cel='pata', cor=cor, tampa=False)


def _elitros(m, c, semi, laca, borda, manchas=()):
    """Domo único dos élitros com a sutura escura (e pintas, se houver)."""
    def cor(P):
        q = P - np.array(c)
        base = np.where((q[..., 1] > 0.0004)[..., None], np.array(U.lin(laca)), np.array(U.lin(borda)))
        sut = (np.abs(q[..., 0]) < 0.0006) & (q[..., 1] > semi[1] * 0.4)
        pinta = np.zeros(q.shape[:-1], bool)
        for x, z, r in manchas:
            pinta |= (np.abs(q[..., 0]) - x) ** 2 + (q[..., 2] - z) ** 2 < r * r
        return np.where((sut | pinta)[..., None] & (q[..., 1] > 0)[..., None], np.array(U.lin('#101012')), base)
    m.elipsoide(c, semi, 5, 10, ey=2.2, cel='especime', cor=cor)


def besouro(m, laca, borda, ax=0.0100, az=0.0120, H=0.0085, pron=(0.0072, 0.0038, 0.0038), antena=1.0,
            chifre=0.0, rostro=0.0, manchas=(), cor_pron=PRETO):
    ze = -0.0008 - az * 0.85
    _elitros(m, (0, 0.0010, ze), (ax, H, az), laca, borda, manchas)
    m.elipsoide((0, 0.0026, 0.0022), pron, 3, 8, ex=2.4, ey=2.3, cel='quitina', cor=cor_pron)
    hz = 0.0022 + pron[2] + 0.0014
    m.elipsoide((0, 0.0022, hz), (0.0038, 0.0026, 0.0026), 3, 6, cel='quitina', cor=PRETO)
    if chifre:                                                      # besouro-rinoceronte
        m.tubo(np.array([(0, 0.0030, hz + 0.0012), (0, 0.0060 * chifre, hz + 0.0045 * chifre),
                         (0, 0.0105 * chifre, hz + 0.0048 * chifre), (0, 0.0125 * chifre, hz + 0.0025 * chifre)]),
               np.array((0.0013, 0.0010, 0.0006, 0.0002)), seg=5, cel='quitina', cor=PRETO)
        m.tubo(np.array([(0, 0.0055, 0.0030), (0, 0.0082, 0.0046), (0, 0.0090, 0.0060)]),
               np.array((0.0012, 0.0007, 0.0002)), seg=4, cel='quitina', cor=PRETO)
    base_ant = (0.0026, 0.0026, hz + 0.0018)
    if rostro:                                                      # gorgulho: rostro longo e antenas cotoveladas
        m.tubo(np.array([(0, 0.0022, hz + 0.0016), (0, 0.0016, hz + 0.0060 * rostro),
                         (0, 0.0002, hz + 0.0092 * rostro)]), np.array((0.0010, 0.0008, 0.0006)), seg=5,
               cel='quitina', cor=PRETO)
        base_ant = (0.0007, 0.0014, hz + 0.0055 * rostro)
        _antenas(m, base_ant, [(0.0022, 0.0012, 0.0008), (0.0045, 0.0010, 0.0038)], 0.00030, clava=0.0003)
    else:
        a = antena
        _antenas(m, base_ant, [(0.0030 * a ** 0.8, 0.0012, 0.0042 * a), (0.0060 * a ** 0.8, 0.0012, 0.0080 * a),
                               (0.0080 * a ** 0.8, 0.0010, 0.0098 * a)], 0.00032, clava=0.00018)
    _pernas(m, ((0.0026, 0.0004, 0.0030), (0.0030, -0.0002, -0.0004), (0.0034, -0.0004, -0.0036)),
            ((0.0050, 0.0056, 0.0038), (0.0048, 0.0054, 0.0038), (0.0056, 0.0064, 0.0042)), (48, -4, -40))
    return (0.0010, 0.0026 + pron[1], 0.0022), (-0.0045, 0.0022 + pron[2] + 0.0005)


def percevejo(m, cor='#9c2420', marca=PRETO):
    """Percevejo-escudo: corpo chato em pentágono (ombros largos, ponta), escutelo triangular preto, membrana escura."""
    c, semi = np.array((0, 0.0016, -0.0030)), (0.0086, 0.0028, 0.0110)

    def forma(P):
        t = (P[:, 2] / semi[2] + 1) / 2
        P[:, 0] *= np.interp(t, [0, 0.35, 0.72, 0.86, 1.0], [0.16, 0.72, 1.0, 0.92, 0.55])
        return P

    def pinta(P):
        q = P - c
        t = (q[..., 2] / semi[2] + 1) / 2
        escut = (np.abs(q[..., 0]) < (t - 0.28) * 0.012) & (t < 0.70) & (t > 0.28)
        membrana = t < 0.14
        faixa = (t > 0.80) & (np.abs(q[..., 0]) < 0.0022)
        esc = (escut | membrana | faixa) & (q[..., 1] > 0)
        return np.where(esc[..., None], np.array(U.lin(marca)), np.array(U.lin(cor)))
    m.elipsoide(c, semi, 5, 10, ex=2.0, ey=2.6, forma=forma, cel='especime', cor=pinta)
    m.elipsoide((0, 0.0015, 0.0086), (0.0022, 0.0012, 0.0024), 3, 6, cel='quitina', cor=marca)
    _antenas(m, (0.0014, 0.0016, 0.0100), [(0.0020, 0.0006, 0.0035), (0.0048, 0.0008, 0.0068),
                                          (0.0070, 0.0006, 0.0085)], 0.00028)
    _pernas(m, ((0.0030, 0.0002, 0.0040), (0.0036, -0.0002, 0.0005), (0.0040, -0.0004, -0.0028)),
            ((0.0046, 0.0050, 0.0036), (0.0046, 0.0052, 0.0036), (0.0052, 0.0060, 0.0040)), (50, -2, -38))
    return (0.0012, 0.0016 + 0.0026, 0.0038), (-0.0040, 0.0075)


def formiga(m, cor='#3b2118'):
    """Formiga: cabeça, mesossoma estreito (tórax), pecíolo, gáster; antenas cotoveladas; pernas longas."""
    m.elipsoide((0, 0.0022, 0.0078), (0.0024, 0.0019, 0.0024), 3, 8, cel='quitina', cor=cor)
    m.elipsoide((0, 0.0024, 0.0022), (0.0014, 0.0016, 0.0034), 4, 8, cel='quitina', cor=cor)
    m.elipsoide((0, 0.0022, -0.0020), (0.0008, 0.0012, 0.0008), 3, 6, cel='quitina', cor=cor)
    m.elipsoide((0, 0.0024, -0.0064), (0.0032, 0.0027, 0.0040), 4, 10, cel='quitina', cor='#1c120e')
    _antenas(m, (0.0012, 0.0030, 0.0094), [(0.0012, 0.0022, 0.0030), (0.0048, 0.0018, 0.0060),
                                          (0.0062, 0.0014, 0.0072)], 0.00026, cor=cor)
    _pernas(m, ((0.0012, 0.0012, 0.0040), (0.0013, 0.0010, 0.0020), (0.0013, 0.0010, 0.0002)),
            ((0.0064, 0.0068, 0.0046), (0.0062, 0.0070, 0.0048), (0.0070, 0.0078, 0.0052)), (45, -8, -42),
            esp=0.8, cor=cor)
    return (0.0006, 0.0040, 0.0022), (-0.0012, 0.0056)


def mosca(m):
    """Mosca: tórax, abdome com faixas, olhos compostos vermelho-escuros grandes, 2 asas abertas."""
    m.elipsoide((0, 0.0028, 0.0010), (0.0030, 0.0027, 0.0034), 3, 8, cel='quitina', cor='#343436')

    def faixas(P):
        b = ((P[..., 2] + 0.02) / 0.0018) % 1 < 0.35
        return np.where(b[..., None], np.array(U.lin('#1b1b1c')), np.array(U.lin('#4a4846')))
    m.elipsoide((0, 0.0022, -0.0055), (0.0033, 0.0021, 0.0045), 4, 8, cel='quitina', cor=faixas)
    m.elipsoide((0, 0.0026, 0.0055), (0.0026, 0.0022, 0.0017), 3, 8, cel='quitina', cor=PRETO)
    for s in (1, -1):
        m.elipsoide((s * 0.0017, 0.0029, 0.0058), (0.0015, 0.0018, 0.0014), 3, 6, cel='olho', cor='#7c1c1a')
        d = U.unit((s * 0.85, 0.10, -0.52))                          # asa: elipse chata fechada, aberta para trás
        t = U.unit(np.cross((0, 1.0, 0), d))
        n = np.cross(d, t)
        antes = m.xf
        m.xf = antes @ U.quadro(np.array((s * 0.0020, 0.0052, 0.0006)) + d * 0.0045, t, n, d)
        m.elipsoide((0, 0, 0), (0.0018, 0.00015, 0.0046), 3, 6, cel='liso', cor='#b6aea0')
        m.xf = antes
    _pernas(m, ((0.0018, 0.0008, 0.0024), (0.0022, 0.0004, 0.0008), (0.0024, 0.0002, -0.0008)),
            ((0.0044, 0.0048, 0.0030), (0.0046, 0.0050, 0.0030), (0.0050, 0.0056, 0.0034)), (50, -6, -44),
            esp=0.75)
    return (0.0008, 0.0055, 0.0010), (-0.0024, 0.0044)


TIPOS = {
    'besouro-alongado': lambda m: besouro(m, '#5f3e27', '#2c1c12', ax=0.0078, az=0.0150, H=0.0066,
                                          pron=(0.0068, 0.0036, 0.0048), antena=0.9),
    'besouro-vermelho': lambda m: besouro(m, '#b3141f', '#5a0a10'),
    'besouro-rinoceronte': lambda m: besouro(m, '#3a2618', '#1a110b', ax=0.0112, az=0.0125, H=0.0098,
                                             pron=(0.0086, 0.0050, 0.0048), antena=0.5, chifre=1.0,
                                             cor_pron='#2a1c12'),
    'percevejo-vermelho': percevejo,
    'joaninha': lambda m: besouro(m, '#c2352a', '#6a1712', ax=0.0112, az=0.0100, H=0.0100,
                                  pron=(0.0070, 0.0034, 0.0030), antena=0.45,
                                  manchas=((0.0048, 0.0010, 0.0017), (0.0055, -0.0040, 0.0016),
                                           (0.0032, -0.0075, 0.0013), (0.0, 0.0072, 0.0015))),
    'gorgulho': lambda m: besouro(m, '#6e6452', '#3a342a', ax=0.0072, az=0.0098, H=0.0078,
                                  pron=(0.0056, 0.0040, 0.0040), rostro=1.0),
    'formiga': formiga,
    'mosca': mosca,
}


def construir(m, tipo):
    """Constrói o espécime `tipo` em `m` (com m.xf já posto). Devolve (alfinete, faixa z do tórax)."""
    return TIPOS[tipo](m)
