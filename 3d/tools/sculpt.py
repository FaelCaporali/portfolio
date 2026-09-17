"""blender -b --python tools/sculpt.py -- <in.blend> <lm3d_aligned.json> <ops.json> <out.blend> [cm_por_m=0.0124]
Esculpe por regiões de landmarks: cada op = {"ids":[...], "d":[dx,dy,dz] em cm, "sigma_cm":1.5, "inward_cm":0}
inward_cm move em x na direção do plano médio (sinal por lado). Rosto para −Y, Z cima."""
import bpy, json, sys, numpy as np
a = sys.argv[sys.argv.index("--")+1:]; src, lmf, opsf, out = a[:4]; S = float(a[4]) if len(a) > 4 else 0.0124
lm = json.load(open(lmf)); ops = json.load(open(opsf))
bpy.ops.wm.open_mainfile(filepath=src); o = bpy.data.objects['Busto']; me = o.data
V = np.array([v.co[:] for v in me.vertices]); V0 = V.copy()
for op in ops:
    P = np.array([lm[str(i)] for i in op['ids'] if str(i) in lm])
    if len(P) == 0: continue
    sig = op.get('sigma_cm', 1.5)*S
    w = np.exp(-((V[:,None,:]-P[None,:,:])**2).sum(2)/(2*sig*sig)).max(1)   # (nv,)
    d = np.array(op.get('d', [0,0,0]))*S
    disp = np.tile(d, (len(V),1))
    inw = op.get('inward_cm', 0)*S
    if inw: disp[:,0] += -np.sign(V[:,0])*inw
    V = V + disp*w[:,None]
    print("OP %-14s pontos=%d vert>0.1=%d" % (op.get('name','?'), len(P), int((w>0.1).sum())))
for i, v in enumerate(me.vertices): v.co = V[i]
print("SCULPT desloc max %.2f cm" % (np.linalg.norm(V-V0,axis=1).max()/S))
bpy.ops.wm.save_as_mainfile(filepath=out)
