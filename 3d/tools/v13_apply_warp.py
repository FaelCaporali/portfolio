"""blender -b --python tools/v13_apply_warp.py -- <in.blend> <disp.json> <out_prefix> <sigma_cm> <clip_cm>
Deformação Shepard-gaussiana da malha 'Busto' pelos deslocamentos-alvo dos landmarks (pele visível apenas)."""
import bpy, json, sys, numpy as np, os
a = sys.argv[sys.argv.index("--")+1:]
src, dj, out, sigma_cm, clip_cm = a[0], a[1], a[2], float(a[3]), float(a[4])
D = json.load(open(dj)); s = D['scale']
oval = {10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109}
temples = {70,63,105,66,107,336,296,334,293,300,127,356,162,389,139,368,71,301,21,251,54,284,103,332,67,297,109,338,156,383,124,353,35,265,111,340,143,372,116,345,123,352,50,280,187,411,207,427,147,376}
keep = [k for k, i in enumerate(D['ids']) if D['w'][k] > 0 and i not in oval and i not in temples]
A = np.array(D['A'])[keep]; d = np.array(D['disp'])[keep]
n = np.linalg.norm(d, axis=1); clip = clip_cm*s
d = np.where((n > clip)[:,None], d*(clip/np.maximum(n,1e-9))[:,None], d)
print("WARP pontos=%d desloc mediano=%.2f cm max=%.2f cm" % (len(keep), np.median(n)/s, min(n.max(), clip)/s))
bpy.ops.wm.open_mainfile(filepath=src)
o = bpy.data.objects['Busto']; me = o.data
V = np.array([v.co[:] for v in me.vertices]); sig = sigma_cm*s; sig2 = 2*sig*sig
# influência restrita à vizinhança da nuvem de landmarks (evita cabelo/nuca)
dist2 = ((V[:,None,:]-A[None,:,:])**2).sum(2)          # (nv, nl)
w = np.exp(-dist2/sig2); wsum = w.sum(1)
near = wsum > 1e-3
disp = (w @ d) / np.maximum(wsum, 1e-9)[:,None]
# atenuar onde a soma de pesos é fraca (borda da região), suave
fade = np.clip(wsum/ (0.5), 0, 1); fade = fade*fade*(3-2*fade)
V2 = V + disp*fade[:,None]*near[:,None]
for i, v in enumerate(me.vertices): v.co = V2[i]
print("WARP vértices movidos=%d" % int((np.linalg.norm(V2-V,axis=1) > 1e-4).sum()))
bpy.ops.object.shade_smooth()
bpy.ops.wm.obj_export(filepath=out+".obj", export_materials=True, path_mode='COPY')
bpy.ops.wm.save_as_mainfile(filepath=out+".blend")
