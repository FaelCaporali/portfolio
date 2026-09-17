"""blender -b --python tools/r_build.py -- <prefix> <human_prefix> <out.blend> [subsurf=1]
Monta o humano ajustado: vértices do corpo do NICP; helpers (olhos, dentes, língua, cílios) e cubos de junta seguem
a média das afins dos vértices do corpo mais próximos. Objeto 'Busto' (modificadores do MPFB mantidos: máscara dos
helpers) + Subdivision para ver a forma."""
import bpy, sys, os, numpy as np
from mathutils.kdtree import KDTree
a = sys.argv[sys.argv.index("--")+1:]; pre, hpre, out = a[:3]; lv = int(a[3]) if len(a) > 3 else 1; tgt_b = a[4] if len(a) > 4 else None
S = np.load(pre + "_src.npz", allow_pickle=True)   # gerados pelos scripts r_* deste repo
R = np.load(pre + "_nicp.npz"); NB = int(S['NB'])
V = R['V'].copy(); V0all = S['V']; X = R['X']; solve = R['solve']; V0 = R['V0']
kd = KDTree(len(solve))
for i, p in enumerate(V0): kd.insert(p, i)
kd.balance()
for i in range(NB, len(V)):
    nb = kd.find_n(V0all[i], 6); w = np.array([1/(d + 1e-4) for _, _, d in nb]); w /= w.sum()
    Xm = sum(wk*X[j] for wk, (_, j, _) in zip(w, nb))
    V[i] = (np.r_[V0all[i]*100, 1] @ Xm)/100
EXPR = os.environ.get('R_EXPR', '')
if EXPR:                                   # alvos de expressão do MPFB aplicados na forma base (deltas pela parte linear da afim)
    Hb = np.load(hpre + "_base.npz", allow_pickle=True); en = list(Hb['e_names']); ED = Hb['e_d']
    Lin = np.tile(np.eye(3), (len(V), 1, 1)); Lin[solve] = X[:, :3, :3]
    for kv in EXPR.split(','):
        k, w = kv.split('='); dl = ED[en.index(k)]*float(w)
        V = V + np.einsum('ni,nij->nj', dl, Lin)
        print("R_BUILD expressao", k, w)
def project(V):
    # projeção no alvo (como o dd_finish do DD07): grossa pela normal (4 cm) + fina (6 mm), deslocamento alisado;
    # lábios e pálpebras recebem o deslocamento interpolado dos vizinhos (boca e olhos não se abrem nem colam no bigode)
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(tgt_b)); sc = bpy.data.objects['Busto']
    bvh = BVHTree.FromObject(sc, bpy.context.evaluated_depsgraph_get())
    E = S['E']; nb = [[] for _ in range(NB)]
    for x, y in E: nb[x].append(y); nb[y].append(x)
    head = ~(S['back'] | S['low'] | S['interior'] | S['ear'])[:NB]
    soft = np.zeros(NB, bool); soft[S['lips']] = True; soft |= S['soft_eye'][:NB]
    Fb = S['F']
    def normals(P):
        fn = np.cross(P[Fb[:, 1]] - P[Fb[:, 0]], P[Fb[:, 2]] - P[Fb[:, 0]]); Nn = np.zeros_like(P)
        for k in range(3): np.add.at(Nn, Fb[:, k], fn)
        return Nn/np.maximum(np.linalg.norm(Nn, axis=1, keepdims=True), 1e-12)
    def smooth(d, it, mask):
        for _ in range(it):
            dn = np.array([d[k].mean(0) if k else d[i] for i, k in enumerate(nb)]); d = np.where(mask[:, None], 0.5*d + 0.5*dn, d)
        return d
    for lim, ray, ndot, sm in ((0.04, True, 0.0, 3), (0.006, False, 0.5, 1)):
        P = V[:NB]; Nn = normals(P); d = np.zeros_like(P); cnt = 0
        for i in np.nonzero(head & ~soft)[0]:
            co, nn = Vector(P[i]), Vector(Nn[i]); best = None
            if ray:
                for sg in (1, -1):
                    hit = bvh.ray_cast(co, sg*nn, lim)
                    if hit[0] is not None and (best is None or (hit[0]-co).length < (best-co).length): best = hit[0]
            if best is None:
                q = bvh.find_nearest(co, lim)
                if q[0] is not None and q[1].dot(nn) > ndot: best = q[0]
            if best is not None: d[i] = (best - co)[:]; cnt += 1
        for _ in range(4):
            dn = np.array([d[k].mean(0) if k else d[i] for i, k in enumerate(nb)]); bad = np.linalg.norm(d - dn, axis=1) > 0.003; d[bad] = dn[bad]
        d = smooth(d, sm, head)
        idx = np.nonzero(soft)[0]
        for _ in range(40):
            for i in idx: d[i] = d[nb[i]].mean(0)
        # borda da região: esfuma para fora (nuca e pescoço acompanham sem degrau)
        ring = ~head & ~soft
        for _ in range(15):
            dn = np.array([d[k].mean(0) if k else d[i] for i, k in enumerate(nb)]); d = np.where(ring[:, None], dn*0.9, d)
        V[:NB] = P + d
        print("R_BUILD projecao lim=%.3f: %d vertices, desloc mediano %.1f mm, max %.1f mm" % (lim, cnt, np.median(np.linalg.norm(d[head], axis=1))*1000, np.linalg.norm(d, axis=1).max()*1000))
    return V
if tgt_b: V = project(V)
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(hpre + ".blend"))
o = bpy.data.objects['Humano']; o.name = 'Busto'
o.data.vertices.foreach_set('co', V.astype(np.float32).ravel()); o.data.update()
o.matrix_world.identity()
if lv > 0:
    m = o.modifiers.new('Sub', 'SUBSURF'); m.levels = lv; m.render_levels = lv
for p in o.data.polygons: p.use_smooth = True
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out)); print("R_BUILD salvo", out, len(V))
