"""U1 `uber_volante`: volante de carro de passeio, SEM marca: aro de couro preto, três raios com friso cinza acetinado
(o acento da vida, #8a8a8a), cubo com a tampa do airbag lisa, capa traseira e coluna curta.

Quadro (Blender, espaço do glb do S13): origem no CENTRO DO ARO; eixos locais do nó `uber_volante`
  X = esquerda do Fael, Y = para o motorista, Z = topo do aro (12 h).
No glb (Y para cima): +X local = esquerda do Fael, +Y local = topo do aro, +Z local = EIXO DA COLUNA apontando para o
painel (para a câmera). Girar o volante = girar em torno do Z local do nó.
Inclinação como num carro: a coluna sobe do painel para o motorista, então o topo do aro fica mais perto do painel
(TAU da vertical). Medidas em unidades do scan (≈ 1,2 × real): aro Ø externo 0,337 = 1,2 H (H = 0,28, topo→queixo).
"""
import math

import bmesh
import numpy as np
from mathutils import Matrix, Vector

import prop_empreendedor_base as EB
import prop_vela_base as B

RC, R_TUBO = 0.148, 0.0205          # raio da linha de centro do aro; raio da seção (redonda)
TAU = 22.0                          # graus da vertical
CENTRO_GL = (0.0, -0.0725, 0.050)    # centro do aro no glb (x, y, z): silhueta do topo ≥ 12 px abaixo do lábio (1440)
MAOS = {'esq': 45.0, 'dir': 135.0}  # ângulo no plano do aro (0 = +X local, 90 = topo): 10h30 e 1h30 (borda de baixo)
COR = {'couro': '#161616', 'plastico': '#232427', 'friso': '#8a8a8a', 'capa': '#1b1c1e'}
REG = {'couro': (0.56, 0.10, 0.0), 'plastico': (0.46, 0.06, 0.0), 'friso': (0.34, 0.05, 0.85), 'capa': (0.62, 0.08, 0)}


def quadro():
    """(centro, ex, para_motorista, topo) em coordenadas do Blender; a matriz 3×3 do nó é [ex, motorista, topo]."""
    t = math.radians(TAU)
    x, y, z = CENTRO_GL
    c = Vector((x, -z, y))
    ex = Vector((1, 0, 0))
    topo = Vector((0, -math.sin(t), math.cos(t)))            # glb (0, cos, sin): topo inclinado para o painel
    motorista = topo.cross(ex)                                # glb −Z inclinado: para o motorista
    return c, ex, motorista, topo


def matriz():
    c, ex, mo, to = quadro()
    return Matrix.Translation(c) @ Matrix((ex, mo, to)).transposed().to_4x4()


def dist_aro(P):
    """Distância (m) de pontos do mundo (Blender) à superfície do aro (negativo = dentro)."""
    M = np.array(matriz().inverted())
    L = np.asarray(P) @ M[:3, :3].T + M[:3, 3]
    rho = np.hypot(L[:, 0], L[:, 2])
    return np.hypot(rho - RC, L[:, 1]) - R_TUBO


def pega(nome):
    """Ponto do aro (centro do tubo), tangente (sentido anti-horário visto do painel), radial e eixo para o painel."""
    c, ex, mo, to = quadro()
    a = math.radians(MAOS[nome])
    rad = ex * math.cos(a) + to * math.sin(a)
    tan = -ex * math.sin(a) + to * math.cos(a)
    return c + rad * RC, tan, rad, -mo


def _orm(pasta):
    h, w = 64, 256
    img = np.ones((h, w, 3))
    for k, (reg, (base, var, metal)) in enumerate(REG.items()):
        r = B.ruido(64, 64, 5, 31 + k)
        img[:, k * 64:(k + 1) * 64, 1] = np.clip(base + var * (r - 0.5) * 2, 0.05, 1)
        img[:, k * 64:(k + 1) * 64, 2] = metal
    return B.imagem('uber_rigido_orm', img, pasta, qualidade=92)


def _uv(bm, faces, reg, escala=30.0):
    k = list(REG).index(reg)
    B.uv_caixa(bm, faces, escala, (k / 4 + 0.01, 0.02, (k + 1) / 4 - 0.01, 0.98))
    EB.pintar(bm, faces, COR[reg])


def _secao(n, a, b, ex=3.0):
    """Superelipse (meia largura a, meia espessura b) com n pontos."""
    out = []
    for i in range(n):
        t = 2 * math.pi * i / n
        c, s = math.cos(t), math.sin(t)
        out.append((a * math.copysign(abs(c) ** (2 / ex), c), b * math.copysign(abs(s) ** (2 / ex), s)))
    return out


def _loft(bm, trilha, larg, esp, n=16):
    """Raio: seção superelíptica varrida ao longo de pontos no plano XZ (Y = prato)."""
    V = []
    for k, (p, w, e) in enumerate(zip(trilha, larg, esp)):
        q = trilha[min(k + 1, len(trilha) - 1)] - trilha[max(k - 1, 0)]
        q = Vector((q.x, 0, q.z)).normalized()
        lat = Vector((-q.z, 0, q.x))
        V.append([bm.verts.new(p + lat * u + Vector((0, 1, 0)) * v) for u, v in _secao(n, w / 2, e / 2)])
    fs = []
    for A, C in zip(V, V[1:]):
        for i in range(n):
            fs.append(bm.faces.new((A[i], A[(i + 1) % n], C[(i + 1) % n], C[i])))
    fs.append(bm.faces.new(list(reversed(V[0]))))
    fs.append(bm.faces.new(V[-1]))
    return fs


def construir(mat):
    """Malha única `uber_volante_malha` no quadro local do nó (centro do aro na origem)."""
    bm = bmesh.new()
    # aro: toro no plano XZ, seção redonda
    na, ns = 112, 12
    V = []
    for i in range(na):
        a = 2 * math.pi * i / na
        rad = Vector((math.cos(a), 0, math.sin(a)))
        V.append([bm.verts.new(rad * (RC + R_TUBO * math.cos(b)) + Vector((0, R_TUBO * math.sin(b), 0)))
                  for b in (2 * math.pi * j / ns for j in range(ns))])
    aro = [bm.faces.new((V[i][j], V[(i + 1) % na][j], V[(i + 1) % na][(j + 1) % ns], V[i][(j + 1) % ns]))
           for i in range(na) for j in range(ns)]
    _uv(bm, aro, 'couro', 12.0)

    def prato(r):                                             # cubo recuado 3,2 cm para o painel
        return -0.032 * (1 - min(max((r - 0.05) / (RC - R_TUBO - 0.05), 0), 1)) ** 1.4
    # raios: 3 h, 9 h (largos) e 6 h
    for ang, w0, w1 in ((0, 0.052, 0.034), (180, 0.052, 0.034), (270, 0.040, 0.030)):
        a = math.radians(ang)
        d = Vector((math.cos(a), 0, math.sin(a)))
        rs = [0.045 + (RC - 0.006 - 0.045) * k / 10 for k in range(11)]
        tr = [d * r + Vector((0, prato(r), 0)) for r in rs]
        fs = _loft(bm, tr, [w0 + (w1 - w0) * k / 10 for k in range(11)], [0.013] * 11, n=12)
        _uv(bm, fs, 'friso')
    # cubo: tampa do airbag (lado do motorista), capa traseira e coluna (para o painel = −Y)
    def sup(r, z, a, ex=3.2, k=(1.0, 0.86)):
        c, s = math.cos(a), math.sin(a)
        return r / ((abs(c) / k[0]) ** ex + (abs(s) / k[1]) ** ex) ** (1 / ex)
    Y = lambda p: Vector((p.x, p.z, p.y))                     # noqa: E731  (torno em Z → em Y)
    tampa = EB.torno(bm, [(0.0, 0.004), (0.050, 0.002), (0.062, -0.004), (0.066, -0.016), (0.064, -0.030),
                          (0.058, -0.036)], 48, raio=sup, mapa=Y)
    _uv(bm, tampa, 'plastico')
    capa = EB.torno(bm, [(0.058, -0.036), (0.050, -0.052), (0.040, -0.066), (0.036, -0.078)], 48, mapa=Y)
    _uv(bm, capa, 'capa')
    col = EB.torno(bm, [(0.036, -0.078), (0.039, -0.082), (0.039, -0.090), (0.033, -0.094), (0.031, -0.20),
                        (0.0, -0.20)], 32, mapa=Y)
    _uv(bm, col, 'capa')
    ob = EB.objeto('uber_volante_malha', bm, mat, ang=40)
    return ob


def material(pasta):
    return B.material('uber_rigido', 1.0, 1.0, orm=_orm(pasta))
