"""blender -b --python tools/r_uvdrift.py -- <base.blend> <esculpida.blend> <out_prefix>
Deslizamento de textura: para cada vértice da malha esculpida, acha pelo UV o ponto do scan cru onde aquele texel estava
(P_base(uv)) e mede a diferença. Componente frontal (x, z) = textura arrastada de frente; componente y = profundidade esculpida.
Grava <out>.npz (V, T, ok) e imprime estatística por região."""
import bpy, sys, os, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index("--")+1:]; basef, scf, out = a[:3]
def load(f):
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(f)); me = bpy.data.objects['Busto'].data; me.calc_loop_triangles()
    V = np.array([v.co[:] for v in me.vertices]); uv = np.array([d.uv[:] for d in me.uv_layers[0].data])
    tl = np.array([t.loops[:] for t in me.loop_triangles]); tv = np.array([t.vertices[:] for t in me.loop_triangles]); lv = np.array([l.vertex_index for l in me.loops])
    return V, uv, tl, tv, lv
Vb, uvb, tlb, tvb, _ = load(basef)
keep = Vb[tvb].max(1)[:, 2] > 0.004; tlb, tvb = tlb[keep], tvb[keep]                     # fora a tampa plana da base (UV sobreposto ao atlas)
UV3 = [Vector((u, v, 0.0)) for u, v in uvb]; bvh = BVHTree.FromPolygons(UV3, [tuple(t) for t in tlb], all_triangles=True)
Vs, uvs, _, _, lvs = load(scf); first = np.full(len(Vs), -1); first[lvs[::-1]] = np.arange(len(lvs))[::-1]
T = np.zeros_like(Vs); ok = np.zeros(len(Vs), bool)
for i in range(len(Vs)):
    u, v = uvs[first[i]]; loc, nrm, idx, dist = bvh.find_nearest(Vector((u, v, 0.0)))
    if loc is None or dist > 2e-3: continue
    a_, b_, c_ = [np.array(uvb[k]) for k in tlb[idx]]; p = np.array([loc.x, loc.y]); m = np.array([b_-a_, c_-a_]).T
    try: s, t = np.linalg.solve(m, p - a_)
    except np.linalg.LinAlgError: continue
    A, B, C = Vb[tvb[idx]]; T[i] = A + s*(B-A) + t*(C-A); ok[i] = True
np.savez(out + '.npz', V=Vs, T=T, ok=ok)
d = (Vs - T)*1000; fr = np.hypot(d[:, 0], d[:, 2]); front = ok & (Vs[:, 1] < 0.05)
print("UVDRIFT vertices %d, resolvidos %d" % (len(Vs), ok.sum()))
for nm, c, r in (('boca', (0, -0.015, 0.105), 0.03), ('olho D', (-0.0385, 0.01, 0.1785), 0.025), ('olho E', (0.038, 0.01, 0.18), 0.025), ('nariz', (0, -0.025, 0.14), 0.025), ('testa', (0, 0, 0.225), 0.035), ('bochecha D', (-0.05, 0.0, 0.13), 0.03), ('bochecha E', (0.05, 0.0, 0.13), 0.03)):
    m = front & (np.linalg.norm(Vs - np.array(c), axis=1) < r)
    if m.sum(): print("  %-11s n=%6d | frontal (x,z): media %.2f p95 %.2f max %.2f mm | profundidade y: media %+.2f, p5 %+.2f, p95 %+.2f mm" % (nm, m.sum(), fr[m].mean(), np.percentile(fr[m], 95), fr[m].max(), d[m, 1].mean(), np.percentile(d[m, 1], 5), np.percentile(d[m, 1], 95)))
