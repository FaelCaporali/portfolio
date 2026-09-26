"""U7 (TESTE; o Fael decide no site) `uber_celular`: celular compacto num suporte de ventosa, ao lado do rosto, no
lado livre de texto (direita da tela no largo = esquerda do Fael, x > 0), tela voltada para a câmera.

Celular 0,084 × 0,041 × 0,0062 (unidades do glb; a tela fica com ≈ 165 px de altura no 1440, U8: sem destaque).
Moldura grafite com chanfro, vidro rente, câmera traseira; suporte de CARRO: berço com garras laterais e apoio de
baixo, rótula atrás, braço curto e garra de saída de ar (dois dentes paralelos). Sem logotipo, sem texto.

Contrato: `uber_celular` (nó no centro do aparelho, TRS limpo; +Z local do glb = normal da tela para a câmera,
+Y = topo do aparelho) → `uber_celular_corpo` (aparelho + suporte) e `uber_celular_tela` (malha plana com UV 0–1
cobrindo a tela, u da esquerda para a direita e v de baixo para cima de quem olha: o site pinta o mapa por canvas).
"""
import math

import bmesh
from mathutils import Matrix, Vector

import prop_empreendedor_base as EB
import prop_uber_volante as VO

W, H, E, RAIO = 0.041, 0.084, 0.0062, 0.0056
BORDA = 0.0019                          # moldura preta da tela
POS_GL = (0.138, 0.150, 0.030)          # centro no glb: ao lado da maçã do rosto, à direita da tela
GIRO = (-4.0, -14.0, 0.0)               # graus: inclinação (X), guinada para o rosto (Y), rolagem (Z)


def matriz():
    """Quadro do nó (Blender): X = direita de quem olha a tela, Y = para trás (−normal), Z = topo do aparelho."""
    x, y, z = POS_GL
    rx, ry, rz = (math.radians(a) for a in GIRO)
    R = (Matrix.Rotation(ry, 3, 'Z') @ Matrix.Rotation(rx, 3, 'X') @ Matrix.Rotation(rz, 3, 'Y'))
    return Matrix.Translation(Vector((x, -z, y))) @ R.to_4x4()


def _uv(bm, fs, reg, escala=30.0):
    VO._uv(bm, fs, reg, escala)


def construir(mat_rigido, mat_tela):
    """Duas malhas no quadro local do nó: corpo (+ suporte) e tela."""
    bm = bmesh.new()
    contorno = EB.ret_arred(W, H, RAIO, 6)
    placa = EB.placa(bm, contorno, E, bev=0.0012, seg=2, mapa=lambda p: Vector((p.x, p.z - E * 0.5, p.y)))
    _uv(bm, placa, 'capa')
    bm.normal_update()
    for f in placa:                                          # moldura grafite; frente preta (vidro fora da tela)
        if f.normal.y < -0.9:
            EB.pintar(bm, [f], '#0c0d0f')
    # câmera traseira (ressalto)
    cam = EB.placa(bm, EB.ret_arred(0.013, 0.014, 0.003, 4), 0.001, bev=0.0004, seg=1,
                   mapa=lambda p: Vector((p.x - W * 0.25, p.z + E * 0.5, p.y + H * 0.36)))
    _uv(bm, cam, 'capa')
    # suporte de carro: berço (garras laterais + apoio de baixo), placa, rótula, braço curto e GARRA de saída de ar
    for sx in (-1, 1):
        g = EB.placa(bm, EB.ret_arred(0.004, 0.018, 0.0014, 3), E + 0.003, bev=0.0005, seg=1,
                     mapa=lambda p, sx=sx: Vector((p.x + sx * (W * 0.5 + 0.0011), p.z - E * 0.5 - 0.0004, p.y)))
        _uv(bm, g, 'plastico')
    ap = EB.placa(bm, EB.ret_arred(0.018, 0.004, 0.0014, 3), E + 0.003, bev=0.0005, seg=1,
                  mapa=lambda p: Vector((p.x, p.z - E * 0.5 - 0.0004, p.y - H * 0.5 - 0.0011)))
    _uv(bm, ap, 'plastico')
    pl = EB.placa(bm, EB.ret_arred(0.028, 0.034, 0.004, 4), 0.003, bev=0.0005, seg=1,
                  mapa=lambda p: Vector((p.x, p.z + E * 0.5 + 0.0008, p.y - 0.003)))
    _uv(bm, pl, 'plastico')
    rot = EB.torno(bm, [(0.0, 0.0), (0.0055, 0.0006), (0.0068, 0.0036), (0.0055, 0.0068), (0.0, 0.0072)], 20,
                   mapa=lambda p: Vector((p.x, p.z + E * 0.5 + 0.0035, p.y - 0.003)))
    _uv(bm, rot, 'friso')
    from prop_vela_base import tubo_pts
    a0 = Vector((0, E * 0.5 + 0.009, -0.003))
    a1 = a0 + Vector((0, 0.016, -0.004))
    antes = len(bm.faces)
    tubo_pts(bm, [a0 + (a1 - a0) * k / 4 for k in range(5)], 0.0028, seg=10)
    _uv(bm, EB.desde(bm, antes), 'plastico')
    for dz in (-0.0032, 0.0032):                             # dois dentes paralelos que abraçam a aleta da saída de ar
        d = EB.placa(bm, EB.ret_arred(0.020, 0.0016, 0.0006, 2), 0.022, bev=0.0003, seg=1,
                     mapa=lambda p, dz=dz: Vector((p.x, a1.y + p.z - 0.002, a1.z + dz + p.y)))
        _uv(bm, d, 'capa')
    corpo = EB.objeto('uber_celular_corpo', bm, mat_rigido, ang=40)
    # tela: plano rente ao vidro, 0,15 mm à frente, UV 0–1 no retângulo da tela
    bt = bmesh.new()
    tw, th = W - 2 * BORDA, H - 2 * BORDA
    fs = EB.placa(bt, EB.ret_arred(tw, th, RAIO - BORDA, 6), 0.0001,
                  mapa=lambda p: Vector((p.x, p.z - E * 0.5 - 0.00015, p.y)))
    bt.normal_update()
    frente = [f for f in fs if f.normal.y < -0.9]
    bmesh.ops.delete(bt, geom=[f for f in fs if f not in frente], context='FACES')
    uv = bt.loops.layers.uv.new('UVMap')
    for f in bt.faces:
        for lp in f.loops:
            lp[uv].uv = (0.5 + lp.vert.co.x / tw, 0.5 + lp.vert.co.z / th)
    tela = EB.objeto('uber_celular_tela', bt, mat_tela, ang=180, normais=False)
    return corpo, tela


def material_tela():
    """Vidro escuro, sem emissão (U8); o site troca o mapa (canvas) nesta malha."""
    import prop_vela_base as B
    m = B.material('uber_tela', 0.0, 0.16, vcor=False)
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (0.012, 0.014, 0.018, 1)
    return m
