"""Moedas do blockout do financeiro (modelador): pilha de 4 sob o total geral + 1 tombada e encostada na quina.

Números no módulo `blockout` (MOEDA, PILHA_*, ENCOSTO_*); aqui só a construção. Densidade ≤ 0,5 tri/px² (portão de
tamanho): a pilha é vista de lado (51 × 9 px no 1440), só a encostada mostra a face (51 × 22) e leva orla e campo
côncavo; as outras têm só a quina de 0,3 mm (o sulco entre moedas separa uma da outra).
"""

import math

from mathutils import Quaternion, Vector

import blockout_geo as geo


def perfil(bl, face):
    m = bl.MOEDA
    r, e, c = m['R'], m['E'] / 2, m['quina']
    borda = [(r - c, -e), (r, -e + c), (r, e - c), (r - c, e)]
    if not face:
        return [(0, -e)] + borda + [(0, e)]
    ri, rel, cc = r - m['orla'], m['relevo'], m['concavo']
    campo = [(0, e - rel - cc), (ri, e - rel), (ri + 0.00025, e)]
    return [(p, -z) for p, z in campo] + borda + list(reversed(campo))


def moeda(bl, nome, raiz, face):
    segs = 32 if face else 24
    o = bl._obj(nome, lambda bm: geo.revolucao(bm, perfil(bl, face), segs), 'ouro', raiz, angulo=35)
    o.modifiers.new('normais', 'WEIGHTED_NORMAL').keep_sharp = True
    return o


def construir(bl, raiz):
    x0, e, r = bl._colunas()[-1], bl.MOEDA['E'], bl.MOEDA['R']
    topo = -bl.H / 2 - bl.PILHA_VAO
    n = len(bl.PILHA_DESVIO)
    objs = []
    for i, (dx, dy) in enumerate(bl.PILHA_DESVIO):
        o = moeda(bl, f'moeda_{i}', raiz, face=False)  # a face de cima fica a ~5° da linha de visão: orla não lê
        o.location = (x0 + dx, bl.MOEDA_Y + dy, topo - e * (n - i - 0.5))
        o.rotation_euler = (0, 0, math.radians(37 * i))
        objs.append(o)
    a = math.radians(bl.ENCOSTO_GRAUS)
    d = Vector((*bl.ENCOSTO_DIR, 0.0)).normalized()  # direção da queda: da moeda para a pilha
    chao = topo - e * n
    quina = Vector((x0, bl.MOEDA_Y, chao)) - d * r  # a borda de cima apoia na quina da pilha
    centro = quina - d * r * math.cos(a)
    centro.z = chao + r * math.sin(a) + e / 2
    o = moeda(bl, 'moeda_encostada', raiz, face=True)
    o.location = centro
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Quaternion(Vector((-d.y, d.x, 0.0)), -a)
    return objs + [o]
