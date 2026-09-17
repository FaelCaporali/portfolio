"""blender -b --python tools/r_assemble.py -- <cabeca.blend> <cabelo.blend> <out.blend> [folga_mm=1.5]
Junta a casca de cabelo à cabeça: a borda da casca é encostada na pele (com folga), e qualquer parte da casca que
esteja dentro da cabeça é empurrada para fora. O deslocamento é alisado nos primeiros anéis."""
import bpy, bmesh, sys, os, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index("--")+1:]; head_b, hair_b, out = a[:3]; gap = (float(a[3]) if len(a) > 3 else 1.5)/1000
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(head_b)); hd = bpy.data.objects['Busto']
with bpy.data.libraries.load(os.path.abspath(hair_b), link=False) as (s_, d_): d_.objects = ['Cabelo']
hr = d_.objects[0]; bpy.context.scene.collection.objects.link(hr)
bvh = BVHTree.FromObject(hd, bpy.context.evaluated_depsgraph_get())
me = hr.data; V = np.array([v.co[:] for v in me.vertices]); n = len(V)
nb = [[] for _ in range(n)]
for e in me.edges: x, y = e.vertices; nb[x].append(y); nb[y].append(x)
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table(); border = np.array([v.is_boundary for v in bm.verts]); bm.free()
d = np.zeros_like(V); nb_cnt = 0
for i in range(n):
    q = bvh.find_nearest(Vector(V[i]), 0.06)
    if q[0] is None: continue
    dv = Vector(V[i]) - q[0]; outside = dv.dot(q[1]) > 0
    if border[i]:                                  # borda: encosta na pele com folga
        d[i] = ((q[0] + q[1]*gap) - Vector(V[i]))[:]; nb_cnt += 1
    elif not outside or dv.length < gap:           # dentro da cabeça: empurra para fora
        d[i] = ((q[0] + q[1]*gap) - Vector(V[i]))[:]; nb_cnt += 1
for _ in range(12):                                 # alisa o deslocamento (sem degrau na casca)
    dn = np.array([d[k].mean(0) if k else d[i] for i, k in enumerate(nb)])
    d = np.where(border[:, None], d, 0.5*d + 0.5*dn)
me.vertices.foreach_set('co', (V + d).astype(np.float32).ravel()); me.update()
print("R_ASSEMBLE casca ajustada: %d vertices movidos, max %.1f mm" % (nb_cnt, np.linalg.norm(d, axis=1).max()*1000))
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out)); print("R_ASSEMBLE salvo", out)
