"""blender -b --python tools/r_classify.py -- <target.blend> <out_prefix>
Classifica cada vértice do alvo em pele (0), cabelo (1) ou barba/bigode (2) pela cor da textura (amostrada pelo UV):
escuro ou cinza sem croma = pelo; alaranjado/rosado claro = pele. Rótulos alisados no grafo (votação 6 voltas) e
cabelo x barba separados pela altura (abaixo do nariz = barba). Salva <out>_cls.npy e <out>_cls.blend (cores por vértice)."""
import bpy, sys, os, numpy as np
a = sys.argv[sys.argv.index("--")+1:]; src, out = a[:2]
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(src)); o = bpy.data.objects['Busto']; me = o.data
img = next(nd.image for nd in me.materials[0].node_tree.nodes if nd.type == 'TEX_IMAGE' and nd.image)
W, H = img.size; px = np.empty(W*H*4, np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)[..., :3]
uv = np.empty(len(me.loops)*2); me.uv_layers.active.data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
ix = np.clip((uv[:, 0]*W).astype(int), 0, W-1); iy = np.clip((uv[:, 1]*H).astype(int), 0, H-1)
n = len(me.vertices); c = np.bincount(lv, minlength=n); rgb = np.stack([np.bincount(lv, px[iy, ix, k], minlength=n) for k in range(3)], 1)/np.maximum(c, 1)[:, None]
lum = rgb @ np.array([0.299, 0.587, 0.114]); chroma = rgb[:, 0] - rgb[:, 2]
hairy = (lum < 0.20) | ((chroma < 0.06) & (lum < 0.45))
E = np.empty(len(me.edges)*2, np.int64); me.edges.foreach_get('vertices', E); E = E.reshape(-1, 2)
deg = np.bincount(E.ravel(), minlength=n)
h = hairy.astype(float)
for _ in range(6):
    s = np.bincount(E[:, 0], h[E[:, 1]], minlength=n) + np.bincount(E[:, 1], h[E[:, 0]], minlength=n)
    h = (0.5*h + 0.5*s/np.maximum(deg, 1)); h = (h > 0.5).astype(float)
V = np.empty(n*3); me.vertices.foreach_get('co', V); V = V.reshape(-1, 3)
hm = h > 0.5; ee = E[hm[E[:, 0]] & hm[E[:, 1]]]
par = np.arange(n)                                   # union-find (Blender não tem scipy)
def find(x):
    while par[x] != x: par[x] = par[par[x]]; x = par[x]
    return x
for x, y in ee:
    rx, ry = find(x), find(y)
    if rx != ry: par[rx] = ry
lab = np.array([find(i) for i in range(n)]); nc = n
size = np.bincount(lab, minlength=nc); big = hm & (size[lab] > 2000)      # ilhas pequenas (sobrancelha, cílios, narina) = pele
print("R_CLASS ilhas de pelo pequenas viraram pele:", int((hm & ~big).sum()))
cls = np.where(big, np.where((V[:, 2] < 0.125) & (V[:, 1] < 0.055), 2, 1), 0)
np.save(out + "_cls.npy", cls.astype(np.int8)); print("R_CLASS pele %d cabelo %d barba %d" % tuple((cls == k).sum() for k in range(3)))
col = np.array([[0.9, 0.7, 0.55, 1], [0.15, 0.3, 0.9, 1], [0.9, 0.2, 0.2, 1]], np.float32)[cls]
at = me.color_attributes.new('cls', 'FLOAT_COLOR', 'POINT'); at.data.foreach_set('color', col.ravel()); me.color_attributes.active_color = at
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out + "_cls.blend"))
