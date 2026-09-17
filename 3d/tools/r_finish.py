"""blender -b --python tools/r_finish.py -- <prefix> <in.blend> <target.blend> <out.blend> [subdiv=1]
Acabamento do wrap (método do dd_finish/DD07, sem apagar a topologia da cabeça):
  1. separa os globos oculares (helpers do MPFB) no objeto 'Olhos' e remove os outros helpers do 'Busto';
  2. subdivide (Catmull-Clark) e projeta no alvo: grossa pela normal (4 cm) e fina (6 mm, normal compatível), com
     espinhos relaxados; só as pálpebras (região macia) recebem deslocamento interpolado; nuca/coque e corpo de fora;
  3. repara dobras (alisa +1 anel e reprojeta);
  4. corta a base no plano do alvo e fecha a tampa.
Salva <out.blend> e <out>_map.npz (índices: vértices originais do corpo -> vértices do resultado)."""
import bpy, bmesh, sys, os, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index("--")+1:]; pre, src, tgt_b, out = a[:4]; lv = int(a[4]) if len(a) > 4 else 1
S = np.load(pre + "_src.npz", allow_pickle=True)   # gerado por r_prep.py deste repo
NB = int(S['NB']); gn = list(S['g_names']); gi = S['g_idx']
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(tgt_b)); T = bpy.data.objects['Busto']; T.name = 'Alvo'
zcut = min(v.co.z for v in T.data.vertices) + 0.0015
with bpy.data.libraries.load(os.path.abspath(src), link=False) as (s_, d_): d_.objects = ['Busto']
o = d_.objects[0]; bpy.context.scene.collection.objects.link(o)
for m in list(o.modifiers): o.modifiers.remove(m)
me = o.data; n0 = len(me.vertices)
# 1. olhos
eyes = np.unique(np.concatenate([gi[gn.index(g)] for g in ('helper-l-eye', 'helper-r-eye')]))
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
eo = bpy.data.objects.new('Olhos', bpy.data.meshes.new('Olhos')); bpy.context.scene.collection.objects.link(eo)
be = bmesh.new(); vm = {}
for i in eyes: vm[i] = be.verts.new(bm.verts[i].co)
for f in bm.faces:
    if all(v.index in vm for v in f.verts): be.faces.new([vm[v.index] for v in f.verts])
be.to_mesh(eo.data); be.free()
# remove helpers e juntas do Busto (ficam só os vértices do corpo, na mesma ordem)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index >= NB], context='VERTS')
bm.to_mesh(me); bm.free(); me.update()
bpy.context.view_layer.objects.active = o; o.select_set(True)
me_base = me.copy()                                   # malha base (sem subdivisão) para subdividir os deltas das expressões
if lv > 0:
    m = o.modifiers.new('Sub', 'SUBSURF'); m.levels = lv; bpy.ops.object.modifier_apply(modifier='Sub')
n = len(me.vertices); print("R_FINISH vertices apos subdivisao: %d (originais %d)" % (n, NB))
V = np.array([v.co[:] for v in me.vertices])
# máscaras dos originais propagadas aos novos vértices (vizinhos)
nb = [[] for _ in range(n)]
for e in me.edges: x, y = e.vertices; nb[x].append(y); nb[y].append(x)
def spread(mask0):
    mk = np.zeros(n, bool); mk[:NB] = mask0[:NB]
    for _ in range(lv*2):
        new = mk.copy()
        for i in range(NB, n):
            if not mk[i] and any(mk[k] for k in nb[i] if k < NB or mk[k]): new[i] = True
        mk = new
    return mk
excl = spread(S['back']) | (V[:, 2] < zcut - 0.01)
soft = spread(S['soft_eye'] | S['interior'] | S['ear']) & ~excl     # seguem os vizinhos (sem furos nem orelha solta)
act = ~excl
bvh = BVHTree.FromObject(T, bpy.context.evaluated_depsgraph_get())
def folds():
    b = bmesh.new(); b.from_mesh(me); b.normal_update(); bad = []
    for f in b.faces:
        nv = sum((v.normal for v in f.verts), start=Vector())
        if nv.length > 0 and f.normal.dot(nv.normalized()) < 0.3 and any(act[v.index] for v in f.verts): bad.append([v.index for v in f.verts])
    b.free(); return bad
def nmean(d, i): return d[nb[i]].mean(0) if nb[i] else d[i]
def stage(lim, ray, ndot, sm):
    me.update(); P = np.array([v.co[:] for v in me.vertices]); N = np.array([v.normal[:] for v in me.vertices]); d = np.zeros_like(P); cnt = 0
    for i in np.nonzero(act & ~soft)[0]:
        co, nn = Vector(P[i]), Vector(N[i]); best = None
        if ray:
            for sg in (1, -1):
                h = bvh.ray_cast(co, sg*nn, lim)
                if h[0] is not None and (h[1].dot(nn) > 0.0) and (best is None or (h[0]-co).length < (best-co).length): best = h[0]
        if best is None:
            q = bvh.find_nearest(co, lim)
            if q[0] is not None and q[1].dot(nn) > ndot: best = q[0]
        if best is not None: d[i] = (best - co)[:]; cnt += 1
    for _ in range(4):
        dn = np.array([nmean(d, i) for i in range(n)]); bad = act & (np.linalg.norm(d - dn, axis=1) > 0.003); d[bad] = dn[bad]
    for _ in range(sm):
        dn = np.array([nmean(d, i) for i in range(n)]); d = np.where(act[:, None], 0.5*d + 0.5*dn, d)
    idx = np.nonzero(soft)[0]
    for _ in range(30):
        for i in idx: d[i] = nmean(d, i)
    ring = excl                                  # fora da região: esfuma o deslocamento (sem degrau)
    for _ in range(10):
        dn = np.array([nmean(d, i) for i in range(n)]); d = np.where(ring[:, None], 0.85*dn, d)
    P = P + d; me.vertices.foreach_set('co', P.astype(np.float32).ravel()); me.update()
    print("R_FINISH projecao lim=%.3f raio=%s: %d vertices, desloc mediano %.2f mm, max %.1f mm, dobras %d" % (lim, ray, cnt, np.median(np.linalg.norm(d[act], axis=1))*1000, np.linalg.norm(d, axis=1).max()*1000, len(folds())), flush=True)
stage(float(os.environ.get('R_COARSE', '0.04')), True, 0.0, 3)
stage(0.006, False, 0.5, 1)
for rep in range(5):
    bad = folds()
    if not bad: break
    ring = set(i for f in bad for i in f)
    for i in list(ring): ring.update(nb[i])
    idx = np.array(sorted(ring)); P = np.array([v.co[:] for v in me.vertices])
    for _ in range(6):
        Pn = P.copy()
        for i in idx: Pn[i] = 0.3*P[i] + 0.7*P[nb[i]].mean(0)
        P = Pn
    me.vertices.foreach_set('co', P.astype(np.float32).ravel()); me.update()
    for i in idx:
        if soft[i] or excl[i]: continue
        q = bvh.find_nearest(Vector(P[i]), 0.004)
        if q[0] is not None and q[1].dot(me.vertices[i].normal) > 0.5: me.vertices[i].co = q[0]
    me.update(); print("R_FINISH reparo de dobras %d: %d vertices, restam %d" % (rep+1, len(idx), len(folds())))
# vértices internos (boca, narinas) que ficaram do lado de fora do alvo: empurra 1,5 mm para dentro
inner = spread(S['interior']) & ~excl; P = np.array([v.co[:] for v in me.vertices]); npush = 0
for i in np.nonzero(inner)[0]:
    q = bvh.find_nearest(Vector(P[i]), 0.03)
    if q[0] is not None and (Vector(P[i]) - q[0]).dot(q[1]) > -0.001: P[i] = (q[0] - q[1]*0.0015)[:]; npush += 1
me.vertices.foreach_set('co', P.astype(np.float32).ravel()); me.update(); print("R_FINISH internos empurrados para dentro:", npush)
# globos oculares: esfera ajustada aos vértices do helper de cada olho
Ve = np.array([v.co[:] for v in eo.data.vertices]); cen = Ve[:, 0] > 0
bpy.data.objects.remove(eo); eyes_objs = []
for side, sel in (('E', cen), ('D', ~cen)):
    X_ = Ve[sel]; A_ = np.c_[2*X_, np.ones(len(X_))]; sol = np.linalg.lstsq(A_, (X_**2).sum(1), rcond=None)[0]
    c = sol[:3]; r = np.sqrt(sol[3] + (c**2).sum())
    bm2 = bmesh.new(); bm2.loops.layers.uv.new("UVMap"); bmesh.ops.create_uvsphere(bm2, u_segments=32, v_segments=16, radius=r, calc_uvs=True)
    em = bpy.data.meshes.new('Olho' + side); bm2.to_mesh(em); bm2.free()
    ob = bpy.data.objects.new('Olho' + side, em); ob.location = c; ob.rotation_euler = (1.5708, 0, 0); bpy.context.scene.collection.objects.link(ob)
    for p in em.polygons: p.use_smooth = True
    print("R_FINISH olho %s centro %s raio %.1f mm" % (side, np.round(c*1000, 1), r*1000))
# shape keys de expressão: delta da base (transformado pela afim do NICP) subdividido e somado à forma final
if os.environ.get('R_KEYS'):
    Hb = np.load(pre.rsplit('/', 1)[0] + '/human_base.npz', allow_pickle=True)   # gerado por r_human.py
    Rn = np.load(pre + "_nicp.npz"); Lin = np.tile(np.eye(3), (NB, 1, 1)); Lin[Rn['solve']] = Rn['X'][:, :3, :3]
    en = list(Hb['e_names']); ED = Hb['e_d'][:, :NB]
    tmp = bpy.data.objects.new('TmpKey', me_base); bpy.context.scene.collection.objects.link(tmp)
    sm = tmp.modifiers.new('S', 'SUBSURF'); sm.levels = lv
    B0 = np.array([v.co[:] for v in me_base.vertices])
    def subd(P):
        me_base.vertices.foreach_set('co', P.astype(np.float32).ravel()); me_base.update()
        ev = tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()); return np.array([v.co[:] for v in ev.data.vertices])
    S0 = subd(B0); assert len(S0) == n, (len(S0), n)
    if not me.shape_keys: o.shape_key_add(name='Basis', from_mix=False)
    spec = os.environ['R_KEYS']; names = en if spec == 'all' else spec.split(',')
    scale = {'eye-left-closure': 0.5, 'eye-right-closure': 0.5}        # a forma neutra já tem 0,5 de fechamento
    basis = np.array([v.co[:] for v in me.vertices])
    for k in names:
        dl = np.einsum('ni,nij->nj', ED[en.index(k)]*scale.get(k, 1.0), Lin)
        kb = o.shape_key_add(name=k, from_mix=False); kb.data.foreach_set('co', (basis + subd(B0 + dl) - S0).astype(np.float32).ravel())
    bpy.data.objects.remove(tmp); print("R_FINISH shape keys:", len(names))
# máscara das pálpebras (textura de pele, não do olho pintado do scan)
lid = spread(S['soft_eye']).astype(np.float32)
at = me.color_attributes.new('lid', 'FLOAT_COLOR', 'POINT'); at.data.foreach_set('color', np.repeat(lid, 4).reshape(-1, 4).ravel())
# 4. corte da base
bm = bmesh.new(); bm.from_mesh(me)
r_ = bmesh.ops.bisect_plane(bm, geom=bm.verts[:]+bm.edges[:]+bm.faces[:], plane_co=(0, 0, zcut), plane_no=(0, 0, -1), clear_outer=True)
ce = [e for e in r_['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
if ce: bmesh.ops.holes_fill(bm, edges=ce, sides=0)
bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True
T.hide_render = True; T.hide_viewport = True
np.savez(os.path.splitext(out)[0] + "_map.npz", n_sub=n)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out)); print("R_FINISH salvo", out, len(me.vertices))
