"""Adereço da vida "Financial Assistant", lado DIREITO do busto: calculadora de fita imprimindo, bobina, fita e boleto.

Headless (fonte de verdade, reprodutível):
    blender -b --python 3d/tools/prop_financeiro_direita.py -- [glb=3d/export/props/lab/financeiro_direita.glb]
        [rascunho=<pasta com fita.jpg e boleto.jpg>|0] [provas=<pasta>|0] [tag=r1]

Mesmo ofício da v6 (`prop_financeiro_v6.py`, de onde vêm srgb, material, shade e mesh_obj). Unidades: metros na escala
do scan do S13. Espaço local da peça (Blender, Z para cima, frente para −Y = +Z no glTF): origem no centro da base da
calculadora; +X aponta para a cabeça. A raiz `financeiro_direita` já vem na posição e no giro da ficha.
Malhas: carcaca, teclas (cor por vértice; UV em atlas 6×4 para legendas), cabecote (tampa, serrilha e arame, metal),
bobina, fita (u na largura, v = 0 na fenda e 1 na ponta; verso e bordas em u = 0,01, margem sem tinta), boleto (UV
0..1 na face; verso em 0,004). O texto é canvas do site; o rascunho (PIL) só serve para julgar leitura e escala.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [AQUI, os.path.join(AQUI, 'props')]
import comum  # noqa: E402
import prop_financeiro_v6 as v6  # noqa: E402
import prop_financeiro_direita_papel as papel  # noqa: E402
from prop_financeiro_direita_papel import TAPE_W, TAPE_X, TOPO, boleto, fita  # noqa: E402

ROOT = v6.ROOT
ARGS = v6.ARGS
GLB = os.path.join(ROOT, ARGS.get('glb', '3d/export/props/lab/financeiro_direita.glb'))

# Medidas (compartilhadas com o site quando ele desenhar a fita e o boleto)
W, D = 0.085, 0.060                                  # carcaça: largura (X) e profundidade (Y)
PERFIL = [(-0.030, 0.0), (0.030, 0.0), (0.030, 0.031), (0.026, 0.035), (0.004, 0.035), (0.002, 0.024),
          (-0.027, 0.0125), (-0.030, 0.0100)]       # corte lateral (y, z): teclado inclinado ~22°, cabeçote atrás
DECK = (Vector((0, 0.002, 0.024)), Vector((0, -0.027, 0.0125)))
ROLL_R, ROLL_CORE, ROLL_W, ROLL_C = 0.016, 0.0068, 0.035, (0.050, 0.053)
RAIZ_GL, GIRO = (-0.165, 0.06, -0.26), 0.6          # espaço do glb (Y para cima); giro em Y (rad). x −0,165: pedido do Fael (calculadora longe do rosto)
# Varredura de composição (só medida): raiz=x,y,z giro= bol_x= bol_yaw= sobrepõem os valores acima.
RAIZ_GL = tuple(float(c) for c in ARGS['raiz'].split(',')) if 'raiz' in ARGS else RAIZ_GL
GIRO = float(ARGS.get('giro', GIRO))
ESCALA = float(ARGS.get('escala', 1.0))              # escala uniforme da raiz (equilíbrio com o painel da v6)
papel.BOL_X, papel.BOL_YAW = float(ARGS.get('bol_x', papel.BOL_X)), float(ARGS.get('bol_yaw', papel.BOL_YAW))

COR = {'num': '#2c2e33', 'op': '#4b4f56', 'mais': '#9a5b3c', 'visor': '#1d2320',
       'papel': '#f1ede4', 'miolo': '#a98459'}


def lin(hexcor):
    return v6.srgb(hexcor)


def carcaca():
    """Casco de plástico: perfil lateral extrudado na largura, chanfro real (Bevel 3 segmentos) e normais por ângulo."""
    bm = bmesh.new()
    lados = [[bm.verts.new((sx * W / 2, y, z)) for y, z in PERFIL] for sx in (-1, 1)]
    n = len(PERFIL)
    bm.faces.new(lados[0])
    bm.faces.new(list(reversed(lados[1])))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lados[0][i], lados[0][j], lados[1][j], lados[1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = v6.mesh_obj('carcaca', bm)
    bev = obj.modifiers.new('Chanfro', 'BEVEL')
    bev.width, bev.segments, bev.limit_method, bev.angle_limit = 0.0014, 3, 'ANGLE', math.radians(25)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier='Chanfro')
    v6.shade(obj, 35)
    return obj


def caixa(sx, sy, sz, bev, seg=2):
    """Caixa centrada na origem com todas as arestas chanfradas (bmesh próprio, para anexar em outra malha)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges), offset=bev, segments=seg, profile=0.5,
                    affect='EDGES', clamp_overlap=True)
    return bm


def anexar(dst, src, mapa):
    """Anexa `src` em `dst` levando cada vértice por `mapa(Vector)`; devolve as faces novas."""
    for v in src.verts:
        v.co = mapa(v.co.copy())
    me = bpy.data.meshes.new('_tmp')
    src.to_mesh(me)
    src.free()
    antes = len(dst.faces)
    dst.from_mesh(me)
    bpy.data.meshes.remove(me)
    dst.faces.ensure_lookup_table()
    return list(dst.faces)[antes:]


def teclas():
    """Teclado 3×4 + colunas de operação e a tecla grande de +, no plano inclinado; visor e botão de avanço do papel."""
    bm = bmesh.new()
    cor = bm.loops.layers.float_color.new('Col')
    uv = bm.loops.layers.uv.new('UVMap')
    d = (DECK[1] - DECK[0]).normalized()
    nrm = Vector((0, d.z, -d.y))
    L = (DECK[1] - DECK[0]).length
    kw, kd, kh = 0.0104, 0.0056, 0.0030
    for col in range(6):
        for row in range(4):
            if col == 5 and row == 3:
                continue
            grande = col == 5 and row == 2
            dep = kd + 0.22 * L if grande else kd
            t = (0.72 if grande else 0.17 + 0.22 * row)
            base = DECK[0] + (DECK[1] - DECK[0]) * t + Vector((-0.0315 + col * 0.0126, 0, 0))
            faces = anexar(bm, caixa(kw, dep, kh, 0.0008),
                           lambda p, b=base, dp=dep: b + Vector((p.x, 0, 0)) - d * p.y + nrm * (p.z + kh / 2 - 0.0006))
            tom = 'mais' if grande else ('num' if col < 3 else 'op')
            v0 = 0.0 if grande else 1 - (row + 1) / 4
            for f in faces:
                for lp in f.loops:
                    lp[cor] = lin(COR[tom])
                    rel = lp.vert.co - base
                    a, b = rel.x / kw + 0.5, -rel.dot(d) / dep + 0.5
                    lp[uv].uv = (col / 6 + min(max(a, 0), 1) / 6, v0 + min(max(b, 0), 1) * (0.5 if grande else 0.25))
    # Visor de cristal líquido na face do cabeçote (inclinada ~11° para trás).
    f0, f1 = Vector((0, 0.004, 0.035)), Vector((0, 0.002, 0.024))
    fd = (f1 - f0).normalized()
    fn = Vector((0, -abs(fd.z), abs(fd.y)))        # para fora: −Y e um pouco para cima
    c = f0 + (f1 - f0) * 0.45 + Vector((-0.021, 0, 0))
    faces = anexar(bm, caixa(0.030, 0.0056, 0.0008, 0.0003),
                   lambda p: c + Vector((p.x, 0, 0)) + fd * -p.y + fn * (p.z + 0.0002))
    # Botão de avanço do papel (lado da cabeça), eixo em X.
    kn = bmesh.new()
    bmesh.ops.create_cone(kn, cap_ends=True, cap_tris=False, segments=28, radius1=0.0056, radius2=0.0056, depth=0.0036)
    bmesh.ops.bevel(kn, geom=[e for e in kn.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6],
                    offset=0.0008, segments=2, profile=0.5, affect='EDGES', clamp_overlap=True)
    faces += anexar(bm, kn, lambda p: Vector((W / 2 + 0.0017 + p.z, 0.016 + p.y, 0.036 + p.x)))
    for f in faces:
        for lp in f.loops:
            lp[cor] = lin(COR['visor'] if f.calc_center_median().x < 0 else COR['num'])
            lp[uv].uv = (0.001, 0.001)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = v6.mesh_obj('teclas', bm)
    v6.shade(obj, 40)
    return obj


def arredondar(pts, r, n=5):
    """Polilinha com cantos curvos de raio ~r (arame dobrado, não emendado)."""
    out = [pts[0]]
    for a, b, c in zip(pts, pts[1:], pts[2:]):
        p0, p2 = b + (a - b).normalized() * r, b + (c - b).normalized() * r
        out += [(1 - t) ** 2 * p0 + 2 * (1 - t) * t * b + t * t * p2 for t in (i / n for i in range(n + 1))]
    return out + [pts[-1]]


def tubo(bm, pts, raio):
    cu = bpy.data.curves.new('_arame', 'CURVE')
    cu.dimensions, cu.bevel_depth, cu.bevel_resolution, cu.use_fill_caps = '3D', raio, 2, True
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for p, q in zip(sp.points, pts):
        p.co = (q.x, q.y, q.z, 1)
    ob = v6.link(bpy.data.objects.new('_arame', cu))
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bm.from_mesh(me)
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    bpy.data.meshes.remove(me)


def cabecote():
    """Tampa do cabeçote, lâmina serrilhada de corte na frente da fenda e o arame que segura bobina e papéis."""
    bm = bmesh.new()
    anexar(bm, caixa(0.040, 0.0090, 0.0056, 0.0016, 3), lambda p: p + Vector((TAPE_X, 0.0155, TOPO + 0.0022)))
    lam = bmesh.new()
    w, h, dentes = 0.036, 0.0065, 18
    contorno = [(-w / 2, 0.0), (w / 2, 0.0)]
    for i in range(dentes + 1):
        x = w / 2 - i * w / dentes
        contorno += [(x, h)] + ([(x - w / dentes / 2, h + 0.0009)] if i < dentes else [])
    f = lam.faces.new([lam.verts.new((x, 0, z)) for x, z in contorno])
    ext = bmesh.ops.extrude_face_region(lam, geom=[f])
    bmesh.ops.translate(lam, verts=[e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)], vec=(0, 0.0008, 0))
    bmesh.ops.triangulate(lam, faces=[f for f in lam.faces if len(f.verts) > 4])
    tilt = Matrix.Rotation(math.radians(-12), 3, 'X')
    anexar(bm, lam, lambda p: tilt @ p + Vector((TAPE_X, 0.0068, TOPO - 0.0015)))
    V = Vector
    tubo(bm, arredondar([V((-0.040, 0.027, 0.030)), V((-0.040, 0.0306, 0.082)), V((0.0405, 0.0306, 0.082)),
                         V((0.0405, 0.027, 0.030))], 0.004), 0.0011)
    for x in (TAPE_X - ROLL_W / 2 - 0.0015, TAPE_X + ROLL_W / 2 + 0.0015):
        tubo(bm, [V((x, 0.027, 0.031)), V((x, ROLL_C[0], ROLL_C[1]))], 0.0012)
    tubo(bm, [V((TAPE_X - ROLL_W / 2 - 0.0015, *ROLL_C)), V((TAPE_X + ROLL_W / 2 + 0.0015, *ROLL_C))], 0.0024)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    obj = v6.mesh_obj('cabecote', bm)
    v6.shade(obj, 40)
    return obj


def bobina():
    """Rolo de papel térmico no miolo de papelão (torno de um perfil em X) e o papel que desce do rolo ao cabeçote."""
    bm = bmesh.new()
    cor = bm.loops.layers.float_color.new('Col')
    h, r, e = ROLL_W / 2, ROLL_R, 0.0007
    perfil = [(ROLL_CORE - 0.0013, -h), (ROLL_CORE, -h), (r - e, -h), (r, -h + e), (r, h - e), (r - e, h),
              (ROLL_CORE, h), (ROLL_CORE - 0.0013, h)]
    seg = 48
    aneis = [[bm.verts.new((TAPE_X + x, ROLL_C[0] + rr * math.cos(2 * math.pi * k / seg),
                            ROLL_C[1] + rr * math.sin(2 * math.pi * k / seg))) for k in range(seg)] for rr, x in perfil]
    for i in range(len(perfil)):
        a, b = aneis[i], aneis[(i + 1) % len(perfil)]
        tom = 'papel' if 1 <= i <= 5 else 'miolo'
        for k in range(seg):
            f = bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
            for lp in f.loops:
                lp[cor] = lin(COR[tom])
    # Papel do rolo até a entrada do cabeçote (tangente por baixo do rolo).
    cy, cz = ROLL_C
    ang = math.atan2(0.034 - cz, 0.027 - cy) + math.acos(r / math.hypot(0.027 - cy, 0.034 - cz))
    t0 = (cy + r * math.cos(ang), cz + r * math.sin(ang))
    for s in (-1, 1):
        q = [bm.verts.new((TAPE_X + s * (TAPE_W / 2), y, z)) for y, z in (t0, (0.027, 0.034))]
        q2 = [bm.verts.new((TAPE_X - s * (TAPE_W / 2), y, z)) for y, z in (t0, (0.027, 0.034))]
        f = bm.faces.new((q[0], q[1], q2[1], q2[0]))
        for lp in f.loops:
            lp[cor] = lin(COR['papel'])
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)[:-2])
    obj = v6.mesh_obj('bobina', bm)
    v6.shade(obj, 50)
    return obj


def materiais(rascunho):
    def com_cor_vertice(m):
        nt = m.node_tree
        ca = nt.nodes.new('ShaderNodeVertexColor')
        ca.layer_name = 'Col'
        nt.links.new(ca.outputs['Color'], next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'])
        return m

    def com_textura(m, arq):
        if rascunho in ('0', None) or not os.path.exists(os.path.join(ROOT, rascunho, arq)):
            return m
        nt = m.node_tree
        tx = nt.nodes.new('ShaderNodeTexImage')
        tx.image = bpy.data.images.load(os.path.join(ROOT, rascunho, arq))
        nt.links.new(tx.outputs['Color'], next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'])
        return m

    return {
        'carcaca': v6.material('PlasticoBege', '#b8b1a2', 0.0, 0.55),
        'teclas': com_cor_vertice(v6.material('TeclaGrafite', '#ffffff', 0.0, 0.4)),
        'cabecote': v6.material('AcoEscovado', '#a7abb2', 1.0, 0.34),
        'bobina': com_cor_vertice(v6.material('PapelRolo', '#ffffff', 0.0, 0.8)),
        'fita': com_textura(v6.material('PapelTermico', '#f4f1ea', 0.0, 0.8, double=True), 'fita.jpg'),
        'boleto': com_textura(v6.material('PapelSulfite', '#f3f3ef', 0.0, 0.85, double=True), 'boleto.jpg'),
    }


def build():
    v6.reset()
    raiz = v6.link(bpy.data.objects.new('financeiro_direita', None))
    raiz.location = comum.gl_para_bl(RAIZ_GL)
    raiz.rotation_euler = (0, 0, GIRO)
    raiz.scale = (ESCALA,) * 3
    mats = materiais(ARGS.get('rascunho', '0'))
    objs = [carcaca(), teclas(), cabecote(), bobina(), fita(), boleto()]
    for o in objs:
        o.data.materials.append(mats[o.name])
        o.parent = raiz
    return raiz, objs


if __name__ == '__main__':
    raiz, objs = build()
    # Posição float: Calculadora.tsx usa a geometria de cada malha fora do nó dela (otimizar.mjs --posicao-float).
    comum.exportar_glb([raiz] + objs, GLB, posicao_float=True)
    print('EXPORT', GLB, os.path.getsize(GLB), 'bytes', {o.name: len(o.data.polygons) for o in objs})
    if ARGS.get('provas', '0') != '0':
        import prop_financeiro_direita_prova as prova
        prova.rodar(raiz, objs, ARGS['provas'], ARGS.get('tag', 'r1'))
