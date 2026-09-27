"""F1/F2/F3/F7/F8 `fs_adesivos`: os 12 adesivos de vinil nas costas da tampa, numa malha e num material só (atlas).

Cada adesivo: recorte (die-cut) do contorno de prop_fullstack_logos.py, 0,1 mm de espessura real, UV no atlas; nível 3
com um canto levantando (dobra em dois passos) e o verso à mostra. Ordem de colagem: nível 3 primeiro (embaixo), depois
2, depois 1 (Node por último): onde dois se encostam, o mais novo fica por cima (+0,13 mm por camada).
Quadro `fs_adesivos` (glb): origem no centro da borda de cima, NA SUPERFÍCIE das costas; +X = glb X, +Y ao longo da
tampa (para cima), +Z = normal das costas. LAYOUT em mm do scan: u = X, v = distância para baixo da borda de cima.
Nó `fs_adesivo_<slug>` = EMPTY no centro de cada adesivo (girado como ele), extras nivel, lado_cm e tam_cm (reais).
Segunda UV `Fade`: x = 1 (inteiro na faixa visível), y = índice do adesivo / 11 (ordem de ESTOQUE).
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

import prop_empreendedor_base as EB
import prop_fullstack_notebook as NB
import prop_vela_base as B

# slug: (u mm, v mm, giro em graus, canto que levanta (x, y) no quadro do adesivo ou None)
LAYOUT = {'node': (0, 60, -2, None), 'react': (-77, 33, 5, None), 'trpc': (-80, 92, -4, None),
          'express': (-141, 18, 3, None), 'reactnative': (-127, 60, -3, None), 'typescript': (78, 33, -5, None),
          'prisma': (80, 92, 4, None), 'postgresql': (140, 36, 6, None), 'python': (127, 92, -5, None),
          'c': (-162, 53, 7, (-1, 1)), 'laravel': (-160, 104, -6, (-1, -1)), 'r': (159, 100, 5, (1, -1))}
ESP_MM = 0.1                                   # espessura real do vinil
CAMADA = 0.13e-3                               # m (scan) por camada de colagem
DOBRAS = ((4.0, 9.0), (2.0, 13.0))             # (mm reais antes da ponta, graus): canto levantando do nível 3


def _area(pts):
    return 0.5 * sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))


def dentro(p, pol):
    x, y, ok = p[0], p[1], False
    for (x0, y0), (x1, y1) in zip(pol, pol[1:] + pol[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            ok = not ok
    return ok


def no_quadro(slug, pts_mm):
    """Contorno (mm reais, quadro do adesivo) → mm do scan no quadro `fs_adesivos` (u, −v)."""
    u, v, g, _ = LAYOUT[slug]
    c, s = math.cos(math.radians(g)), math.sin(math.radians(g))
    return [(u + NB.ESC * (x * c - y * s), -v + NB.ESC * (x * s + y * c)) for x, y in pts_mm]


def sobreposicao(pa, pb, passo=0.5):
    xs, ys = [p[0] for p in pa], [p[1] for p in pa]
    xb, yb = [p[0] for p in pb], [p[1] for p in pb]
    x0, x1, y0, y1 = max(min(xs), min(xb)), min(max(xs), max(xb)), max(min(ys), min(yb)), min(max(ys), max(yb))
    if x0 >= x1 or y0 >= y1:
        return 0.0
    n, x = 0, x0
    while x < x1:
        y = y0
        while y < y1:
            n += dentro((x, y), pa) and dentro((x, y), pb)
            y += passo
        x += passo
    return n * passo * passo


def _uv_atlas(d, A):
    x0, y0, w, h = d['atlas_px']
    W, H = d['tam_mm']
    return lambda x, y: ((x0 + (x + W / 2) * w / W) / A, 1 - (y0 + (H / 2 - y) * h / H) / A)


def _adesivo(d, dados, camada):
    """bmesh do adesivo no quadro do adesivo (mm reais), já dobrado; z = camada."""
    t = bmesh.new()
    uvl = t.loops.layers.uv.new('UVMap')
    pts = [tuple(p) for p in d['contorno_mm']]
    if _area(pts) < 0:
        pts = pts[::-1]
    uv = _uv_atlas(d, dados['atlas'])
    A = dados['atlas']
    vx, vy, vw, vh = dados['verso_px']
    uv_verso = ((vx + vw / 2) / A, 1 - (vy + vh / 2) / A)
    base = [t.verts.new((x, y, 0.0)) for x, y in pts]
    topo = [t.verts.new((x, y, ESP_MM)) for x, y in pts]
    faces = [t.faces.new(topo)]
    n = len(pts)
    faces += [t.faces.new((base[i], base[(i + 1) % n], topo[(i + 1) % n], topo[i])) for i in range(n)]
    for f in faces:
        for lp in f.loops:
            lp[uvl].uv = uv(lp.vert.co.x, lp.vert.co.y)
    canto = LAYOUT[d['slug']][3]
    if canto:
        verso = t.faces.new(base[::-1])
        for lp in verso.loops:
            lp[uvl].uv = uv_verso
    bmesh.ops.triangulate(t, faces=[f for f in t.faces if len(f.verts) > 4], ngon_method='BEAUTY')
    if canto:
        dr = Vector((canto[0], canto[1], 0)).normalized()
        ponta = max(v.co.dot(dr) for v in t.verts)
        for antes, _ in DOBRAS:
            geo = list(t.verts) + list(t.edges) + list(t.faces)
            bmesh.ops.bisect_plane(t, geom=geo, plane_co=dr * (ponta - antes), plane_no=dr)
        orig = {v: v.co.copy() for v in t.verts}
        eixo = Vector((0, 0, 1)).cross(dr)
        M = Matrix.Identity(4)
        for antes, graus in DOBRAS:
            p = M @ (dr * (ponta - antes))
            M = (Matrix.Translation(p) @ Matrix.Rotation(-math.radians(graus), 4, eixo) @ Matrix.Translation(-p)) @ M
            for v in t.verts:
                if orig[v].dot(dr) > ponta - antes + 1e-4:
                    v.co = M @ orig[v]
    return t


def construir(dados, mat):
    """Malha `fs_adesivos_malha` (quadro glb de `fs_adesivos`, convertido ao Blender) + medidas de colagem."""
    ordem = sorted(dados['adesivos'], key=lambda d: (-d['nivel'], d['lado_cm'] if d['slug'] != 'node' else 99))
    idx = {d['slug']: i for i, d in enumerate(dados['adesivos'])}
    pols = {d['slug']: no_quadro(d['slug'], d['contorno_mm']) for d in ordem}
    camada, sob = {}, {}
    for i, d in enumerate(ordem):
        s = d['slug']
        camada[s] = 0
        for e in ordem[:i]:
            a = sobreposicao(pols[s], pols[e['slug']])
            if a > 0:
                sob['%s×%s' % (e['slug'], s)] = round(a, 1)
                camada[s] = max(camada[s], camada[e['slug']] + 1)
    bm = bmesh.new()
    bm.loops.layers.uv.new('UVMap')
    faixas = {}
    for d in ordem:
        s = d['slug']
        u, v, g, _ = LAYOUT[s]
        M = (Matrix.Translation((u / 1000, -v / 1000, camada[s] * CAMADA)) @ Matrix.Rotation(math.radians(g), 4, 'Z')
             @ Matrix.Scale(NB.ESC / 1000, 4))
        n0 = len(bm.verts)
        EB.anexar(bm, _adesivo(d, dados, camada[s]), lambda p, M=M: NB.C @ (M @ p))
        faixas[s] = (n0, len(bm.verts), idx[s])
    ob = EB.objeto('fs_adesivos_malha', bm, mat, ang=35)
    me = ob.data
    lay = me.uv_layers.new(name='Fade')
    qual = [0] * len(me.vertices)
    for s, (a, b, k) in faixas.items():
        for i in range(a, b):
            qual[i] = k
    for p in me.polygons:
        for li, vi in zip(p.loop_indices, p.vertices):
            lay.data[li].uv = (1.0, qual[vi] / 11.0)
    me.uv_layers.active = me.uv_layers['UVMap']
    return ob, {'camada': camada, 'sobreposicao_mm2_scan': sob, 'poligonos_mm_scan': pols}


def vazios(dados, vazio):
    """EMPTY `fs_adesivo_<slug>` no centro de cada adesivo, filhos de `fs_adesivos`."""
    out = []
    M0 = NB.m_gl('adesivos')
    for d in dados['adesivos']:
        u, v, g, _ = LAYOUT[d['slug']]
        M = M0 @ Matrix.Translation((u / 1000, -v / 1000, 0)) @ Matrix.Rotation(math.radians(g), 4, 'Z')
        e = vazio('fs_adesivo_' + d['slug'], None, NB.para_bl(M))
        e['nivel'] = d['nivel']
        e['lado_cm'] = d['lado_cm']
        e['tam_cm'] = [round(x / 10, 2) for x in d['tam_mm']]
        out.append(e)
    return out


def material(pasta):
    cor = bpy.data.images.load(pasta + '/atlas_cor.webp', check_existing=False)
    cor.name = 'fs_adesivos_cor'
    orm = bpy.data.images.load(pasta + '/atlas_orm.webp', check_existing=False)
    orm.name = 'fs_adesivos_orm'
    return B.material('fs_vinil', 0.0, 0.3, cor_base=cor, orm=orm, vcor=False)
