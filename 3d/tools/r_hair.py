"""blender -b --python tools/r_hair.py -- <alvo.blend> <cls.npy> <out.blend> [suav=25] [espessura_mm=4] [decimate=0.35]
Casca de cabelo como peça própria: faces do alvo cuja classe é cabelo, ilhas pequenas removidas, borda fixada,
suavização laplaciana (uniformidade, 'bem preso'), decimate, espessura para dentro e material de cabelo chapado.
Salva o objeto 'Cabelo' no blend."""
import bpy, bmesh, sys, os, numpy as np
a = sys.argv[sys.argv.index("--")+1:]; src, clsf, out = a[:3]
it = int(a[3]) if len(a) > 3 else 25; th = (float(a[4]) if len(a) > 4 else 4.0)/1000; dec = float(a[5]) if len(a) > 5 else 0.35
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(src)); o = bpy.data.objects['Busto']; me = o.data
cls = np.load(clsf); assert len(cls) == len(me.vertices), (len(cls), len(me.vertices))
V0 = np.empty(len(me.vertices)*3); me.vertices.foreach_get('co', V0); V0 = V0.reshape(-1, 3)
E0 = np.empty(len(me.edges)*2, np.int64); me.edges.foreach_get('vertices', E0); E0 = E0.reshape(-1, 2)
hair = cls == 1
def grow(m, k):                      # dilata k anéis no grafo
    for _ in range(k):
        n_ = m.copy(); n_[E0[m[E0[:, 0]], 1]] = True; n_[E0[m[E0[:, 1]], 0]] = True; m = n_
    return m
hair = ~grow(~grow(hair, 6), 6)      # fechamento: tapa falhas (calva do topo, costeleta)
# ilhas de não-cabelo cercadas por cabelo viram cabelo
par = np.arange(len(V0))
def find(x):
    while par[x] != x: par[x] = par[par[x]]; x = par[x]
    return x
for x, y in E0[(~hair[E0[:, 0]]) & (~hair[E0[:, 1]])]:
    a_, b_ = find(x), find(y)
    if a_ != b_: par[a_] = b_
lab0 = np.array([find(i) for i in range(len(V0))]); lab0[hair] = -1
face_seed = lab0[np.argmin(np.linalg.norm(V0 - np.array([0, -0.031, 0.138]), axis=1))]
for c in np.unique(lab0[lab0 >= 0]):
    if c != face_seed and (lab0 == c).sum() < 20000: hair[lab0 == c] = True

deg = np.bincount(E0.ravel(), minlength=len(V0))
for _ in range(6):                   # voto da maioria: contorno da máscara mais suave
    sm = np.bincount(E0[:, 0], hair[E0[:, 1]].astype(float), minlength=len(V0)) + np.bincount(E0[:, 1], hair[E0[:, 0]].astype(float), minlength=len(V0))
    hair = (0.35*hair + 0.65*sm/np.maximum(deg, 1)) > 0.5
print("R_HAIR mascara de cabelo: %d vertices" % hair.sum())
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(hair[v.index] for v in f.verts)], context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
# só a maior ilha
bm.verts.index_update(); par = list(range(len(bm.verts)))
def find(x):
    while par[x] != x: par[x] = par[par[x]]; x = par[x]
    return x
for e in bm.edges:
    a_, b_ = find(e.verts[0].index), find(e.verts[1].index)
    if a_ != b_: par[a_] = b_
lab = np.array([find(i) for i in range(len(bm.verts))]); cnt = np.bincount(lab); big = cnt.argmax()
bmesh.ops.delete(bm, geom=[v for v in bm.verts if lab[v.index] != big], context='VERTS')
nm = bpy.data.meshes.new('Cabelo'); bm.to_mesh(nm); bm.free()
ob = bpy.data.objects.new('Cabelo', nm); bpy.context.scene.collection.objects.link(ob)
print("R_HAIR casca: %d vertices, %d faces" % (len(nm.vertices), len(nm.polygons)))
# suavização com borda fixa (uniformiza sem encolher a silhueta da borda)
V = np.array([v.co[:] for v in nm.vertices]); nb = [[] for _ in V]
for e in nm.edges: x, y = e.vertices; nb[x].append(y); nb[y].append(x)
bm2 = bmesh.new(); bm2.from_mesh(nm); border = np.array([v.is_boundary for v in bm2.verts]); bm2.free()
for _ in range(it):
    Vn = np.array([V[k].mean(0) if k else V[i] for i, k in enumerate(nb)])
    V = np.where(border[:, None], V, 0.5*V + 0.5*Vn)
# relaxa o contorno (curva suave) e suaviza de novo perto dele
bi = np.nonzero(border)[0]; bset = set(bi.tolist())
bnb = {i: [k for k in nb[i] if k in bset] for i in bi}
for _ in range(40):
    Vb = V.copy()
    for i in bi:
        k = bnb[i]
        if len(k) >= 2: Vb[i] = 0.35*V[i] + 0.65*V[k].mean(0)
    V = Vb
for _ in range(6):
    Vn = np.array([V[k].mean(0) if k else V[i] for i, k in enumerate(nb)]); V = 0.5*V + 0.5*Vn
nm.vertices.foreach_set('co', V.astype(np.float32).ravel()); nm.update()
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
if dec < 1:
    m = ob.modifiers.new('D', 'DECIMATE'); m.ratio = dec; bpy.ops.object.modifier_apply(modifier='D')
# espessura some na borda (sem lábio visível no encontro com a pele)
w = np.ones(len(nm.vertices)); bm3 = bmesh.new(); bm3.from_mesh(nm); bd = np.array([v.is_boundary for v in bm3.verts]); bm3.free()
nb2 = [[] for _ in nm.vertices]
for e in nm.edges: x, y = e.vertices; nb2[x].append(y); nb2[y].append(x)
w[bd] = 0.0
for _ in range(8):
    w = np.array([min(w[i], min([w[k] for k in nb2[i]] + [1.0]) + 0.14) for i in range(len(w))])
vg = ob.vertex_groups.new(name='esp')
for i, wi in enumerate(w): vg.add([i], float(np.clip(wi, 0, 1)), 'REPLACE')
m = ob.modifiers.new('S', 'SOLIDIFY'); m.thickness = -th; m.offset = 1.0; m.vertex_group = 'esp'; m.thickness_vertex_group = 0.02
bpy.ops.object.modifier_apply(modifier='S')
for p in nm.polygons: p.use_smooth = True
mat = bpy.data.materials.new('Cabelo'); mat.use_nodes = True
b = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
b.inputs['Base Color'].default_value = (0.011, 0.008, 0.007, 1); b.inputs['Roughness'].default_value = 0.42
b.inputs['Specular IOR Level'].default_value = 0.35
nm.materials.append(mat)
for x in list(bpy.data.objects):
    if x.name != 'Cabelo': bpy.data.objects.remove(x)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out)); print("R_HAIR salvo", out, len(nm.vertices))
