"""blender -b (ou interativo: CFG=[src|-, out, ...], src "-" = cena aberta)
blender -b --python tools/sil_fit.py -- <in.blend> <out.blend> <rounds> <step> <radius_it> <zmin> <pnp1.json> [...]
Escultura guiada por silhueta (shape-from-silhouette com câmeras casadas às fotos): em cada vista, os vértices do
contorno visível da malha são empurrados/puxados no plano da imagem até o contorno da foto (máscara rembg aberta
para tirar fios soltos). O campo de deslocamento é espalhado com decaimento suave (convolução normalizada no grafo
da malha, como um pincel Grab de raio grande) e limitado. Ignora z < zmin (pescoço/corte) e a borda aberta."""
import bpy, bmesh, sys, os, json, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
if 'CFG' in globals(): a = CFG                      # interativo: exec(open(...).read(), {'CFG': [...]})
else: a = sys.argv[sys.argv.index("--")+1:]
src, out = a[0], a[1]; rounds, step, rit, zmin = int(a[2]), float(a[3]), int(a[4]), float(a[5]); pnps = a[6:]
MODE = 'both'
if pnps and pnps[0] in ('shrink', 'grow', 'both'): MODE, pnps = pnps[0], pnps[1:]   # shrink: só retrai malha que sai da foto
DS = 4; CLIP = 0.02
if src != '-': bpy.ops.wm.open_mainfile(filepath=src)
ob = bpy.data.objects['Busto']; me = ob.data
assert np.allclose(np.array(ob.matrix_world), np.eye(4), atol=1e-6), "transformação não aplicada"
n = len(me.vertices); E = np.array([e.vertices[:] for e in me.edges])
deg = np.bincount(E.ravel(), minlength=n).astype(float)
bm = bmesh.new(); bm.from_mesh(me); border = np.array([v.is_boundary for v in bm.verts]); bm.free()
def lap(x):
    s = np.zeros_like(x); np.add.at(s, E[:, 0], x[E[:, 1]]); np.add.at(s, E[:, 1], x[E[:, 0]])
    d = deg.reshape((-1,) + (1,)*(x.ndim-1)); return 0.5*x + 0.5*s/np.maximum(d, 1)
views = []
for pf in pnps:
    p = json.load(open(pf)); name = os.path.basename(pf)[:-5]
    sd = np.load(f'analise/photo_masks/{name}_sd.npy')   # tools/sil_maps.py
    rv = np.array(p['rvec']); th = np.linalg.norm(rv); k = rv/th; Kx = np.array([[0,-k[2],k[1]],[k[2],0,-k[0]],[-k[1],k[0],0]])
    R = np.eye(3) + np.sin(th)*Kx + (1-np.cos(th))*(Kx@Kx); t = np.array(p['tvec'])
    views.append((name, R, t, p['f']/DS, p['w']/2/DS, p['h']/2/DS, sd))
for r in range(rounds):
    V = np.empty(n*3); me.vertices.foreach_get('co', V); V = V.reshape(n, 3); me.update()
    N = np.empty(n*3); me.vertices.foreach_get('normal', N); N = N.reshape(n, 3)
    bvh = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())
    acc = np.zeros((n, 3)); w = np.zeros(n); rep = []
    for name, R, t, f, cx, cy, sd in views:
        Pc = V @ R.T + t; C = -R.T @ t
        u = f*Pc[:, 0]/Pc[:, 2] + cx; v = f*Pc[:, 1]/Pc[:, 2] + cy
        vd = V - C; vd /= np.linalg.norm(vd, axis=1, keepdims=True)
        cand = np.nonzero((np.abs((N*vd).sum(1)) < 0.2) & (V[:, 2] > zmin) & ~border)[0]
        Nc = N @ R.T; es = []
        for i in cand:
            ui, vi = int(round(u[i])), int(round(v[i]))
            if not (0 <= vi < sd.shape[0] and 0 <= ui < sd.shape[1]): continue
            hit = bvh.ray_cast(Vector(C), Vector(vd[i]))
            if hit[0] is None or (hit[0] - Vector(V[i])).length > 0.002: continue
            d2 = Nc[i, :2]; ln = np.linalg.norm(d2)
            if ln < 1e-6: continue
            d2 /= ln; s = sd[vi, ui]
            if abs(s) < 3 or (MODE == 'shrink' and s < 0) or (MODE == 'grow' and s > 0): es.append(s); continue
            s = np.clip(s, -30, 30); dirw = R.T @ np.array([d2[0], d2[1], 0.0])
            acc[i] += -s * Pc[i, 2] / f * dirw; w[i] += 1; es.append(s)
        es = np.abs(es); rep.append(f"{name}: {len(es)} v, |sd| med {np.median(es)*DS:.0f}px p90 {np.percentile(es,90)*DS:.0f}px")
    num = acc; den = w.astype(float)
    for _ in range(rit): num = lap(num); den = lap(den)
    disp = num / np.maximum(den, 1e-9)[:, None] * np.clip(den / max(np.percentile(den[den > 0], 50), 1e-9), 0, 1)[:, None]
    ln = np.linalg.norm(disp, axis=1); disp *= (np.minimum(ln, CLIP) / np.maximum(ln, 1e-9))[:, None]
    disp[V[:, 2] < zmin - 0.01] = 0
    V = V + step*disp; me.vertices.foreach_set('co', V.ravel()); me.update()
    print(f"SIL r{r}: desloc med {np.median(ln[ln>0])*1000:.1f}mm max {ln.max()*1000:.1f}mm |", " ; ".join(rep), flush=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out)); print("SIL salvo", out)
