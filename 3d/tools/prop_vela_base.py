"""Base da receita da vida `vela` (prop_vela.py): busto de referência como superfície de ajuste, malhas por grade,
materiais PBR que sobrevivem ao glTF e imagens geradas (numpy → WebP).

Espaço: Blender (Z para cima, rosto para −Y), o mesmo do busto importado por `comum.importar_busto` (identidade com o
espaço do glb do site: (x, y, z)_gl = (x, z, −y)_bl). Unidades: metros na escala do scan do S13.
"""
import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import prop_empreendedor_base as EB
import prop_financeiro_v6 as v6
from prop_vela_img import lin, normal_de_altura, ruido  # noqa: F401 (reexportados: B.lin, B.ruido…)

ROOT = v6.ROOT
srgb, objeto, colecao, mover, torno, placa, anexar, caixa = (v6.srgb, EB.objeto, EB.colecao, EB.mover, EB.torno,
                                                               EB.placa, EB.anexar, EB.caixa)
PELE = 'Busto_malha'
CENTRO = Vector((0.0, 0.10, 0.17))            # centro da cabeça (Blender) para os testes de dentro/fora


# ------------------------------------------------------------------------------------------------ busto como superfície
class Busto:
    """Superfícies do S13 (pele e olhos) em coordenadas de mundo, com as chaves de forma pedidas aplicadas."""

    def __init__(self, objs):
        self.malhas = {o.name: o for o in objs if o.type == 'MESH'}
        self.pele = self.malhas[PELE]
        self.arvores = {}

    def pose(self, **chaves):
        """Aplica as chaves (as demais em 0) e reconstrói as árvores. Ex.: pose(mouthSmileLeft=1, mouthSmileRight=1)."""
        for o in self.malhas.values():
            if o.data.shape_keys:
                for k in o.data.shape_keys.key_blocks[1:]:
                    k.value = float(chaves.get(k.name, 0.0))
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        self.arvores = {}
        for nome, o in self.malhas.items():
            bm = bmesh.new()
            bm.from_object(o, dg)
            bm.transform(o.matrix_world)
            self.arvores[nome] = BVHTree.FromBMesh(bm)
            if nome == PELE:
                self.bm_pele = bm
            else:
                bm.free()
        return self

    def raio(self, origem, direcao, nomes=(PELE,)):
        """Ponto mais externo na direção: raio de fora (0,6 m) para dentro."""
        d = Vector(direcao).normalized()
        de = Vector(origem) + d * 0.6
        melhor = None
        for n in nomes:
            h = self.arvores[n].ray_cast(de, -d, 0.6)
            if h[0] is not None and (melhor is None or h[3] < melhor[3]):
                melhor = h
        return melhor  # (pos, normal, índice, distância) ou None

    def dentro(self, p, nomes=(PELE,)):
        """Dentro = há superfície mais para fora no raio que sai do centro da cabeça pelo ponto (o sinal pela normal
        da face mais próxima falha no scan: pálpebra fechada e dobras têm normais trocadas)."""
        d = (Vector(p) - CENTRO).normalized()
        return any(self.arvores[n].ray_cast(Vector(p) + d * 1e-5, d, 0.4)[0] is not None for n in nomes)

    def perto(self, p, nomes=(PELE,)):
        """(ponto mais próximo, normal, distância com sinal: negativo = dentro da pele)."""
        melhor = None
        for n in nomes:
            q, nrm, _, d = self.arvores[n].find_nearest(Vector(p))
            if q is not None and (melhor is None or d < melhor[2]):
                melhor = (q, nrm, d)
        if melhor is not None and self.dentro(p, nomes):
            melhor = (melhor[0], melhor[1], -melhor[2])
        return melhor


def folga(busto, objs, nomes=(PELE,), amostra=1):
    """Distância com sinal (m) de cada vértice avaliado de `objs` à pele: (mínima, nº de vértices dentro)."""
    dg = bpy.context.evaluated_depsgraph_get()
    dmin, dentro = 9.0, 0
    for o in objs:
        me = o.evaluated_get(dg).to_mesh()
        mw = o.matrix_world
        for i in range(0, len(me.vertices), amostra):
            r = busto.perto(mw @ me.vertices[i].co, nomes)
            if r is None:
                continue
            dmin = min(dmin, r[2])
            dentro += r[2] < 0
        o.evaluated_get(dg).to_mesh_clear()
    return dmin, dentro


# ---------------------------------------------------------------------------------------------------------- malhas
def grade(bm, P, fechado_u=False, uv=None, cor=None):
    """Faces quad de uma grade de pontos P[i][j] (i ao longo de u). uv(i, j) → (u, v); cor(i, j) → hex. Devolve as
    faces novas, na ordem (i, j)."""
    camada_uv = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
    V = [[bm.verts.new(p) for p in linha] for linha in P]
    ni, nj = len(V), len(V[0])
    faces = []
    for i in range(ni if fechado_u else ni - 1):
        i1 = (i + 1) % ni
        for j in range(nj - 1):
            f = bm.faces.new((V[i][j], V[i1][j], V[i1][j + 1], V[i][j + 1]))
            if uv:
                for lp, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                    lp[camada_uv].uv = uv(a, b)
            faces.append(f)
    if cor:
        EB.pintar(bm, faces, lambda f: cor(f))
    return faces


def uv_caixa(bm, faces, escala, ilha=(0.0, 0.0, 1.0, 1.0)):
    """UV por projeção na caixa (eixo dominante da normal), escala em UV por metro, dentro de `ilha` (u0, v0, u1, v1)
    com repetição por módulo: bom para ruído de rugosidade sem costura visível."""
    camada = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
    bm.normal_update()
    u0, v0, u1, v1 = ilha
    for f in faces:
        n = f.normal
        ax = max(range(3), key=lambda k: abs(n[k]))
        a, b = [k for k in range(3) if k != ax]
        for lp in f.loops:
            p = lp.vert.co
            s, t = (p[a] * escala) % 1.0, (p[b] * escala) % 1.0
            lp[camada].uv = (u0 + (u1 - u0) * (0.02 + 0.96 * s), v0 + (v1 - v0) * (0.02 + 0.96 * t))


# Material `vela_rigido` (tudo que é duro: cascos, mastros, armação, apito): cor por vértice × ORM de regiões.
# Cada região é uma célula 4 × 2 do ORM (G = rugosidade com ruído próprio, B = metal); a malha põe a UV na célula.
REGIOES = {'gelcoat': 0, 'antiderrapante': 1, 'aluminio': 2, 'acetato': 3, 'borracha': 4, 'cabo': 5, 'plastico': 6,
           'lamina': 7}
ORM_REG = {'gelcoat': (0.26, 0.07, 0), 'antiderrapante': (0.78, 0.10, 0), 'aluminio': (0.36, 0.08, 1),
           'acetato': (0.16, 0.05, 0), 'borracha': (0.72, 0.08, 0), 'cabo': (0.88, 0.06, 0),
           'plastico': (0.42, 0.08, 0), 'lamina': (0.30, 0.10, 0)}


def celula(reg):
    k = REGIOES[reg]
    u0, v0 = (k % 4) / 4, (k // 4) / 2
    return (u0 + 0.01, v0 + 0.01, u0 + 0.24, v0 + 0.49)


def uv_reg(bm, faces, reg, escala=40.0):
    uv_caixa(bm, faces, escala, celula(reg))


def orm_regioes(pasta):
    """ORM 256 × 128 das regiões (R = 1, G = rugosidade com ruído, B = metal) → imagem WebP."""
    h, w = 128, 256
    img = np.ones((h, w, 3))
    for reg, k in REGIOES.items():
        base, var, metal = ORM_REG[reg]
        y0, x0 = (k // 4) * 64, (k % 4) * 64
        r = ruido(64, 64, 4, 11 + k)
        if reg == 'antiderrapante':                     # grão em pontos do antiderrapante
            g = np.indices((64, 64)).sum(0) % 3 == 0
            r = r * 0.6 + 0.4 * g
        img[y0:y0 + 64, x0:x0 + 64, 1] = np.clip(base + var * (r - 0.5) * 2, 0.05, 1)
        img[y0:y0 + 64, x0:x0 + 64, 2] = metal
    return imagem('vela_orm', img, pasta, qualidade=92)


def uv_fixo(bm, faces, uv):
    camada = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
    for f in faces:
        for lp in f.loops:
            lp[camada].uv = uv


def tubo_pts(bm, pts, raio, seg=8, tampa=True):
    """Tubo ao longo da polilinha 3D (quadro de transporte paralelo); tampas planas. Devolve as faces."""
    pts = [Vector(p) for p in pts]
    antes = len(bm.faces)
    t0 = (pts[1] - pts[0]).normalized()
    n = t0.orthogonal().normalized()
    aneis = []
    for k, p in enumerate(pts):
        t = ((pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)])).normalized()
        n = (n - t * n.dot(t)).normalized()
        b = t.cross(n)
        r = raio(k / (len(pts) - 1)) if callable(raio) else raio
        aneis.append([bm.verts.new(p + (n * math.cos(a) + b * math.sin(a)) * r)
                      for a in (2 * math.pi * s / seg for s in range(seg))])
    for A, C in zip(aneis, aneis[1:]):
        for s in range(seg):
            bm.faces.new((A[s], A[(s + 1) % seg], C[(s + 1) % seg], C[s]))
    if tampa:
        bm.faces.new(list(reversed(aneis[0])))
        bm.faces.new(aneis[-1])
    bm.faces.ensure_lookup_table()
    return [bm.faces[i] for i in range(antes, len(bm.faces))]


# ------------------------------------------------------------------------------------------------------- materiais
def _principled(m):
    return next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def imagem(nome, rgba, pasta, qualidade=90):
    """numpy (h, w, 4) float 0..1 em sRGB → WebP em `pasta` (codificado uma vez, com perda) → imagem do Blender com
    os bytes do arquivo (o exportador embute como estão, EXT_texture_webp)."""
    import subprocess
    os.makedirs(pasta, exist_ok=True)
    arq = os.path.join(pasta, nome + '.webp')
    a = (np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8)
    tmp = os.path.join('/data/tmp', nome + '.npy')
    np.save(tmp, np.ascontiguousarray(a[::-1]))
    # O Python do Blender não tem Pillow: o WebP sai do Python do sistema (o mesmo do bateria.sh do S13).
    cod = ("import numpy as n,sys;from PIL import Image;a=n.load(sys.argv[1]);"
           "Image.fromarray(a,'RGBA' if a.shape[2]==4 else 'RGB').save(sys.argv[2],'WEBP',quality=int(sys.argv[3]),"
           "method=6)")
    subprocess.run(['python3', '-c', cod, tmp, arq, str(qualidade)], check=True)
    img = bpy.data.images.load(arq, check_existing=False)
    img.name = nome
    return img


def material(nome, metal=0.0, rug=0.6, cor_base=None, orm=None, normal=None, vcor=True, alfa=False, double=False,
             forca_normal=1.0, uv_nome=None):
    """Principled que o glTF entende: base = (imagem ×) cor por vértice 'Col'; ORM (G rug., B metal) opcional;
    normal opcional; `alfa` = alfa da imagem base (só a lente). Sem transmissão, sem emissão."""
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    nt = m.node_tree
    b = _principled(m)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rug
    base = None
    if cor_base is not None:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = cor_base
        base = t
        if alfa:
            nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
            m.surface_render_method = 'BLENDED'
    if vcor:
        ca = nt.nodes.new('ShaderNodeVertexColor')
        ca.layer_name = 'Col'
        if base is not None:
            mix = nt.nodes.new('ShaderNodeMix')
            mix.data_type, mix.blend_type = 'RGBA', 'MULTIPLY'
            mix.inputs['Factor'].default_value = 1.0
            nt.links.new(base.outputs['Color'], mix.inputs[6])
            nt.links.new(ca.outputs['Color'], mix.inputs[7])
            nt.links.new(mix.outputs[2], b.inputs['Base Color'])
        else:
            nt.links.new(ca.outputs['Color'], b.inputs['Base Color'])
    elif base is not None:
        nt.links.new(base.outputs['Color'], b.inputs['Base Color'])
    if orm is not None:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = orm
        t.image.colorspace_settings.name = 'Non-Color'
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(t.outputs['Color'], sep.inputs['Color'])
        nt.links.new(sep.outputs['Green'], b.inputs['Roughness'])
        nt.links.new(sep.outputs['Blue'], b.inputs['Metallic'])
    if normal is not None:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = normal
        t.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = forca_normal
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    if uv_nome:                                     # textura na 2ª camada de UV (glTF texCoord 1)
        mapa = nt.nodes.new('ShaderNodeUVMap')
        mapa.uv_map = uv_nome
        for t in [n for n in nt.nodes if n.type == 'TEX_IMAGE']:
            nt.links.new(mapa.outputs['UV'], t.inputs['Vector'])
    m.use_backface_culling = not double
    return m
