"""blender -b --python tools/mpfb_fit.py -- <in.blend> <lm3d_ids.json> <fused.json> <out.blend> [passes=3]
Ajuste paramétrico: escolhe valores dos targets MPFB (pares incr/decr = 1 parâmetro em [-1,1]) que minimizam
a distância entre os landmarks da malha (por id de vértice, malha avaliada com shape keys) e a medida fundida
(Procrustes com escala). Descida por coordenadas, sem tocar em vértices à mão."""
import bpy, json, sys, numpy as np
a = sys.argv[sys.argv.index("--")+1:]; src, lmf, fuf, out = a[:4]; passes = int(a[4]) if len(a) > 4 else 3
bpy.ops.wm.open_mainfile(filepath=src); o = bpy.data.objects['Busto']; kb = o.data.shape_keys.key_blocks
L = json.load(open(lmf)); F = np.array(json.load(open(fuf))['pts_cm'])
eye = {33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398}
oval = {10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109}
ids = [int(i) for i in L['vid'] if int(i) < 468 and int(i) not in eye]
vid = np.array([L['vid'][str(i)] for i in ids]); B = F[ids]
Bm = np.stack([B[:,0], -B[:,2], B[:,1]], 1)   # canônico -> malha (rosto -Y, Z cima)
w = np.array([0.5 if i in oval else 1.0 for i in ids])
dg = bpy.context.evaluated_depsgraph_get()
def landmarks():
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get(); ev = o.evaluated_get(dg); V = np.array([ev.data.vertices[int(v)].co[:] for v in vid]); return V
def residual():
    A = landmarks(); ca, cb = (A*w[:,None]).sum(0)/w.sum(), (Bm*w[:,None]).sum(0)/w.sum(); A0, B0 = A-ca, Bm-cb
    U, S, Vt = np.linalg.svd((B0*w[:,None]).T @ A0); D = np.eye(3); D[2,2] = np.sign(np.linalg.det(U@Vt)); R = U@D@Vt
    s = (S*np.diag(D)).sum() / ((B0**2)*w[:,None]).sum(); P = s*(B0@R)
    r = np.linalg.norm(P - A0, axis=1)/s      # em cm reais
    return float(np.sqrt((w*r*r).sum()/w.sum()))
# parâmetros: pares nome-incr/decr, ou targets únicos em [0,1]
names = [k.name for k in kb if k.name != 'Basis']
pairs = {}; singles = []
for n in names:
    for a_, b_ in (('-incr','-decr'),('-in','-out'),('-up','-down'),('-forward','-backward'),('-convex','-concave'),('-compress','-uncompress'),('-out','-in')):
        if n.endswith(a_) and n[:-len(a_)]+b_ in names:
            base = n[:-len(a_)]
            if base not in pairs: pairs[base] = (n, n[:-len(a_)]+b_)
            break
    else:
        if not any(n.endswith(s) for s in ('-decr','-out','-down','-backward','-concave','-uncompress','-in')): singles.append(n)
def setp(base, val):
    if base in pairs:
        p, q = pairs[base]; kb[p].value = max(val, 0.0); kb[q].value = max(-val, 0.0)
    else: kb[base].value = max(val, 0.0)
params = list(pairs.keys()) + singles
skip = ('ear', 'neck', 'expression', 'asym')
params = [p for p in params if not any(s in p for s in skip)]
cur = {p: 0.0 for p in params}; best = residual(); print("FIT inicial rms=%.3f cm  params=%d" % (best, len(params)))
grid_pair = [-1, -0.6, -0.3, 0, 0.3, 0.6, 1]; grid_single = [0, 0.3, 0.6, 1]
for it in range(passes):
    improved = 0
    for p in params:
        grid = grid_pair if p in pairs else grid_single; bv, bres = cur[p], best
        for g in grid:
            if g == cur[p]: continue
            setp(p, g); r = residual()
            if r < bres - 1e-4: bv, bres = g, r
        setp(p, bv)
        if bv != cur[p]: improved += 1; cur[p] = bv; best = bres
    print("FIT passe %d rms=%.3f cm  alterados=%d" % (it+1, best, improved))
    if improved == 0: break
used = {p: v for p, v in cur.items() if v != 0}
print("FIT usados:", json.dumps(used))
json.dump({'rms_cm': best, 'params': used}, open(out.replace('.blend', '.json'), 'w'))
bpy.ops.wm.save_as_mainfile(filepath=out)
