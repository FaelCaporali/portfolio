"""Régua paralela (nó `arq_regua`) com a lapiseira na calha, e o escalímetro de bolso (nó `arq_escalimetro`).

Quadro da régua: origem no centro da BORDA DE TRABALHO (a de cima, onde a lapiseira corre), na altura da face do papel;
eixos do quadro da prancheta (+Y sobe o tampo). A régua corre ao longo de Y local sobre a folha, guiada pelos cabos que
passam por dentro das cabeças (x ±135..±160 mm); o corpo de alumínio fica 0,8 mm acima do papel, apoiado nas cabeças,
que deslizam na madeira da margem. Medidas em mm reais, convertidas por P.R (escala do scan).
"""

import bmesh
from mathutils import Vector

import prop_devops_material as MT
import prop_devops_prancheta as P
import prop_empreendedor_base as EB
import prop_financeiro_direita as FD

R = P.R
CORPO = 270.0                                # alumínio, x ±135 mm
CABECA = 25.0                                # cabeças de plástico nas pontas (os cabos passam por dentro)
# Perfil do corpo (s = mm ao longo de Y a partir da borda de trabalho, h = mm acima do papel): gume fino, rampa, calha
PERFIL = [(0, 0.8), (0, 2.0), (-6, 4.8), (-9, 9.0), (-15, 9.0), (-17, 6.6), (-23, 6.6), (-25, 9.0), (-36.5, 9.0),
          (-40, 7.5), (-40, 0.8)]
CAB_PERFIL = [(1, -0.1), (1, 3.0), (-5, 8.0), (-8, 11.0), (-37, 11.0), (-41, 8.0), (-41, -0.1)]
LARGURA = 40.0
LAPIS_X = (-112.0, 28.0)                     # lapiseira 0,5 mm de 140 mm deitada na calha
LAPIS_EIXO = (-20.0, 9.25)                   # (s, h) do eixo: encosta nas duas rampas da calha (r = 4 mm)
# Escalímetro de bolso chato (150 × 21 × 3 mm): duas bordas chanfradas graduadas (1:100 e 1:50)
ESC_PERFIL = [(-10.5, 0), (10.5, 0), (10.5, 0.6), (6.5, 3.0), (-6.5, 3.0), (-10.5, 0.6)]
ESC_COMP = 150.0


def _corpo(bm):
    L = R(CORPO)
    f = EB.placa(bm, [(R(s), R(h)) for s, h in PERFIL], L, bev=R(0.45), seg=2,
                 mapa=lambda p: Vector((p.z - L / 2, p.x, p.y)))
    MT.uv_cel(bm, f, 'regua', lambda co: ((co.x + L / 2) / L, -co.y / R(LARGURA)))
    EB.pintar(bm, f, '#cfd3d8')


def _cabecas(bm):
    for s in (-1, 1):
        x0 = s * R(CORPO / 2) if s > 0 else -R(CORPO / 2 + CABECA)
        f = EB.placa(bm, [(R(a), R(h)) for a, h in CAB_PERFIL], R(CABECA), bev=R(1.6), seg=3,
                     mapa=lambda p, x0=x0: Vector((x0 + p.z, p.x, p.y)))
        MT.uv_reg(bm, f, 'plastico', 50)
        EB.pintar(bm, f, '#26272b')


def _lapiseira(bm):
    """Lapiseira técnica 0,5 mm: grafite, ponteira e cone de metal, grip recartilhado, corpo preto fosco, clipe."""
    x0, x1 = LAPIS_X
    s, h = LAPIS_EIXO
    perfil = [(0, 0), (0.28, 0), (0.28, 1.4), (0.6, 1.5), (0.6, 5.2), (1.2, 5.8), (3.1, 12), (3.5, 13), (3.8, 14.5),
              (3.8, 39.5), (3.6, 41), (3.95, 42.5), (3.95, 117), (3.6, 118.5), (3.6, 131), (3.1, 132),
              (3.1, 137.5), (2.4, 139.6), (0, 140)]
    f = EB.torno(bm, [(R(r), R(z)) for r, z in perfil], 16,
                 mapa=lambda p: Vector((R(x0) + p.z, R(s) + p.x, R(h) + p.y)))
    zona = [(1.45, 'grafite', '#2c2c2e'), (13.0, 'aco', '#b9bdc3'), (41.0, 'borracha', '#2d2f33'),
            (118.0, 'plastico', '#1c1d20'), (140.5, 'aco', '#b9bdc3')]
    for fc in f:
        z = sum(v.co.x for v in fc.verts) / len(fc.verts) - R(x0)
        reg, cor = next((rg, c) for lim, rg, c in zona if z <= R(lim))
        MT.uv_reg(bm, [fc], reg, 60)
        EB.pintar(bm, [fc], cor)
    centro = Vector((R(x0 + 118), R(s), R(h + 4.3)))                     # clipe sobre o corpo, lado de cima
    f = FD.anexar(bm, FD.caixa(R(26), R(3.2), R(0.8), R(0.3), 1), lambda p: centro + p)
    MT.uv_reg(bm, f, 'aco')
    EB.pintar(bm, f, '#b9bdc3')


def construir_regua(mat):
    bm = bmesh.new()
    _corpo(bm)
    _cabecas(bm)
    _lapiseira(bm)
    bmesh.ops.transform(bm, matrix=P.C, verts=bm.verts)
    return EB.objeto('arq_regua', bm, mat, ang=40)


def construir_escalimetro(mat):
    """Escalímetro de bolso deitado na margem direita da tela, entre a folha e o cabo, com a ponta de baixo encostada
    na cabeça da régua (é ela que o segura no tampo inclinado). Quadro: origem no meio da ponta de baixo, na madeira;
    eixos do tampo. Graduação nas duas bordas chanfradas (traço na aresta de fora, como no objeto real)."""
    bm = bmesh.new()
    L = R(ESC_COMP)
    f = EB.placa(bm, [(R(x), R(h)) for x, h in ESC_PERFIL], L, bev=R(0.3), seg=1,
                 mapa=lambda p: Vector((p.x, p.z, p.y)))
    bm.normal_update()
    for fc in f:
        n = fc.normal
        if abs(n.z) > 0.95 or abs(n.y) > 0.9:
            MT.uv_reg(bm, [fc], 'branco')
        else:
            MT.uv_cel(bm, [fc], 'escala1' if n.x < 0 else 'escala2',
                      lambda co: (co.y / L, 1 - (abs(co.x) - R(6.5)) / R(4.0)))
    EB.pintar(bm, f, '#eeede7')
    bmesh.ops.transform(bm, matrix=P.C, verts=bm.verts)
    return EB.objeto('arq_escalimetro', bm, mat, ang=40)
