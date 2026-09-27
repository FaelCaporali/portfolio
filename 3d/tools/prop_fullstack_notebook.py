"""F6/F9 `fs_notebook`: notebook de 14" genérico (sem marca), aberto ~110°, em uso pelo Fael: tampa de alumínio
anodizado grafite com as costas para a câmera e a tela para o rosto; base com teclado e touchpad virada para ele.

Espaço do glb do S13 (Y para cima, +Z para a câmera, +X = esquerda do Fael), unidades do scan (≈ 1,2 × real).
Quadro da tampa (nó `fs_notebook_tampa`): origem no EIXO DA DOBRADIÇA; +X = glb X; +Y ao longo da tampa (para cima);
+Z = normal das costas (para a câmera). Quadro da base (nó `fs_notebook_base`): origem no eixo, eixos do glb.
As malhas são montadas nesses quadros em coordenadas "glb" e levadas ao Blender por C = comum.GL_PARA_BL.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import comum
import prop_empreendedor_base as EB
import prop_vela_base as B

ESC = 1.2                                   # scan / real
W, H, T = 0.360, 0.252, 0.0072              # tampa: 30 × 21 × 0,6 cm reais (FICHA: ~31 × 21; 30 cabe na borda do 1440)
R_CANTO = 0.012
D, TB = 0.264, 0.0192                       # base: 22 cm de fundo, 1,6 cm de altura
ABERTURA = 110.0                            # graus entre base e tampa (FICHA 105–115)
P_TOPO = (-0.010, 0.0830, 0.105)            # centro da borda de cima (meia espessura), glb: respiro abaixo do lábio
Y_BASE = -0.003                             # topo da base, em relação ao eixo
Z_TRAS = 0.006                              # borda de trás da base (lado da câmera), em relação ao eixo
TELA = (0.348, 0.2175, 0.0072)              # área ativa 16:10 (largura, altura, borda de cima)
COR = {'aluminio': '#6b6e74', 'dobradica': '#3d3f44', 'plastico': '#121315', 'teclas': '#26272b',
       'vidro': '#0a0b0d', 'touchpad': '#62656b'}
REG = {'aluminio': (0.44, 0.09, 0.9), 'plastico': (0.58, 0.06, 0.0), 'vidro': (0.07, 0.02, 0.0),
       'touchpad': (0.30, 0.04, 0.0)}
C = comum.GL_PARA_BL.to_3x3()


def quadro():
    """(eixo da dobradiça, d = para cima ao longo da tampa, n = normal das costas) no glb."""
    a = math.radians(ABERTURA)
    d = Vector((0.0, math.sin(a), -math.cos(a)))           # base aponta −Z (para o Fael); a tampa sobe inclinada p/ +Z
    n = Vector((1.0, 0.0, 0.0)).cross(d)
    eixo = Vector(P_TOPO) - d * H
    return eixo, d, n


def m_gl(nome):
    """Matriz no glb do nó `nome`: tampa, base, tela (EMPTY da luz), adesivos (costas, borda de cima), topo."""
    eixo, d, n = quadro()
    if nome == 'base':
        return Matrix.Translation(eixo)
    rot = Matrix((Vector((1, 0, 0)), d, n)).transposed().to_4x4()
    if nome == 'tampa':
        return Matrix.Translation(eixo) @ rot
    if nome == 'tela':
        w, h, topo = TELA
        return Matrix.Translation(eixo + d * (H - topo - h / 2) - n * (T / 2 + 0.0008)) @ rot
    if nome == 'adesivos':
        return Matrix.Translation(eixo + d * H + n * (T / 2)) @ rot
    return Matrix.Translation(Vector(P_TOPO))


def para_bl(M):
    """Transformação no glb → matrix_world do Blender (o exportador desfaz a conjugação)."""
    G = comum.GL_PARA_BL
    return G @ M @ G.inverted()


def _orm(pasta):
    import numpy as np
    img = np.ones((64, 64 * len(REG), 3))
    for k, (base, var, metal) in enumerate(REG.values()):
        r = B.ruido(64, 64, 5, 41 + k)
        img[:, k * 64:(k + 1) * 64, 1] = np.clip(base + var * (r - 0.5) * 2, 0.05, 1)
        img[:, k * 64:(k + 1) * 64, 2] = metal
    return B.imagem('fs_rigido_orm', img, pasta, qualidade=92)


def material(pasta):
    return B.material('fs_rigido', 1.0, 1.0, orm=_orm(pasta))


def material_tela():
    """Tela acesa, fria e suave (a luz do rosto é do site, no EMPTY `fs_notebook_tela`)."""
    import prop_financeiro_v6 as v6
    m = v6.material('fs_tela', '#0d141c', 0.0, 0.12)
    b = next(x for x in m.node_tree.nodes if x.type == 'BSDF_PRINCIPLED')
    b.inputs['Emission Color'].default_value = v6.srgb('#8ea6be')
    b.inputs['Emission Strength'].default_value = 0.55
    return m


def _uv(bm, faces, reg, cor=None, escala=24.0):
    k = list(REG).index(reg)
    n = len(REG)
    B.uv_caixa(bm, faces, escala, (k / n + 0.01, 0.02, (k + 1) / n - 0.01, 0.98))
    EB.pintar(bm, faces, COR[cor or reg])
    return faces


def _placa_xy(bm, w, h, r, esp, bev, seg, mapa, cantos=6):
    return EB.placa(bm, EB.ret_arred(w, h, r, cantos), esp, bev=bev, seg=seg, mapa=mapa)


def construir_tampa(rigido, tela):
    """Casca de alumínio (chanfro 2,2 mm), vidro preto da moldura e a área ativa (material `fs_tela`, índice 1)."""
    bm = bmesh.new()
    casca = _placa_xy(bm, W, H, R_CANTO, T, 0.0022, 3, lambda p: Vector((p.x, p.y + H / 2, p.z - T / 2)))
    _uv(bm, casca, 'aluminio')
    e = 0.0006
    vidro = _placa_xy(bm, W - 0.004, H - 0.004, R_CANTO - 0.002, e, 0.0, 1,
                      lambda p: Vector((p.x, p.y + H / 2, p.z - T / 2 - e)), cantos=4)
    _uv(bm, vidro, 'vidro')
    w, h, topo = TELA
    yc, z = H - topo - h / 2, -T / 2 - e
    ativa = EB.placa(bm, [(w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2), (-w / 2, -h / 2)], 0.00008,
                     mapa=lambda p: Vector((p.x, yc + p.y, z - p.z)))          # placa fina: a face de fora olha −Z
    _uv(bm, ativa, 'vidro')
    EB.pintar(bm, ativa, '#ffffff')
    for f in ativa:
        f.material_index = 1
    bmesh.ops.transform(bm, matrix=C, verts=bm.verts)
    ob = EB.objeto('fs_notebook_tampa', bm, rigido, ang=40)
    ob.data.materials.append(tela)
    return ob


def teclas():
    """Retângulos (x0, x1, z0, z1) das teclas no quadro da base: 6 fileiras (funções em meia altura), passo 19 mm."""
    u = 0.330 / 14.5
    fileiras = ([14.5 / 14] * 14, [1] * 13 + [1.5], [1.5] + [1] * 12 + [1.0], [1.75] + [1] * 11 + [1.75],
                [2.25] + [1] * 10 + [2.25], [1, 1, 1, 1.25, 5.0, 1.25, 1, 1, 1, 1])
    out, z = [], Z_TRAS - 0.026
    for i, fila in enumerate(fileiras):
        alt = u * (0.55 if i == 0 else 1.0)
        x = -0.165
        for larg in fila:
            out.append((x + 0.0021, x + larg * u - 0.0021, z - alt + 0.0021, z - 0.0021))
            x += larg * u
        z -= alt
    return out


def construir_base(rigido):
    """Casca (chanfro 2,5 mm), poço do teclado, 76 teclas, touchpad e dobradiça."""
    bm = bmesh.new()
    zc = Z_TRAS - D / 2
    casca = EB.placa(bm, EB.ret_arred(W, D, R_CANTO, 6), TB, bev=0.0025, seg=3,
                     mapa=lambda p: Vector((p.x, Y_BASE - TB + p.z, zc - p.y)))
    _uv(bm, casca, 'aluminio')
    top = Y_BASE + 0.00006
    poco = EB.placa(bm, EB.ret_arred(0.334, 0.140, 0.004, 3), 0.00004, mapa=lambda p: Vector(
        (p.x, top + p.z, Z_TRAS - 0.022 - 0.070 - p.y)))
    _uv(bm, poco, 'plastico')
    ch = 0.0012
    for x0, x1, z0, z1 in teclas():
        cont = [(x0 + ch, z0), (x1 - ch, z0), (x1, z0 + ch), (x1, z1 - ch), (x1 - ch, z1), (x0 + ch, z1),
                (x0, z1 - ch), (x0, z0 + ch)]
        f = EB.placa(bm, cont, 0.0011, mapa=lambda p: Vector((p.x, top + 0.00004 + p.z, p.y)))
        _uv(bm, f, 'plastico', 'teclas')
    zt = Z_TRAS - D + 0.018 + 0.045
    tp = EB.placa(bm, EB.ret_arred(0.144, 0.090, 0.006, 4), 0.00025, bev=0.0002, seg=1,
                  mapa=lambda p: Vector((p.x, top - 0.00022 + p.z, zt - p.y)))
    _uv(bm, tp, 'touchpad')
    Y = lambda p: Vector((p.z, p.y, p.x))                                     # noqa: E731  (torno em Z → em X)
    dob = EB.torno(bm, [(0.0, -0.128), (0.0042, -0.128), (0.0048, -0.124), (0.0048, 0.124), (0.0042, 0.128),
                        (0.0, 0.128)], 20, mapa=Y)
    _uv(bm, dob, 'aluminio', 'dobradica')
    bmesh.ops.transform(bm, matrix=C, verts=bm.verts)
    return EB.objeto('fs_notebook_base', bm, rigido, ang=40)
