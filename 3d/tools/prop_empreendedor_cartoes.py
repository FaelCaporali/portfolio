"""Leque de cartões de visita (E8, volta 2) do "Entrepreneur": 5 cartões 90×50 mm de papel 0,5 mm abertos em leque na
mão de quem entrega, do mais antigo (fundo) ao de hoje (frente): WadiBrownies PIVOTED, Hostel · Piedade do Paraopeba
CLOSED, Escola de Vela · Lagoa dos Ingleses VALIDATED, SUP Lagoa Santa PANDEMIC, caporali.dev IN PROGRESS.

Forma: pivô comum no canto de baixo do lado da cabeça (+X), 12° entre cartões, e cada cartão de trás escorrega 9 mm
para cima na mão (sem isso a faixa visível de cada cartão tem 19 mm na ponta e zero no meio: os nomes não cabem).
Cantos de 2,5 mm, espessura real (frente, verso e borda), empeno de papel (barriga de ~0,35 mm ao longo do
comprimento) e abertura em profundidade que cresce com a distância ao pivô (os cartões se afastam na ponta).
O leque é inclinado 12° para trás, como quem estende a mão.

CONTRATO DE UV: ver o cabeçalho de `prop_empreendedor_cartoes_arte.py` (malha `cartoes`; TEXCOORD_0 atlas 1024×864
com a célula de cada cartão; TEXCOORD_1 `UVCartao` 0..1 por face, u = 0 na ponta longe do pivô, v = 1 em cima).
Material único `cartoes_papel` (rugosidade 0,85, sem metal, sem transmissão, sem alfa): baseColor = atlas JPEG opaco
(RASCUNHO para julgar; o texto definitivo pode virar canvas do site sobre o mesmo contrato).
Espaço local: Z para cima, frente para −Y, +X para a cabeça, origem no centro da base (regra da receita).
"""
import math
import os
import subprocess

import bmesh
import bpy
from mathutils import Matrix, Vector

import prop_empreendedor_base as B
import prop_empreendedor_cartoes_arte as A
import prop_financeiro_v6 as v6
from prop_financeiro_direita_papel import folha

ATLAS = os.path.join(v6.ROOT, '3d/captura/props/empreendedor/v2/cartoes/atlas-cartoes.jpg')
QUALIDADE = 65                                    # JPEG do atlas (o glb inteiro tem de ficar ≤ 120 kB)
MM, INCLINA = 0.001, math.radians(-12)            # metros por mm; topo do leque 12° para trás (+Y)
NI, NY = 7, 3                                     # colunas no miolo do comprimento e linhas na altura de cada face


def gerar_atlas():
    subprocess.run(['python3', A.__file__, ATLAS, str(QUALIDADE)], check=True)


def _colunas():
    """Abscissas d (mm) da face: cantos redondos (2 passos por canto) e o miolo em NI vãos."""
    r = A.RAIO
    ds = [r - r * math.cos(math.radians(a)) for a in (0, 45)]
    ds += [r + (A.W - 2 * r) * i / NI for i in range(NI + 1)]
    return ds + [A.W - d for d in reversed(ds[:2])]


def _extensao(d):
    """Faixa em y da face na abscissa d (o canto redondo encurta as colunas das pontas)."""
    r = A.RAIO
    dd = r - d if d < r else (d - (A.W - r) if d > A.W - r else 0.0)
    c = r - math.sqrt(max(0.0, r * r - dd * dd)) if dd > 0 else 0.0
    return c, A.H - c


def _ponto(k, d, y):
    """Ponto da face do cartão k no espaço do leque (Blender, metros): plano XZ, frente para −Y."""
    X, Y = A.para_mundo(k, d, y)
    raio = math.hypot(X, Y)
    abre = k * (0.62 + 0.011 * raio)                       # cartão de trás mais fundo; abre na ponta
    barriga = (0.30 + 0.05 * (k % 3)) * math.sin(math.pi * d / A.W) + 0.08 * (y / A.H - 0.5) * (1 - d / A.W)
    return Vector((X * MM, (-abre - barriga) * MM, Y * MM))


def _cartao(k):
    cols = _colunas()
    grade, uvs = [], []
    for d in cols:
        lo, hi = _extensao(d)
        linha, luv = [], []
        for j in range(NY + 1):
            y = lo + (hi - lo) * j / NY
            linha.append((_ponto(k, d, y), Vector((0, -1, 0))))
            luv.append(A.uv_atlas(k, d / A.W, y / A.H))
        grade.append(linha)
        uvs.append(luv)
    verso = A.uv_verso(k)
    return folha('cartao_%d' % k, grade, A.W * MM, A.ESP * MM, lambda i, j: uvs[i][j], lambda i: verso)


def _uv_cartao(bm):
    """Segunda UV (UVCartao): 0..1 próprio de cada face, lido de volta da célula do atlas; verso e bordas em (0, 0)."""
    uv, uc = bm.loops.layers.uv['UVMap'], bm.loops.layers.uv.new('UVCartao')
    cels = [A.celula(k) for k in range(A.N)]
    for f in bm.faces:
        for lp in f.loops:
            u, v = lp[uv].uv
            lp[uc].uv = (0.0, 0.0)
            for u0, v0, u1, v1 in cels:
                if u0 - 1e-6 <= u <= u1 + 1e-6 and v0 - 1e-6 <= v <= v1 + 1e-6:
                    lp[uc].uv = ((u - u0) / (u1 - u0), (v - v0) / (v1 - v0))


def _material(mats):
    """Papel: rugosidade 0,85, baseColor = atlas opaco (sem alfa, sem nó de matemática)."""
    m = mats('papel', 0.0, 0.85)
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    img = bpy.data.images.load(ATLAS, check_existing=False)
    img.name = 'cartoes_atlas'
    tx = nt.nodes.new('ShaderNodeTexImage')
    tx.image, tx.interpolation = img, 'Linear'
    nt.links.new(tx.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Specular IOR Level'].default_value = 0.35
    return m


def leque(mats):
    """Construtor do registro CANDIDATOS: devolve [malha `cartoes`] (1 material, 1 chamada de desenho)."""
    gerar_atlas()
    bm = bmesh.new()
    for k in range(A.N):
        o = _cartao(k)
        bm.from_mesh(o.data)
        me = o.data
        bpy.data.objects.remove(o)
        bpy.data.meshes.remove(me)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(INCLINA, 3, 'X'))
    xs, ys, zs = ([v.co[i] for v in bm.verts] for i in range(3))
    pivo = (-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs))   # o pivô comum (origem) vai para cá
    bmesh.ops.translate(bm, verts=bm.verts, vec=pivo)
    _uv_cartao(bm)
    obj = B.objeto('cartoes', bm, _material(mats), ang=60)
    obj['pivo'] = pivo                    # lido pelo movimento (leque abre em torno dele); não vai para o glb
    obj.data.uv_layers['UVMap'].active_render = True
    obj.data.uv_layers.active = obj.data.uv_layers['UVMap']
    return [obj]
