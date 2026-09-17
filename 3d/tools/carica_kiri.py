"""Cartoon sobre o KIRI-05 (busto-base): roda no Blender interativo ou em batch.
  CFG = {'tex': 'export/toon06/base_paint.jpg', 'out': 'export/toon06/k01', 'it_dark': 6, 'it_skin': 2, 'dark': 0.35}
  exec(open('tools/carica_kiri.py').read())
Geometria: KIRI-05 alinhado e cortado, suavização por região (vértices escuros na textura crua = cabelo/barba recebem
mais iterações; pele menos; base plana intocada). Textura: a pintada por regiões (carica_paint). Sem sculpt global."""
import bpy, bmesh, os, numpy as np
R = '/home/fael/projects/portfolio/3d'; C = globals().get('CFG', {}); OUT = os.path.join(R, C.get('out', 'export/toon06/k01'))
bpy.ops.wm.open_mainfile(filepath=R + '/blend/busto-base.blend'); o = bpy.data.objects['Busto']; me = o.data; n = len(me.vertices)
img0 = bpy.data.images['3DModel.jpg']; W_, H_ = img0.size; px = np.zeros(W_ * H_ * 4, np.float32); img0.pixels.foreach_get(px); px = px.reshape(H_, W_, 4)
uvl = me.uv_layers.active.data; lum = np.zeros(n); cnt = np.zeros(n)
for p_ in me.polygons:
    for li in p_.loop_indices:
        u, v = uvl[li].uv; c = px[int(v * H_) % H_, int(u * W_) % W_]; vi = me.loops[li].vertex_index
        lum[vi] += 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; cnt[vi] += 1
lum = np.where(cnt > 0, lum / np.maximum(cnt, 1), 0.5)
V = np.array([v.co[:] for v in me.vertices]); base = V[:, 2] < 0.001
nb = [[] for _ in range(n)]
for e in me.edges: x, y = e.vertices; nb[x].append(y); nb[y].append(x)
dark = (lum < C.get('dark', 0.35)) & ~base
it_dark, it_skin = C.get('it_dark', 6), C.get('it_skin', 2)
for it in range(max(it_dark, it_skin)):
    Vn = np.array([V[k].mean(0) if k else V[i] for i, k in enumerate(nb)])
    w = np.where(base, 0.0, np.where(dark, 0.5 if it < it_dark else 0.0, 0.4 if it < it_skin else 0.0))
    V = V + w[:, None] * (Vn - V)
me.vertices.foreach_set('co', V.ravel()); me.update()
print("KIRI cartoon: %d v, escuros %d, suavizado %d/%d" % (n, int(dark.sum()), it_dark, it_skin))
tex = bpy.data.images.load(os.path.join(R, C['tex'])); tex.pack()
mat = me.materials[0]; nt = mat.node_tree; tn = next(nd for nd in nt.nodes if nd.type == 'TEX_IMAGE'); tn.image = tex
bsdf = next(nd for nd in nt.nodes if nd.type == 'BSDF_PRINCIPLED'); bsdf.inputs['Roughness'].default_value = 0.9
bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o; bpy.ops.object.shade_smooth()
bpy.ops.wm.save_as_mainfile(filepath=OUT + "_geo.blend"); print("KIRI salvo", OUT + "_geo.blend")
