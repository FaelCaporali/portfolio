"""Primitivas de forma do modelador (bmesh) para o adereço do financeiro, v7.

Tudo em metros, no frame local da âncora (X = largura, −Y = frente, Z = altura). Superfície dura para a web: chanfro
real na geometria (perfil) ou por modificador, arestas nítidas marcadas por ângulo e normais ponderadas.
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector


def lin(s):
    return s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4


def material(nome, valor):
    """Material só de VALOR (notan, rugosidade 0,8): o lookdev troca o conteúdo e mantém o nome."""
    m = bpy.data.materials.get(nome) or bpy.data.materials.new(nome)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    v = lin(valor)
    b.inputs['Base Color'].default_value = (v, v, v, 1.0)
    b.inputs['Roughness'].default_value = 0.8
    b.inputs['Metallic'].default_value = 0.0
    return m


def caixa(bm, centro, dim):
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.LocRotScale(Vector(centro), None, Vector(dim)))


def cilindro(bm, centro, raio, comp, segs=32, rot=None):
    m = Matrix.Translation(Vector(centro)) @ (rot or Matrix.Identity(4))
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=raio, radius2=raio,
                          depth=comp, matrix=m)


def eixo_para(v):
    """Rotação que leva o Z local para a direção v."""
    return Vector(v).normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()


def haste(bm, a, b, raio, segs=16):
    a, b = Vector(a), Vector(b)
    cilindro(bm, (a + b) / 2, raio, (b - a).length, segs, eixo_para(b - a))


def revolucao(bm, perfil, segs, matriz=None, raio_de=None):
    """Sólido de revolução em torno do Z local: `perfil` = [(r, z)] de uma ponta do eixo à outra (r = 0 nas pontas).

    `raio_de(k, r)` opcional deforma o raio por segmento (ex.: soquete sextavado). Devolve os vértices por anel.
    """
    m = matriz or Matrix.Identity(4)
    aneis = []
    for r, z in perfil:
        if r == 0:
            aneis.append([bm.verts.new(m @ Vector((0, 0, z)))])
            continue
        anel = []
        for k in range(segs):
            t = 2 * math.pi * k / segs
            rr = raio_de(k, r) if raio_de else r
            anel.append(bm.verts.new(m @ Vector((rr * math.cos(t), rr * math.sin(t), z))))
        aneis.append(anel)
    for a, b in zip(aneis, aneis[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for k in range(segs):
            k2 = (k + 1) % segs
            if len(a) == 1:
                bm.faces.new((a[0], b[k2], b[k]))
            elif len(b) == 1:
                bm.faces.new((a[k], a[k2], b[0]))
            else:
                bm.faces.new((a[k], a[k2], b[k2], b[k]))
    return aneis


def anel(bm, centro, eixo, diam, comp, chanfro, segs=24):
    """Anel de fixação: cilindro curto com chanfro nas duas bordas (o fio passa por dentro, escondido)."""
    r, c, h = diam / 2, chanfro, comp / 2
    perfil = [(0, -h), (r - c, -h), (r, -h + c), (r, h - c), (r - c, h), (0, h)]
    revolucao(bm, perfil, segs, Matrix.Translation(Vector(centro)) @ eixo_para(eixo))


def prisma_xz(bm, pontos, y0, y1):
    """Polígono no plano XZ (anti-horário visto de −Y) extrudado de y0 a y1: sólido fechado."""
    frente = [bm.verts.new((x, y0, z)) for x, z in pontos]
    tras = [bm.verts.new((x, y1, z)) for x, z in pontos]
    bm.faces.new(frente)
    bm.faces.new(list(reversed(tras)))
    n = len(pontos)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((frente[j], frente[i], tras[i], tras[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])


def nitido(bm, angulo=35.0):
    """Faces lisas e arestas vivas acima do ângulo marcadas como nítidas (o glb separa as normais nelas)."""
    lim = math.radians(angulo)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > lim:
            e.smooth = False


def objeto(nome, preencher, mat, raiz, colecao, liso=False, angulo=None):
    bm = bmesh.new()
    preencher(bm)
    if angulo is not None:
        nitido(bm, angulo)
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    if angulo is None:
        for p in me.polygons:
            p.use_smooth = liso
    me.materials.append(mat)
    o = bpy.data.objects.new(nome, me)
    bpy.data.collections[colecao].objects.link(o)
    o.parent = raiz
    return o


def duro(o, largura, segs=2, angulo=30):
    """Superfície dura para a web: chanfro por ângulo com normais endurecidas + normais ponderadas (Keep Sharp)."""
    for p in o.data.polygons:
        p.use_smooth = True
    bev = o.modifiers.new('chanfro', 'BEVEL')
    bev.width, bev.segments, bev.limit_method = largura, segs, 'ANGLE'
    bev.angle_limit = math.radians(angulo)
    bev.harden_normals = True
    wn = o.modifiers.new('normais', 'WEIGHTED_NORMAL')
    wn.keep_sharp = True
    return o
