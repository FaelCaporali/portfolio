"""blender -b --python tools/r_transfer.py -- <scan.blend> <cage.blend> <out.blend> [chaves|all] [suav=2]
Transfere as expressões da malha limpa (gaiola) para o SCAN sem depender de modificador: cada vértice do scan é
amarrado ao triângulo mais próximo da gaiola neutra (coordenadas baricêntricas + deslocamento no referencial local
do triângulo) e reconstruído quando a gaiola assume cada expressão. O resultado vira shape key do scan."""
import bpy, sys, os, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index("--")+1:]; scan_b, cage_b, out = a[:3]; which = a[3] if len(a) > 3 else 'all'; sm_it = int(a[4]) if len(a) > 4 else 2
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(scan_b)); sc = bpy.data.objects['Busto']
with bpy.data.libraries.load(os.path.abspath(cage_b), link=False) as (s_, d_): d_.objects = ['Busto']
cage = d_.objects[0]; cage.name = 'Gaiola'; bpy.context.scene.collection.objects.link(cage)
if cage.data.shape_keys and cage.data.shape_keys.animation_data:
    cage.data.shape_keys.animation_data_clear()          # a animação sobrepõe os valores das chaves
kb = cage.data.shape_keys.key_blocks
for k in kb: k.value = 0.0
CV = np.array([v.co[:] for v in kb['Basis'].data])
F = np.array([p.vertices[:] for p in cage.data.polygons if len(p.vertices) == 3] +
             [t for p in cage.data.polygons if len(p.vertices) == 4 for t in ((p.vertices[0], p.vertices[1], p.vertices[2]), (p.vertices[0], p.vertices[2], p.vertices[3]))])
bvh = BVHTree.FromPolygons([Vector(v) for v in CV], [tuple(f) for f in F], all_triangles=True)
SV = np.array([v.co[:] for v in sc.data.vertices]); n = len(SV)
tri = np.zeros(n, np.int32); bary = np.zeros((n, 3)); off = np.zeros((n, 3)); ok = np.zeros(n, bool)
for i, p in enumerate(SV):
    loc, nrm, idx, dist = bvh.find_nearest(Vector(p), 0.25)
    if idx is None: continue
    A, B, C = CV[F[idx]]
    n_ = np.cross(B-A, C-A); ln = np.linalg.norm(n_)
    if ln < 1e-12: continue
    n_ = n_/ln; t1 = (B-A)/max(np.linalg.norm(B-A), 1e-12); t2 = np.cross(n_, t1)
    q = np.array(loc[:]); v0, v1, v2 = B-A, C-A, q-A
    d00, d01, d11, d20, d21 = v0@v0, v0@v1, v1@v1, v2@v0, v2@v1
    den = d00*d11 - d01*d01
    if abs(den) < 1e-16: continue
    v = (d11*d20 - d01*d21)/den; w = (d00*d21 - d01*d20)/den
    bary[i] = (1-v-w, v, w); tri[i] = idx
    r = p - q; off[i] = (r@t1, r@t2, r@n_); ok[i] = True
print("R_TRANSFER amarrados %d de %d vertices do scan" % (ok.sum(), n))
def rebuild(CVd):
    A, B, C = CVd[F[tri, 0]], CVd[F[tri, 1]], CVd[F[tri, 2]]
    q = bary[:, 0:1]*A + bary[:, 1:2]*B + bary[:, 2:3]*C
    n_ = np.cross(B-A, C-A); n_ /= np.maximum(np.linalg.norm(n_, axis=1, keepdims=True), 1e-12)
    t1 = B-A; t1 /= np.maximum(np.linalg.norm(t1, axis=1, keepdims=True), 1e-12); t2 = np.cross(n_, t1)
    return q + off[:, 0:1]*t1 + off[:, 1:2]*t2 + off[:, 2:3]*n_
E = np.array([e.vertices[:] for e in sc.data.edges]); deg = np.bincount(E.ravel(), minlength=n)
def smooth_delta(D, it):
    for _ in range(it):
        S = np.zeros_like(D)
        np.add.at(S, E[:, 0], D[E[:, 1]]); np.add.at(S, E[:, 1], D[E[:, 0]])
        D = 0.5*D + 0.5*S/np.maximum(deg, 1)[:, None]
    return D
base = rebuild(CV); D0 = SV - base            # erro de reconstrução (fica fixo, some no delta)
names = [k.name for k in kb if k.name != 'Basis'] if which == 'all' else which.split(',')
if not sc.data.shape_keys: sc.shape_key_add(name='Basis', from_mix=False)
for nm in names:
    if nm not in kb: print("R_TRANSFER sem a chave", nm); continue
    CVd = np.array([v.co[:] for v in kb[nm].data])
    d = rebuild(CVd) - base
    d[~ok] = 0; d = smooth_delta(d, sm_it)
    key = sc.shape_key_add(name=nm, from_mix=False); key.data.foreach_set('co', (SV + d).ravel())
    print("R_TRANSFER %-24s desloc max %5.1f mm, %6d vertices" % (nm, np.linalg.norm(d, axis=1).max()*1000, int((np.linalg.norm(d, axis=1) > 0.0005).sum())))
bpy.data.objects.remove(cage)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out)); print("R_TRANSFER salvo", out)
