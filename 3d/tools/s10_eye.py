"""S10 olhos = s09_eye com: contorno D = E espelhado (s10_face.mirror_eye), borda do corte encaixada POR RAMO (superior/inferior)
para não serrilhar nos cantos agudos, e conferência numérica da borda contra a curva. Expõe a mesma interface do s09_eye
(usar S_EYE=s10_eye em s08_expr / s08_web)."""
import bpy, bmesh, json, os, numpy as np, importlib
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import s09_eye as B
B = importlib.reload(B)
ROOT = B.ROOT
B.CONT = json.load(open(ROOT + 'analise/gate/olhos_contorno_s10.json')); B.CENF = ROOT + 'analise/gate/olhos_centro_s10.json'
B.CEN.clear(); B.CEN.update(json.load(open(B.CENF)) if os.path.exists(B.CENF) else {}); B.POL.clear()
_tex0 = B.eye_texture
B.eye_texture = lambda **k: _tex0(path=ROOT + 'export/s10/olho_tex.png', **k)

# fundo do olho mais claro que no S09: de perfil o olho lia como buraco (parede, folha e esclera quase da mesma cor escura)
# S11: a esclera tem UMA cor só (o globo gira; se ela escurecesse longe da íris, ao olhar de lado apareceria um degrau contra a folha, que é fixa).
# Quem escurece junto às pálpebras é a calota de sombra, presa a elas.
B.COL['sclera_far'] = B.COL['sclera']; CONJ_IN, CONJ_MED, CONJ_LAT = B.COL['sclera'], (120, 62, 52), (100, 62, 54)
UPPER_WALL = False                                   # S12 liga (s10_build)
CONJ_BACK = 0.00035; SHELL_LIFT = 0.00045      # folha atrás e calota à frente do fundo G: 0,8 mm de folga. Com 0,3 mm a interpolação das duas malhas se cruzava e a sombra não cobria a folha

def _branches(Q):
    i0, i1 = Q[:, 0].argmin(), Q[:, 0].argmax(); a, b = sorted((i0, i1)); c1 = Q[a:b+1]; c2 = np.r_[Q[b:], Q[:a+1]]
    return ((c1, c2) if c1[:, 1].mean() > c2[:, 1].mean() else (c2, c1)), Q[i0], Q[i1]

def cut(s, shrink=0.0003, reach=0.0025):
    me, bm = B._bm(); Q, _ = B.hole(s, shrink=shrink); (up, lo), pa, pb = _branches(Q); F = B._region_faces(bm, s, 0.001)
    C = np.array([f.calc_center_median()[:] for f in F]); ins = B.inpoly(C[:, 0], C[:, 2], Q); dead = [f for f, k in zip(F, ins) if k]
    bvh = BVHTree.FromBMesh(bm); bmesh.ops.delete(bm, geom=dead, context='FACES'); bm.verts.ensure_lookup_table()
    npin = 0
    for _ in range(6):                                                  # vértice de borda com mais de 2 arestas de borda = estrangulamento (ponte de pele atravessando a ponta do canto)
        pin = [v for v in bm.verts if v.is_boundary and abs(v.co.x - Q[:, 0].mean()) < 0.03 and abs(v.co.z - Q[:, 1].mean()) < 0.02 and sum(e.is_boundary for e in v.link_edges) > 2]
        if not pin: break
        kill = {f for v in pin for f in v.link_faces if sum(e.is_boundary for e in f.edges) >= 2 or all(w.is_boundary for w in f.verts)}
        if not kill: break
        npin += len(kill); bmesh.ops.delete(bm, geom=list(kill), context='FACES'); bm.verts.ensure_lookup_table()
    print("   pontes de pele na ponta do canto removidas: %d faces" % npin)
    Bv = [v for v in bm.verts if v.is_boundary and abs(v.co.x - Q[:, 0].mean()) < 0.03 and abs(v.co.z - Q[:, 1].mean()) < 0.02 and v.co.y < B.CEN[s][1]]
    # ramo de cada vértice pela TOPOLOGIA do laço de borda (a corda canto-a-canto erra perto da ponta quando o contorno curva)
    Bs1 = set(Bv); nxt = {}
    for e in bm.edges:
        if e.is_boundary and e.verts[0] in Bs1 and e.verts[1] in Bs1: nxt.setdefault(e.verts[0], []).append(e.verts[1]); nxt.setdefault(e.verts[1], []).append(e.verts[0])
    va = min(nxt, key=lambda v: (v.co.x - pa[0])**2 + (v.co.z - pa[1])**2); loop = [va]; prev = None
    while True:
        c = [w for w in nxt[loop[-1]] if w is not prev]
        if not c or c[0] is va: break
        prev = loop[-1]; loop.append(c[0])
        if len(loop) > len(nxt) + 2: break
    ib = min(range(len(loop)), key=lambda i: (loop[i].co.x - pb[0])**2 + (loop[i].co.z - pb[1])**2); ch1, ch2 = loop[:ib+1], loop[ib:]
    isup = {}
    zm1 = np.mean([v.co.z for v in ch1]); zm2 = np.mean([v.co.z for v in ch2])
    for v in ch1: isup[v] = zm1 > zm2
    for v in ch2: isup.setdefault(v, zm2 > zm1)
    print("   laco de borda: %d vertices em ordem (de %d); ramos %d + %d" % (len(loop), len(Bv), len(ch1), len(ch2)))
    mv = []
    for v in Bv:
        x, z = v.co.x, v.co.z
        if v is va: k = pa
        elif v is loop[ib]: k = pb
        else:
            br = up if isup.get(v, z >= pa[1] + (pb[1] - pa[1])*(x - pa[0])/(pb[0] - pa[0])) else lo; d = np.hypot(br[:, 0] - x, br[:, 1] - z); k = br[d.argmin()]
        dist = float(np.hypot(k[0] - x, k[1] - z))
        if dist > reach: continue
        hit = bvh.ray_cast(Vector((k[0], -1.0, k[1])), Vector((0, 1, 0)))
        if hit[0] is None: continue
        mv.append(dist); v.co = hit[0]
    # lascas: face com os 3 vértices na borda atravessa a ponta aguda do canto -> sai
    Bs0 = set(Bv); sl = [f for f in bm.faces if all(v in Bs0 for v in f.verts)]
    if sl: bmesh.ops.delete(bm, geom=sl, context='FACES'); bm.verts.ensure_lookup_table()
    Bv = [v for v in Bv if v.is_valid and v.is_boundary and v.link_faces]; print("   lascas de canto removidas: %d" % len(sl))
    ob = bpy.data.objects['Busto']; vg = ob.vertex_groups.get('margem_'+s) or ob.vertex_groups.new(name='margem_'+s); idx = [v.index for v in Bv]
    # conferência: meio de cada aresta de borda contra a curva
    dev = []; Bs = set(Bv)
    for e in bm.edges:
        if e.is_boundary and e.verts[0] in Bs and e.verts[1] in Bs:
            m = (e.verts[0].co + e.verts[1].co)/2; dev.append(np.hypot(Q[:, 0] - m.x, Q[:, 1] - m.z).min())
    bm.to_mesh(me); me.update(); vg.add(idx, 1.0, 'REPLACE'); bm.free(); dev = np.array(dev)*1000
    print("CUT %s: %d faces removidas, %d de %d vertices de borda encostados (media %.2f, max %.2f mm); desvio da borda a curva: media %.3f, max %.3f mm, >0,15 mm: %d" % (s, len(dead), len(mv), len(Bv), np.mean(mv)*1000, np.max(mv)*1000, dev.mean(), dev.max(), (dev > 0.15).sum()))
B.cut = cut

def _conj(s):
    o = B.conj(s, col_in=CONJ_IN, col_med=CONJ_MED, col_lat=CONJ_LAT)
    for v in o.data.vertices: v.co.y += CONJ_BACK
    nt = o.data.materials[0].node_tree; em = next(n for n in nt.nodes if n.type == 'EMISSION')
    if not any(n.type == 'ATTRIBUTE' for n in nt.nodes):                # medido no S11: com o nó Color Attribute o EEVEE não desenha a sombra transparente sobre a folha (degrau de 20% contra o globo)
        for l in list(nt.links):
            if l.to_node == em: nt.links.remove(l)
        a = nt.nodes.new('ShaderNodeAttribute'); a.attribute_type = 'GEOMETRY'; a.attribute_name = 'cor'; nt.links.new(a.outputs['Color'], em.inputs['Color'])
    o.data.update(); return o

def tuck(nm, gap=0.0006):
    """Nenhum vértice de malha interna do olho pode ficar na frente da pele: fora da abertura, vai para trás da pele."""
    ob = bpy.data.objects[nm]; sk = bpy.data.objects['Busto']; me, bm = B._bm(); bvh = BVHTree.FromBMesh(bm); bm.free(); n = 0; worst = 0.0
    for v in ob.data.vertices:
        h = bvh.ray_cast(Vector((v.co.x, -1.0, v.co.z)), Vector((0, 1, 0)))
        if h[0] is None or h[1].y > -0.2: continue                     # raio passou pela abertura (ou pegou a parede, que é paralela ao raio)
        if v.co.y < h[0].y + gap: worst = max(worst, h[0].y + gap - v.co.y); v.co.y = h[0].y + gap; n += 1
    ob.data.update(); print("TUCK %s: %d vertices levados para tras da pele (pior caso estava %.2f mm a frente do limite)" % (nm, n, worst*1000))

def _fix_shadow_key(s):
    so = bpy.data.objects['Sombra_'+s]; kb = so.data.shape_keys.key_blocks; n = len(so.data.vertices); A = np.empty(n*3, np.float32); K = A.copy()
    kb[0].data.foreach_get('co', A); kb[B.ARKIT[s]].data.foreach_get('co', K); A = A.reshape(-1, 3); K = K.reshape(-1, 3); still = np.abs(K[:, 2] - A[:, 2]) < 1e-6; K[~still, 1] -= (SHELL_LIFT - 0.0003); K[still] = A[still]
    kb[B.ARKIT[s]].data.foreach_set('co', K.ravel())

def shell(s, **k):
    """Mesma interface do s09 (a versão web chama E.shell e E.blink): calota com a folga do S11 e sempre atrás da pele."""
    k.setdefault('lift', SHELL_LIFT); o = B.shell(s, **k); tuck('Sombra_'+s); return o

def blink(s):
    B.blink(s); _fix_shadow_key(s)

def wall_upper(s, col=(40, 18, 16)):
    """S12: vista de baixo, a parede da pálpebra SUPERIOR (3 a 9 mm de profundidade, pálpebra encapuzada) aparecia como uma faixa cor de vinho de bordas duras.
    Ela passa a ter a cor da sombra dos cílios, e lê como sombra da pálpebra. De frente a parede não aparece (é paralela ao olhar): nada muda de frente."""
    ob = bpy.data.objects['Busto']; me = ob.data; m = bpy.data.materials.get('ParedePalpebraSup')
    if not m:
        m = bpy.data.materials.new('ParedePalpebraSup'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = tuple((c/255.0)**2.2 for c in col) + (1,); o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs[0], o.inputs['Surface']); m.diffuse_color = tuple(c/255.0 for c in col) + (1,)
    names = [x.name for x in me.materials]
    if m.name not in names: me.materials.append(m); names.append(m.name)
    mi, m0 = names.index(m.name), names.index('ParedePalpebra'); xs, zu, zl = B._margins(s); cx = B.CEN[s][0]; n = 0
    for p_ in me.polygons:
        if p_.material_index == m0 and abs(p_.center.x - cx) < 0.03:
            zm = 0.5*(np.interp(p_.center.x, xs, zu) + np.interp(p_.center.x, xs, zl))
            if p_.center.z > zm: p_.material_index = mi; n += 1
    me.update(); print("PAREDE SUP %s: %d faces" % (s, n))

def build(s, cx, cz, pitch=-5.0, yaw=0.0):
    B.center(s, cx, cz); B.polar(s); B.subdiv(s); cut(s); B.rim(s); B.flat_materials(); B.wall_material(s); (wall_upper(s) if UPPER_WALL else None); B.ball(s, pitch=pitch, yaw=yaw); _conj(s); tuck('Conj_'+s); shell(s); blink(s)
    for nm in ('Olho_', 'Conj_', 'Sombra_'): bpy.data.objects[nm+s].parent = bpy.data.objects['Busto']

globals().update({k: getattr(B, k) for k in dir(B) if not k.startswith('__') and k not in ('cut', 'build', 'shell', 'blink', 'B')})
