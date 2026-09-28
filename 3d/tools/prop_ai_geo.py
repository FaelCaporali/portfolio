"""Geometria da receita do robô da vida `ai` ("AI Product Engineer"): peças fechadas em bmesh no quadro LOCAL do robô
com a convenção do glb (x = esquerda do robô, y para cima, z = frente do robô), em metros do scan (real × 1,2: `R`).

Cada nó do glb acumula as suas peças numa `Pecas`: região do ORM por face (UV na célula), cor por canto ('Col'),
grupo de medida por face (o que conta nas folgas) e a massa de cada peça fechada (volume × densidade, centroide) para o centro de
massa. Mid-poly: chanfro no perfil (2–3 segmentos) + Weighted Normal, sem subdivisão.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import prop_ai_material as MT

ESC = 1.2                                     # scan / real


def R(mm):
    """mm reais → metros do scan."""
    return mm * ESC / 1000.0


def bl(p):
    """glb (x, y, z) → Blender (x, −z, y); vale para pontos e direções."""
    return Vector((float(p[0]), float(-p[2]), float(p[1])))


def gl(v):
    return np.array((v[0], v[2], -v[1]), float)


def T(x=0.0, y=0.0, z=0.0):
    return Matrix.Translation((x, y, z))


def rot(eixo, graus):
    """Rotação no quadro glb: eixo 'x', 'y' ou 'z'."""
    return Matrix.Rotation(math.radians(graus), 4, eixo.upper())


def sec_ret(w, h, r, n=4):
    """Retângulo w × h (centro na origem) com cantos de raio r, anti-horário; r = 0 → 4 cantos vivos."""
    if r <= 1e-9:
        return [(w / 2, h / 2), (-w / 2, h / 2), (-w / 2, -h / 2), (w / 2, -h / 2)]
    a, b = w / 2 - r, h / 2 - r
    pts = []
    for cx, cy, a0 in ((a, b, 0), (-a, b, 90), (-a, -b, 180), (a, -b, 270)):
        pts += [(cx + r * math.cos(t), cy + r * math.sin(t))
                for t in np.linspace(math.radians(a0), math.radians(a0 + 90), n + 1)]
    return pts


# ------------------------------------------------------------------------------------------------------ primitivas
def _chanfrar(bm, bev, seg, ang=30):
    if bev <= 0:
        return
    vivas = [e for e in bm.edges if e.is_manifold and e.calc_face_angle(0) > math.radians(ang)]
    bmesh.ops.bevel(bm, geom=vivas, offset=bev, segments=seg, profile=0.5, affect='EDGES', clamp_overlap=True)


def prisma(contorno, h, bev=0.0, seg=2, ang=30):
    """Contorno [(x, z)] no plano do chão, extrudado em +y de 0 a h; chanfro nas arestas mais vivas que `ang`."""
    bm = bmesh.new()
    f = bm.faces.new([bm.verts.new((x, 0.0, z)) for x, z in contorno])
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, verts=[e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)], vec=(0, h, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    _chanfrar(bm, bev, seg, ang)
    return bm


def caixa(w, h, d, r=0.0, bev=0.0, seg=2):
    """Caixa w (x) × h (y, de 0 a h) × d (z), arestas verticais com raio r e chanfro `bev` no resto."""
    return prisma(sec_ret(w, d, r, 4 if r > R(3) else 3), h, bev, seg)


def revolver(perfil, seg=24):
    """Sólido de revolução em volta de +y: perfil [(r, y)] de baixo para cima (r = 0 nas pontas vira polo)."""
    bm = bmesh.new()
    aneis = []
    for r, y in perfil:
        if r < 1e-9:
            aneis.append([bm.verts.new((0.0, y, 0.0))])
        else:
            aneis.append([bm.verts.new((r * math.cos(t), y, r * math.sin(t)))
                          for t in np.linspace(0, 2 * math.pi, seg, endpoint=False)])
    for A, B in zip(aneis, aneis[1:]):
        for k in range(seg):
            k1 = (k + 1) % seg
            if len(A) == 1:
                bm.faces.new((A[0], B[k1], B[k]))
            elif len(B) == 1:
                bm.faces.new((A[k], A[k1], B[0]))
            else:
                bm.faces.new((A[k], A[k1], B[k1], B[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def cilindro(r, h, bev=0.0, seg=24):
    b = min(bev, r * 0.4, h * 0.4)
    return revolver([(0, 0), (r - b, 0), (r, b), (r, h - b), (r - b, h), (0, h)], seg)


def parafuso(d_mm, h_mm, seg=16):
    """Cabeça abaulada (ISO 7380) de diâmetro d e altura h (mm reais), eixo +y, base em y 0."""
    r, h = R(d_mm) / 2, R(h_mm)
    return revolver([(0, 0), (r, 0), (r, h * 0.35), (r * 0.8, h * 0.8), (r * 0.42, h), (0, h)], seg)


def sextavado(d_mm, prof_mm):
    """Fundo do sextavado interno (disco de 6 lados logo acima da cabeça, cor escura): leitura de parafuso real."""
    return revolver([(0, 0), (R(d_mm) / 2, 0), (R(d_mm) / 2, R(prof_mm)), (0, R(prof_mm))], 6)


def massa(bm, dens):
    """(massa em g reais, centroide) de uma peça FECHADA: volume pelo teorema da divergência (tetraedros na origem)."""
    V, C = 0.0, Vector()
    for tri in bm.calc_loop_triangles():
        a, b, c = (lp.vert.co for lp in tri)
        v = a.dot(b.cross(c)) / 6.0
        V += v
        C += v * (a + b + c) / 4.0
    if abs(V) < 1e-15:
        return 0.0, Vector()
    return abs(V) / ESC ** 3 * 1e6 * dens, C / V


# ---------------------------------------------------------------------------------------------------- acumulador
class Pecas:
    """Malha de um nó do glb: peças anexadas no quadro LOCAL DO ROBÔ (glb), região/cor/grupo por face e massas."""

    def __init__(self, nome):
        self.nome = nome
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.float_color.new('Col')
        self.uv = self.bm.loops.layers.uv.new('UVMap')
        self.reg = self.bm.faces.layers.int.new('reg')
        self.grp = self.bm.faces.layers.int.new('grupo')
        self.mat = self.bm.faces.layers.int.new('mat')
        self.massas = []                      # [(g, centroide no quadro do robô, rótulo)]
        self.pontos = {}                      # pontos notáveis (quadro do robô)

    def add(self, src, M, reg, cor, dens=None, grupo=0, rotulo='', mat=0):
        """Anexa `src` (bmesh; é consumido) levado por M; `reg` = região do ORM; `cor` = hex ou f(face)→hex;
        `mat` = índice do material no objeto; `grupo` = subconjunto de medida (folgas)."""
        src.transform(M)
        if dens:
            self.massas.append((*massa(src, dens), rotulo or reg))
        mapa = {}
        for v in src.verts:
            mapa[v] = self.bm.verts.new(v.co)
        novas = []
        for f in src.faces:
            try:
                g = self.bm.faces.new([mapa[v] for v in f.verts])
            except ValueError:
                continue
            g[self.reg] = MT.REGIOES[reg]
            g[self.grp] = grupo
            g[self.mat] = mat
            h = cor(f) if callable(cor) else cor
            c = MT.lin4(h)
            for lp in g.loops:
                lp[self.col] = c
            novas.append(g)
        src.free()
        return novas

    def marcar(self, n0, grupo):
        """Grupo de medida para as faces criadas depois de `n0` (len(bm.faces) antes das peças)."""
        self.bm.faces.ensure_lookup_table()
        for i in range(n0, len(self.bm.faces)):
            self.bm.faces[i][self.grp] = grupo

    def objeto(self, origem, materiais, angulo=32.0):
        """Objeto do Blender com os vértices relativos à `origem` (quadro do robô, glb), UV por célula da região,
        materiais pelo índice por face, suave por ângulo e Weighted Normal (Keep Sharp). Grava o atributo de face
        'grupo' (medidas)."""
        bm = self.bm
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        MT.uv_regioes(bm, self.uv, self.reg)
        for f in bm.faces:
            f.material_index = f[self.mat]
        o = Vector(origem)
        for v in bm.verts:
            p = v.co - o
            v.co = Vector((p.x, -p.z, p.y))
        me = bpy.data.meshes.new(self.nome)
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = True
        me.set_sharp_from_angle(angle=math.radians(angulo))
        for m in materiais:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.nome, me)
        bpy.context.scene.collection.objects.link(ob)
        md = ob.modifiers.new('Normais', 'WEIGHTED_NORMAL')
        md.keep_sharp, md.mode, md.weight = True, 'FACE_AREA', 50
        return ob


def aplicar_modificadores(ob):
    """Troca os dados pelo resultado avaliado (modificadores aplicados) e limpa a pilha."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    velho = ob.data
    ob.modifiers.clear()
    ob.data = me
    me.name = velho.name
    bpy.data.meshes.remove(velho)
    return ob


def booleana(base_bm, cortes, bev=0.0, seg=2, ang=30):
    """Diferença Exact de `base_bm` menos os bmesh `cortes`, depois chanfro nas arestas vivas novas. Tudo no mesmo
    quadro; devolve um bmesh novo (os de entrada são consumidos)."""
    def ob_de(bm, nome):
        me = bpy.data.meshes.new(nome)
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new(nome, me)
        bpy.context.scene.collection.objects.link(o)
        return o
    alvo = ob_de(base_bm, '_bool_alvo')
    col = bpy.data.collections.new('_cortes')
    bpy.context.scene.collection.children.link(col)
    for k, c in enumerate(cortes):
        o = ob_de(c, '_corte%d' % k)
        bpy.context.scene.collection.objects.unlink(o)
        col.objects.link(o)
    md = alvo.modifiers.new('Bool', 'BOOLEAN')
    md.operation, md.solver, md.operand_type, md.collection = 'DIFFERENCE', 'EXACT', 'COLLECTION', col
    if bev:
        bv = alvo.modifiers.new('Chanfro', 'BEVEL')
        bv.width, bv.segments, bv.limit_method, bv.angle_limit = bev, seg, 'ANGLE', math.radians(ang)
        bv.profile, bv.harden_normals = 0.5, False
    aplicar_modificadores(alvo)
    out = bmesh.new()
    out.from_mesh(alvo.data)
    for o in list(col.objects):
        bpy.data.meshes.remove(o.data)
    bpy.data.collections.remove(col)
    bpy.data.meshes.remove(alvo.data)
    bmesh.ops.recalc_face_normals(out, faces=out.faces)
    return out
