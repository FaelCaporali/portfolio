"""FRENTE da vida `devops` (FICHA-PRODUCAO, FECHAMENTO): prancheta portátil de arquiteto com régua paralela.

Espaço do glb do S13 (Y para cima, +Z para a câmera, +X = esquerda do Fael), unidades do scan (ESC = scan / real).
Quadro da prancheta (nós `arq_tampo`, `arq_folha`): origem no CENTRO DA BORDA DE CIMA DA FOLHA (na face do papel);
+X = glb X; +Y = subindo o tampo (para o Fael); +Z = normal da folha (para cima e para a câmera). O tampo fica de frente
para a câmera, inclinado INCL graus sobre a mesa: a borda alta (de cima na tela) é a do lado do Fael, a baixa apoia na
mesa do lado da câmera; o cavalete dobrável segura a borda alta por trás. Malhas montadas no quadro em coordenadas
"glb" e levadas ao Blender por C = comum.GL_PARA_BL (como o notebook do FullStack).
"""
import math

import bmesh
from mathutils import Matrix, Vector

import comum
import prop_devops_material as MT
import prop_empreendedor_base as EB
import prop_financeiro_direita as FD
import prop_financeiro_v6 as v6
import prop_vela_base as B

ESC = 1.2
INCL = 35.0                                  # graus do tampo sobre a mesa (FICHA 35–45; 35 = menos rasante ao Fael)
FOLHA_MM = (210.0, 148.0)                    # A5 paisagem, proporção A (1:√2) da série do A3 (LOG: por quê)
TAMPO_MM = (320.0, 250.0, 15.0)              # prancheta portátil: largura, profundidade no plano, espessura
TOPO_MM = 35.0                               # da borda de cima do tampo à borda de cima da folha
P_TOPO = (0.0, 0.079, 0.048)                 # glb: centro da borda de cima do tampo (respiro abaixo do lábio)
PAPEL_MM = 0.1
CABO_X_MM = 150.0                            # cabos da régua paralela, a 10 mm das laterais
REGUA_Y_MM = -118.0                          # borda de trabalho da régua (30 mm sobre a folha, perto do pé)
ESC_X_MM = 133.0                             # escalímetro de bolso na margem direita da tela
PERNA_ABRE = 12.0                            # graus do cavalete para trás (para o Fael)
C = comum.GL_PARA_BL.to_3x3()


def R(mm):
    return mm * ESC / 1000.0


def eixos():
    a = math.radians(INCL)
    return Vector((1, 0, 0)), Vector((0, math.sin(a), -math.cos(a))), Vector((0, math.cos(a), math.sin(a)))


def rot():
    return Matrix(eixos()).transposed()


def origem():
    _, ey, ez = eixos()
    return Vector(P_TOPO) - ey * R(TOPO_MM) + ez * R(PAPEL_MM)


def glb(p):
    """Ponto do quadro da prancheta → glb."""
    return origem() + rot() @ Vector(p)


def local(p):
    return rot().transposed() @ (Vector(p) - origem())


def m_gl(nome):
    """Matriz no glb: prancheta (só translação), quadro (tampo, folha), regua (borda de trabalho), escalimetro
    (ponta de baixo, apoiada na cabeça direita da régua, sobre a madeira)."""
    if nome == 'prancheta':
        return Matrix.Translation(origem())
    if nome == 'regua':
        return Matrix.Translation(glb((0, R(REGUA_Y_MM), 0))) @ rot().to_4x4()
    if nome == 'escalimetro':
        return Matrix.Translation(glb((R(ESC_X_MM), R(REGUA_Y_MM + 1.0), z_madeira()))) @ rot().to_4x4()
    return Matrix.Translation(origem()) @ rot().to_4x4()


def para_bl(M):
    G = comum.GL_PARA_BL
    return G @ M @ G.inverted()


def z_madeira():
    return -R(PAPEL_MM)


def y_mesa():
    """Altura (glb) da mesa: o ponto mais baixo do perfil de pé (canto de baixo da borda baixa)."""
    W, H, T = TAMPO_MM
    return glb((0, R(TOPO_MM - H - 1.5), z_madeira() - R(T + 1.5))).y


# ------------------------------------------------------------------------------------------------------------ tampo
def _tampo(bm):
    W, H, T = TAMPO_MM
    yc, z0 = R(TOPO_MM - H / 2), z_madeira()
    f = EB.placa(bm, EB.ret_arred(R(W), R(H), R(4), 4), R(T), bev=R(1.6), seg=2,
                 mapa=lambda p: Vector((p.x, p.y + yc, z0 - R(T) + p.z)))
    bm.normal_update()
    cima = [x for x in f if x.normal.z > 0.3]
    MT.uv_cel(bm, cima, 'madeira', lambda co: ((co.x + R(W) / 2) / R(W), (co.y - yc + R(H) / 2) / R(H)))
    MT.uv_reg(bm, [x for x in f if x.normal.z <= 0.3], 'borda', 30)
    EB.pintar(bm, f, '#ffffff')


def _perfil_pe(bm):
    """Perfil de alumínio na borda baixa: abraça o canto e sobe 9 mm como aparador (lapiseira não escorrega)."""
    W, H, T = TAMPO_MM
    yb, z0 = R(TOPO_MM - H), z_madeira()
    pts = [(-1.5, -T - 1.5), (10, -T - 1.5), (10, -T), (0, -T), (0, 0), (10, 0), (10, 1.5), (1.5, 1.5), (1.5, 9),
           (-1.5, 9)]
    L = R(W - 8)
    f = EB.placa(bm, [(R(s), R(h)) for s, h in pts], L, bev=R(0.5), seg=1,
                 mapa=lambda p: Vector((p.z - L / 2, yb + p.x, z0 + p.y)))
    MT.uv_reg(bm, f, 'aluminio')
    EB.pintar(bm, f, '#b9bdc3')


def _cabos(bm):
    """Cabo de aço da régua paralela nas duas laterais (passa por dentro das cabeças da régua) e os 4 esticadores."""
    W, H, T = TAMPO_MM
    z0 = z_madeira()
    y_alto, y_baixo = R(TOPO_MM - 11), R(TOPO_MM - H + 16)
    for s in (-1, 1):
        x = s * R(CABO_X_MM)
        f = B.tubo_pts(bm, [(x, y_alto, z0 + R(4.5)), (x, y_baixo, z0 + R(4.5))], R(0.55), seg=6)
        MT.uv_reg(bm, f, 'aco')
        EB.pintar(bm, f, '#a4a9b0')
        for y in (y_alto, y_baixo):
            f = EB.torno(bm, [(0, 0), (R(3.6), 0), (R(3.6), R(4.6)), (R(3.1), R(5.8)), (R(1.2), R(6.4)), (0, R(6.5))],
                         14, mapa=lambda p, x=x, y=y: Vector((x + p.x, y + p.y, z0 + p.z)))
            MT.uv_reg(bm, f, 'aluminio')
            EB.pintar(bm, f, '#c8ccd1')


def _barra(bm, p0, p1, larg, esp, lado, reg, cor, bev=None):
    """Barra chata entre p0 e p1 (quadro local): largura ao longo de `lado`."""
    p0, p1 = Vector(p0), Vector(p1)
    d = (p1 - p0)
    comp = d.length
    d.normalize()
    lado = (Vector(lado) - d * Vector(lado).dot(d)).normalized()
    n = lado.cross(d)
    meio = (p0 + p1) / 2
    t = FD.caixa(larg, comp, esp, bev or min(larg, esp) * 0.3, 2)
    f = FD.anexar(bm, t, lambda p: meio + lado * p.x + d * p.y + n * p.z)
    MT.uv_reg(bm, f, reg)
    EB.pintar(bm, f, cor)
    return f


def _cavalete(bm):
    """Cavalete dobrável de aço (2 pernas chatas, travessa, dobradiças e pés de borracha) sob a borda alta."""
    W, H, T = TAMPO_MM
    zb = z_madeira() - R(T)
    ym = y_mesa()
    a = math.radians(PERNA_ABRE)
    pes = []
    for s in (-1, 1):
        x = s * R(118)
        dob = Vector((x, R(TOPO_MM - 22), zb - R(3)))
        _barra(bm, dob + Vector((0, 0, R(1.5))), dob + Vector((0, 0, R(1.5))) + Vector((0, R(24), 0)), R(22), R(3),
               (1, 0, 0), 'aluminio', '#b9bdc3')
        pg = glb(dob)
        pe_g = Vector((pg.x, ym + R(4), pg.z - (pg.y - ym - R(4)) * math.tan(a)))
        pe = local(pe_g)
        _barra(bm, dob, pe, R(16), R(4), (1, 0, 0), 'aco', '#3a3d42')
        cx = FD.caixa(R(24), R(12), R(8), R(1.5), 2)                      # pé de borracha, no chão da mesa
        f = FD.anexar(bm, cx, lambda p, pe_g=pe_g: local(pe_g + Vector((p.x, p.z, p.y))))
        MT.uv_reg(bm, f, 'borracha')
        EB.pintar(bm, f, '#1d1e21')
        pes.append((dob, pe))
    (d0, p0), (d1, p1) = pes
    k = 0.72
    _barra(bm, d0.lerp(p0, k) + Vector((-R(4), 0, 0)), d1.lerp(p1, k) + Vector((R(4), 0, 0)), R(12), R(3),
           (0, 1, 0), 'aco', '#3a3d42')


def _fitas(bm):
    """Fita crepe nos 4 cantos da folha: tiras de 19 mm rasgadas à mão, em diagonal, cada uma num ângulo próprio."""
    Wf, Hf = FOLHA_MM
    L, w = 32.0, 19.0
    dentes = 5
    topo = [(L / 2 - (i % 2) * 1.3, w / 2 - w * i / dentes) for i in range(dentes + 1)]
    cont = [(-L / 2 + 1.1 * ((i + 1) % 2), -w / 2 + w * i / dentes) for i in range(dentes + 1)] + topo
    cont = [(R(x), R(y)) for x, y in cont]
    for k, (sx, sy) in enumerate(((-1, 1), (1, 1), (1, -1), (-1, -1))):
        # atravessada no canto (eixo longo ⟂ à bissetriz), cobrindo a ponta da folha; ângulo com folga de mão
        ang = math.atan2(sy, sx) + math.pi / 2 + math.radians(8 * (EB.hash01(k, 3) - 0.5) * 2)
        cx, cy = sx * R(Wf / 2 - 2.1), (0 if sy > 0 else -R(Hf)) - sy * R(2.1)
        ca, sa = math.cos(ang), math.sin(ang)
        f = EB.placa(bm, cont, R(0.15), mapa=lambda p, cx=cx, cy=cy, ca=ca, sa=sa: Vector(
            (cx + p.x * ca - p.y * sa, cy + p.x * sa + p.y * ca, R(0.04) + p.z)))
        MT.uv_reg(bm, f, 'fita', 60)
        EB.pintar(bm, f, '#e4d5ab')


def construir_tampo(mat):
    """Tampo, perfil de pé, cabos e esticadores, cavalete e fitas."""
    bm = bmesh.new()
    _tampo(bm)
    _perfil_pe(bm)
    _cabos(bm)
    _cavalete(bm)
    _fitas(bm)
    bmesh.ops.transform(bm, matrix=C, verts=bm.verts)
    return EB.objeto('arq_tampo', bm, mat, ang=40)


def construir_folha(mat, nu=24, nv=17):
    """Folha A5 (grade plana nu × nv). UVMap 0–1 limpo: u = 0 na borda esquerda DA TELA (direita do Fael, −X) → 1;
    v = 1 na borda de cima (a da origem) → 0 na de baixo. O site desenha a planta nessa UV."""
    Wf, Hf = R(FOLHA_MM[0]), R(FOLHA_MM[1])
    P = [[(-Wf / 2 + Wf * i / nu, -Hf + Hf * j / nv, 0.0) for j in range(nv + 1)] for i in range(nu + 1)]
    bm = bmesh.new()
    B.grade(bm, P, uv=lambda i, j: (i / nu, j / nv))                    # normal +Z do quadro (sem recalcular:
    bmesh.ops.transform(bm, matrix=C, verts=bm.verts)                    # plano aberto não tem "fora")
    ob = v6.mesh_obj('arq_folha', bm)
    v6.shade(ob)
    ob.data.materials.append(mat)
    return ob
