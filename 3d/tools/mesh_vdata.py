"""blender -b --python tools/mesh_vdata.py -- <in.blend> <out.npz>
Exporta vértices, arestas e luminância por vértice (média dos texels dos loops) da malha 'Busto' para classificação 3D."""
import bpy, sys, numpy as np
a = sys.argv[sys.argv.index("--")+1:]; src, out = a[:2]
bpy.ops.wm.open_mainfile(filepath=src); o = bpy.data.objects['Busto']; me = o.data; n = len(me.vertices)
img = next(nd.image for nd in me.materials[0].node_tree.nodes if nd.type == 'TEX_IMAGE' and nd.image); W, H = img.size
px = np.zeros(W * H * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)
uvl = me.uv_layers.active.data; lum = np.zeros(n); cnt = np.zeros(n)
for p_ in me.polygons:
    for li in p_.loop_indices:
        u, v = uvl[li].uv; c = px[int(v * H) % H, int(u * W) % W]; vi = me.loops[li].vertex_index
        lum[vi] += 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; cnt[vi] += 1
lum = np.where(cnt > 0, lum / np.maximum(cnt, 1), 0.5)
V = np.array([(o.matrix_world @ v.co)[:] for v in me.vertices]); E = np.array([e.vertices[:] for e in me.edges])
np.savez(out, V=V, E=E, lum=lum); print("VDATA", n, "v", len(E), "e")
