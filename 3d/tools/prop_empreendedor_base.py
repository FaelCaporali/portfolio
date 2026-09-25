"""Base da receita do "Entrepreneur" (prop_empreendedor.py): helpers de malha, cor por vértice e material.

Reaproveita o ofício aprovado do financeiro: srgb/material/shade/mesh_obj de `prop_financeiro_v6` e caixa/anexar/tubo/
arredondar de `prop_financeiro_direita`. Cada candidato usa no máximo dois materiais; as cores dentro de um material
vêm da cor por vértice (camada 'Col'), como nas teclas da calculadora. Espaço local do Blender: Z para cima, frente
da peça para −Y (vira +Z no glTF), origem no centro da base.
"""
import math

import bmesh
import bpy
from mathutils import Vector

import prop_financeiro_v6 as v6
from prop_financeiro_direita import anexar, arredondar, caixa, tubo  # noqa: F401 (ofício aprovado, reexportado)


def hash01(*k):
    """Ruído determinístico 0..1 (variação reprodutível entre instâncias)."""
    x = math.sin(sum(v * (12.9898 + 31.7 * i) for i, v in enumerate(k))) * 43758.5453
    return x - math.floor(x)


def cores(bm):
    return bm.loops.layers.float_color.get('Col') or bm.loops.layers.float_color.new('Col')


def pintar(bm, faces, cor):
    """`cor`: hex para todas as faces ou função face → hex."""
    camada = cores(bm)
    for f in faces:
        v = v6.srgb(cor(f) if callable(cor) else cor)
        for lp in f.loops:
            lp[camada] = v
    return faces


def desde(bm, n):
    bm.faces.ensure_lookup_table()
    return [bm.faces[i] for i in range(n, len(bm.faces))]


def torno(bm, perfil, seg, a0=0.0, arco=None, raio=None, mapa=None):
    """Sólido de revolução em torno de Z. perfil [(r, z)] (r = 0 vira polo); arco None = volta completa;
    raio(r, z, ang) altera o raio (estrias, pregas); mapa(Vector) leva ao lugar. Devolve as faces novas."""
    cheio = arco is None
    arco = 2 * math.pi if cheio else arco
    n = seg if cheio else seg + 1
    antes = len(bm.faces)
    aneis = []
    for r, z in perfil:
        pts = [Vector((0, 0, z))] if r < 1e-9 else []
        for k in range(n if r >= 1e-9 else 0):
            a = a0 + arco * k / seg
            rr = raio(r, z, a) if raio else r
            pts.append(Vector((rr * math.cos(a), rr * math.sin(a), z)))
        aneis.append([bm.verts.new(mapa(p) if mapa else p) for p in pts])
    for A, B in zip(aneis, aneis[1:]):
        for k in range(seg):
            k1 = (k + 1) % n
            if len(A) == 1 and len(B) > 1:
                bm.faces.new((A[0], B[k1], B[k]))
            elif len(B) == 1 and len(A) > 1:
                bm.faces.new((A[k], A[k1], B[0]))
            elif len(A) > 1:
                bm.faces.new((A[k], A[k1], B[k1], B[k]))
    return desde(bm, antes)


def placa(bm, contorno, esp, bev=0.0, seg=2, mapa=None, ang=30):
    """Contorno 2D [(x, y)] extrudado em z (0..esp); chanfro só nas arestas mais vivas que `ang` graus."""
    t = bmesh.new()
    f = t.faces.new([t.verts.new((x, y, 0)) for x, y in contorno])
    ext = bmesh.ops.extrude_face_region(t, geom=[f])
    bmesh.ops.translate(t, verts=[e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)], vec=(0, 0, esp))
    bmesh.ops.recalc_face_normals(t, faces=t.faces)
    if bev:
        vivas = [e for e in t.edges if e.is_manifold and e.calc_face_angle(0) > math.radians(ang)]
        bmesh.ops.bevel(t, geom=vivas, offset=bev, segments=seg, profile=0.5, affect='EDGES', clamp_overlap=True)
    return anexar(bm, t, mapa or (lambda p: p))


def ret_arred(w, h, r, seg=4):
    """Contorno de retângulo de cantos redondos no plano (x, y), centrado."""
    return v6.rounded_rect(w, h, r, seg)


def objeto(nome, bm, mat, ang=35, normais=True, soldar=0.0):
    """Malha final: normais para fora, suave por ângulo, Weighted Normal (Keep Sharp) e o material."""
    if soldar:
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=soldar)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = v6.mesh_obj(nome, bm)
    v6.shade(obj, ang)
    if normais:
        m = obj.modifiers.new('Normais', 'WEIGHTED_NORMAL')
        m.keep_sharp, m.weight, m.mode = True, 50, 'FACE_AREA'
    obj.data.materials.append(mat)
    return obj


def material(nome, metal, rug, double=False):
    """PBR que sobrevive ao glTF: cor por vértice × branco, metal e rugosidade constantes, sem alfa."""
    m = v6.material(nome, '#ffffff', metal, rug, double=double)
    nt = m.node_tree
    ca = nt.nodes.new('ShaderNodeVertexColor')
    ca.layer_name = 'Col'
    nt.links.new(ca.outputs['Color'], next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'])
    return m


def colecao(nome):
    col = bpy.data.collections.get(nome) or bpy.data.collections.new(nome)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    return col


def mover(objs, col):
    for o in objs:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        col.objects.link(o)
