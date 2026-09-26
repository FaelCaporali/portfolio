"""V4 `vela_laser`: um Laser (ILCA) em miniatura, velejando. Medidas reais (m) e escala S no fim.

Casco 4,23 × 1,37 m: proa fina, boca máxima a ~62 %, espelho largo; fundo chato a ré e em V a vante, rocker na proa;
convés abaulado com antiderrapante; cockpit aberto (1,25 × 0,64 m, 0,22 de fundo) com a caixa da bolina à frente e a
cinta de escora. Bolina (1,00 × 0,30) e leme (0,80 × 0,26) com perfil; cabeça do leme, cana (1,05) e extensão.
Mastro de duas peças (Ø 64 / 50 mm) sem estai nem buja, sem cruzetas. Aparelho (nó `vela_laser_retranca`, origem no
eixo do mastro na garlindéu): retranca 2,74 m, burro (talha do mastro à retranca), escota da ponta da retranca ao
tirante de popa e do meio da retranca ao moitão do cockpit; vela única com manga no mastro, 3 réguas na valuma com
alunamento e a janela (textura), bojo 9 % e torção para cima.
"""
import math

import bmesh
from mathutils import Vector

import prop_vela_barco as BB

L, PROA, POPA = 4.23, 1.95, -2.28          # comprimento; x da proa e do espelho (origem na bolina)
MASTRO_X, GARL = 0.90, 0.78                # pé do mastro; altura da garlindéu sobre o convés
COCK = (-1.45, -0.20, 0.32, 0.22)          # cockpit: x de ré, x de vante, meia largura, fundo
COR = {'casco': '#e4e1da', 'conves': '#dcd9d1', 'anti': '#cfcbc2', 'cockpit': '#c9c5bb', 'lamina': '#d8d6d0',
       'aluminio': '#a9adb2', 'cabo': '#3d4a57', 'cinta': '#2a3038', 'escota': '#c7ccd2', 'moitao': '#2b2e33'}


def t_de(x):
    return min(max((PROA - x) / L, 0.0), 1.0)


def meia_boca(x):
    t = t_de(x)
    if t <= 0.62:
        return max(0.012, 0.685 * math.sin(math.pi / 2 * t / 0.62) ** 0.8)
    return 0.685 * (1 - 0.25 * ((t - 0.62) / 0.38) ** 2)


def borda(x):
    return 0.26 + 0.10 * (1 - t_de(x)) ** 4


def quilha(x):
    t = t_de(x)
    return -0.13 + 0.33 * max(0.0, 1 - t / 0.30) ** 2.2 + 0.05 * max(0.0, (t - 0.8) / 0.2) ** 2


def conves_z(x, y):
    hb = meia_boca(x)
    return borda(x) + 0.055 * (1 - min(1.0, (y / hb) ** 2))


def anel(x):
    """Seção fechada: quilha → boreste → borda → convés (fora, dentro, fora) → borda de bombordo → quilha."""
    t, hb, zs, zk = t_de(x), meia_boca(x), borda(x), quilha(x)
    n = 1.5 + 1.8 * min(t / 0.5, 1)
    lado = []
    for k in range(9):
        a = math.pi / 2 * k / 8
        lado.append((hb * math.sin(a) ** (2 / n), zs - (zs - zk) * math.cos(a) ** (2 / n)))
    yc = min(COCK[2], 0.6 * hb)
    fora = [yc + (hb * 0.97 - yc) * (1 - i / 4) for i in range(4)]          # hb·0,97 … (quase) yc
    ys = [-y for y in fora] + [-yc + 2 * yc * i / 8 for i in range(9)] + list(reversed(fora))
    pts = [Vector((x, -y, z)) for y, z in lado]                              # quilha → borda de boreste
    pts.append(Vector((x, -hb * 0.985, zs + 0.014)))
    pts += [Vector((x, y, conves_z(x, y))) for y in ys]                      # convés de boreste a bombordo
    pts.append(Vector((x, hb * 0.985, zs + 0.014)))
    pts += [Vector((x, y, z)) for y, z in reversed(lado)]
    return pts


def casco(bm):
    xs = sorted(set([POPA + (PROA - POPA) * (1 - math.cos(math.pi * i / 34)) / 2 for i in range(35)] +
                    [COCK[0], COCK[1], COCK[0] + 0.001, COCK[1] - 0.001]))
    xs = [x for x in xs if x <= PROA - 0.001] + [PROA - 0.0005]
    faces, aneis = BB.casco_estacoes(bm, xs, anel)
    bm.normal_update()
    x0, x1, yc, fundo = COCK
    poço = [f for f in faces if len(f.verts) == 4 and x0 < f.calc_center_median().x < x1 and
            abs(f.calc_center_median().y) < yc - 1e-4 and f.normal.z > 0.5]
    resto = [f for f in faces if f not in set(poço)]
    ext = bmesh.ops.extrude_face_region(bm, geom=poço)
    novos = [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]
    for v in novos:
        v.co.z = borda(v.co.x) - fundo + 0.01 * (v.co.x - x0)
    bmesh.ops.delete(bm, geom=[f for f in poço if f.is_valid], context='FACES')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    todas = list(bm.faces)
    resto = set(f for f in resto if f.is_valid)
    for f in todas:
        c = f.calc_center_median()
        if f in resto and f.normal.z > 0.55 and c.z > 0.2:
            anti = abs(c.y) < meia_boca(c.x) * 0.8 and c.x < MASTRO_X - 0.2
            BB.pintar_reg(bm, [f], COR['anti'] if anti else COR['conves'], 'antiderrapante' if anti else 'gelcoat')
        elif f in resto:
            BB.pintar_reg(bm, [f], COR['casco'], 'gelcoat')
        else:
            BB.pintar_reg(bm, [f], COR['cockpit'], 'antiderrapante')
    return todas


def apendices(bm):
    """Bolina, leme com cabeça, cana e extensão; caixa da bolina; cinta de escora; tirante (burro de popa)."""
    f = BB.lamina(bm, 0.30, 1.12, 0.10, lambda p: Vector((p.x + 0.02, p.y, p.z + conves_z(0, 0) + 0.12)))
    BB.pintar_reg(bm, f, COR['lamina'], 'lamina')
    f = BB.lamina(bm, 0.27, 0.95, 0.09, lambda p: Vector((POPA - 0.14 - p.x * 0.9, p.y, p.z + 0.18)), afina=0.7)
    BB.pintar_reg(bm, f, COR['lamina'], 'lamina')
    zc = borda(POPA)
    f = BB.EB.anexar(bm, BB.EB.caixa(0.30, 0.07, 0.20, 0.015), lambda p: p + Vector((POPA - 0.14, 0, zc + 0.02)))
    cana = [Vector((POPA - 0.02, 0, zc + 0.10)), Vector((POPA + 0.5, 0, zc + 0.14)), Vector((POPA + 1.05, 0, zc + 0.15))]
    f += BB.tubo(bm, cana, 0.018)
    ext = [cana[-1], cana[-1] + Vector((0.45, 0.30, 0.02)), cana[-1] + Vector((0.78, 0.55, -0.06))]
    f += BB.tubo(bm, ext, 0.011)
    BB.pintar_reg(bm, f, COR['aluminio'], 'aluminio')
    x0, x1, yc, fundo = COCK
    fz = borda(x0) - fundo
    f = BB.EB.anexar(bm, BB.EB.caixa(0.34, 0.07, fundo + 0.02, 0.012),
                     lambda p: p + Vector((x1 + 0.02, 0, fz + (fundo + 0.02) / 2)))
    BB.pintar_reg(bm, f, COR['cockpit'], 'gelcoat')
    f = BB.cabo(bm, (x1 - 0.05, 0, fz + 0.06), (x0 + 0.1, 0, fz + 0.03), 0.025, seca=0.04)
    BB.pintar_reg(bm, f, COR['cinta'], 'borracha')
    f = BB.cabo(bm, (POPA + 0.05, -0.42, zc + 0.03), (POPA + 0.05, 0.42, zc + 0.03), 0.006, seca=-0.10)
    BB.pintar_reg(bm, f, COR['cabo'], 'cabo')


def mastro(bm):
    """Mastro de duas peças com leve curva a ré no topo; base no convés; topo na testa da vela."""
    z0 = conves_z(MASTRO_X, 0)
    alto = 6.02
    pts = [Vector((MASTRO_X - 0.13 * (k / 12) ** 2, 0, z0 + alto * k / 12)) for k in range(13)]
    f = BB.B.tubo_pts(bm, pts, lambda t: 0.032 if t < 0.45 else 0.025, seg=10)
    BB.pintar_reg(bm, f, COR['aluminio'], 'aluminio')
    return z0, alto


def mastro_x(z_rel, alto):
    return -0.13 * (z_rel / alto) ** 2


def aparelho(bm_r, bm_v, z0, alto, lado=-1.0):
    """Aparelho no espaço do nó (origem: eixo do mastro na garlindéu; retranca para −X). Vela primeiro no bm_v."""
    zg = GARL
    luff = lambda h: Vector((mastro_x(zg + 0.05 + h * 5.10, alto), 0, 0.05 + h * 5.10))   # noqa: E731
    clew = Vector((-2.70, 0, 0.09))
    head = luff(1.0)

    def leech(h):
        p = clew + (head - clew) * h
        return p + Vector((-0.42 * math.sin(math.pi * min(h / 0.95, 1)) ** 1.2 * (1 - h) ** 0.3, 0, 0))
    faces, P, Q = BB.vela(bm_v, luff, leech, 14, 26, lambda h: 0.09 * (1 - 0.5 * h), lambda h: 0.20 * h ** 1.3,
                          (0.0, 0.0, 0.5, 1.0), lado=lado)
    nh = 26
    chave = {i * (nh + 1) + j: Q[i][j] for i in range(len(Q)) for j in range(nh + 1)}
    manga = [Vector((mastro_x(zg + z, alto), 0, z)) for z in [0.02 + 5.13 * k / 12 for k in range(13)]]
    BB.B.uv_fixo(bm_v, BB.B.tubo_pts(bm_v, manga, 0.045, seg=10), (0.02, 0.5))
    # Retranca, garlindéu, burro e escota (cabos finos, só silhueta).
    f = BB.tubo(bm_r, [Vector((0.03, 0, 0)), Vector((-2.74, 0, 0))], 0.032, seg=10)
    f += BB.EB.anexar(bm_r, BB.EB.caixa(0.10, 0.08, 0.08, 0.02), lambda p: p + Vector((0.02, 0, 0)))
    BB.pintar_reg(bm_r, f, COR['aluminio'], 'aluminio')
    f = BB.cabo(bm_r, (0.06, 0, -GARL + 0.18), (-0.55, 0, -0.03), 0.010)
    f += BB.cabo(bm_r, (0.04, 0.012, -GARL + 0.18), (-0.52, 0.012, -0.03), 0.010)
    f += BB.cabo(bm_r, (-2.66, 0, -0.03), (-2.66 - 0.35, 0.0, -GARL - 0.02), 0.009, seca=-0.02)
    f += BB.cabo(bm_r, (-1.05, 0, -0.03), (-1.20, 0.0, -GARL - 0.20), 0.009, seca=-0.02)
    f += BB.cabo(bm_r, (-2.70, 0, -0.035), (-1.05, 0, -0.035), 0.007)
    BB.pintar_reg(bm_r, f, COR['escota'], 'cabo')
    for x, z in ((-0.55, -0.05), (-2.66, -0.05), (-1.05, -0.05)):
        f = BB.EB.anexar(bm_r, BB.EB.caixa(0.06, 0.05, 0.08, 0.015), lambda p, x=x, z=z: p + Vector((x, 0, z)))
        BB.pintar_reg(bm_r, f, COR['moitao'], 'plastico')
    return chave


def construir(S, mat_rigido, mat_vela):
    """Devolve (casco, aparelho, origem do aparelho no espaço do casco escalado)."""
    bm = bmesh.new()
    casco(bm)
    apendices(bm)
    z0, alto = mastro(bm)
    obj_c = BB.B.objeto('vela_laser_casco', bm, mat_rigido, ang=38)
    BB.finalizar(obj_c, S)
    bm_r, bm_v = bmesh.new(), bmesh.new()
    chave = aparelho(bm_r, bm_v, z0, alto)
    obj_a = BB.objeto_aparelho('vela_laser_retranca', bm_r, bm_v, mat_rigido, mat_vela, chave)
    BB.finalizar(obj_a, S)
    return obj_c, obj_a, Vector((MASTRO_X + mastro_x(GARL, alto), 0, z0 + GARL)) * S
