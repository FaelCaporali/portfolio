"""blender -b --python tools/r_prep.py -- <human_prefix> <target.blend> <lm3d_target.json> <out_prefix> [y_back_mm=95]
Prepara o wrap da malha MPFB COMPLETA (sem apagar nada) sobre o alvo esculpido (S07):
  - alinha o humano ao alvo por Procrustes de similaridade nos landmarks estáveis (sem olhos e sem contorno);
  - reprojeta os landmarks no alvo atual (a S07 mudou lábios/queixo em relação à base onde foram medidos);
  - classifica vértices do corpo: fit (termo de dados), interior (boca, órbitas, narinas: raio pela normal bate na
    própria malha), olhos/lábios internos (macios: só landmarks), nuca (atrás de y_back: fica anatômica), orelhas,
    pescoço/corpo abaixo do alvo;
  - exporta <out>_src.npz (V completo alinhado, arestas e triângulos do corpo, máscaras, grupos do base.obj),
    <out>_tgt.npz (vértices e normais densos do alvo sem a tampa) e <out>_lm.npz."""
import bpy, bmesh, json, sys, os, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a = sys.argv[sys.argv.index("--")+1:]; hpre, tgt_b, lmf, out = a[:4]; y_back = (float(a[4]) if len(a) > 4 else 150.0)/1000
H = np.load(hpre + "_base.npz", allow_pickle=True)   # npz gerado pelo r_human.py deste repo (listas de índices)
V = H['V'].astype(np.float64); NB = 13380
lm_h = dict(zip(H['lm_keys'].tolist(), H['lm_vals'].tolist()))
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(tgt_b)); sc = bpy.data.objects['Busto']
dg = bpy.context.evaluated_depsgraph_get(); bvh_t = BVHTree.FromObject(sc, dg)
LS = {int(k): np.array(v) for k, v in json.load(open(lmf)).items()}
# landmarks no alvo atual: raio vindo da frente (rosto) ou ponto mais próximo (laterais)
LT = {}
for k, p in LS.items():
    if abs(p[0]) < 0.06 and p[2] > 0.03:
        hit = bvh_t.ray_cast(Vector((p[0], p[1] - 0.08, p[2])), Vector((0, 1, 0)), 0.2)
        LT[k] = np.array(hit[0][:]) if hit[0] is not None and abs(hit[0].y - p[1]) < 0.03 else p
    else:
        q = bvh_t.find_nearest(Vector(p)); LT[k] = np.array(q[0][:]) if q[0] is not None else p
mv = np.array([np.linalg.norm(LT[k] - LS[k]) for k in LS]); print("R_PREP landmarks reprojetados: mediana %.2f mm, max %.1f mm" % (np.median(mv)*1000, mv.max()*1000))
eye = {33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398}
oval = {10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109}
lipin = {13,14,78,308,95,88,178,87,317,402,318,324,82,81,80,191,312,311,310,415}
ids = [k for k in lm_h if k in LT and k < 468 and k not in eye and k not in oval and k not in lipin]
A = V[[lm_h[k] for k in ids]]; B = np.array([LT[k] for k in ids])
for it in range(3):
    ca, cb = A.mean(0), B.mean(0); U, S, Vt = np.linalg.svd((B-cb).T @ (A-ca)); D = np.eye(3); D[2,2] = np.sign(np.linalg.det(U@Vt)); R = U@D@Vt
    s = (S*np.diag(D)).sum()/((A-ca)**2).sum(); P = s*((A-ca)@R.T) + cb; r = np.linalg.norm(P-B, axis=1); keep = r < np.median(r)*2.5
    A, B = A[keep], B[keep]
    if it < 2: ids = [k for k, kk in zip(ids, keep) if kk]
print("R_PREP alinhamento: escala %.4f, residuo mediano %.1f mm (%d pts)" % (s, np.median(r)*1000, len(A)))
V = s*((V - ca) @ R.T) + cb
# malha do humano alinhado (para raios e normais)
me = bpy.data.meshes.new('H'); hm = bpy.data.objects.new('HumanoAlinhado', me); bpy.context.scene.collection.objects.link(hm)
src = bpy.data.libraries.load(os.path.abspath(hpre + ".blend"), link=False)
with src as (s_, d_): d_.meshes = ['Humano'] if 'Humano' in s_.meshes else [s_.meshes[0]]
hmesh = d_.meshes[0]; hm.data = hmesh; hmesh.vertices.foreach_set('co', V.astype(np.float32).ravel()); hmesh.update()
E = np.array([e.vertices[:] for e in hmesh.edges]); E = E[(E < NB).all(1)]
F = []
for p in hmesh.polygons:
    vs = p.vertices[:]
    if max(vs) >= NB: continue
    for k in range(1, len(vs)-1): F.append((vs[0], vs[k], vs[k+1]))
F = np.array(F)
N = np.array([v.normal[:] for v in hmesh.vertices])
# interior (boca, fundo das narinas, órbitas): nenhum de 26 raios escapa (DD07). Corpo + globos oculares fecham a cabeça.
import glob as _g
_obj = _g.glob(os.path.expanduser('~/.config/blender/*/extensions/blender_org/mpfb/data/3dobjs/base.obj'))[0]
_eg = set(); _g_ = None
for line in open(_obj):
    if line.startswith('g '): _g_ = line.split()[1]
    elif line.startswith('f ') and _g_ in ('helper-l-eye', 'helper-r-eye'): _eg.update(int(t.split('/')[0]) - 1 for t in line.split()[1:])
bm = bmesh.new(); bm.from_mesh(hmesh)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if max(v.index for v in f.verts) >= NB and not all(v.index in _eg for v in f.verts)], context='FACES_ONLY')
bvh_h = BVHTree.FromBMesh(bm); bm.free()
dirs = [Vector((x, y, z)).normalized() for x in (-1, 0, 1) for y in (-1, 0, 1) for z in (-1, 0, 1) if (x, y, z) != (0, 0, 0)]
interior = np.zeros(len(V), bool)
for i in range(NB):
    if V[i, 2] < 0.02: continue
    co = Vector(V[i]) + Vector(N[i])*0.0006
    interior[i] = all(bvh_h.ray_cast(co, dd, 0.5)[0] is not None for dd in dirs)
# grupos do base.obj (helpers e juntas) por índice
import glob
obj = glob.glob(os.path.expanduser('~/.config/blender/*/extensions/blender_org/mpfb/data/3dobjs/base.obj'))[0]
groups = {}; g = None
for line in open(obj):
    if line.startswith('g '): g = line.split()[1]; groups.setdefault(g, set())
    elif line.startswith('f ') and g: groups[g].update(int(t.split('/')[0]) - 1 for t in line.split()[1:])
groups = {k: np.array(sorted(v)) for k, v in groups.items()}
P = V
lmV = lambda k: V[lm_h[k]]
ec_r = np.mean([lmV(k) for k in (33, 133, 159, 145)], 0); ec_l = np.mean([lmV(k) for k in (362, 263, 386, 374)], 0)
mc = np.mean([lmV(k) for k in (61, 291, 13, 14)], 0)
dr = np.linalg.norm(P - ec_r, axis=1); dl = np.linalg.norm(P - ec_l, axis=1)
er = np.linalg.norm(lmV(33) - lmV(133))/2; el = np.linalg.norm(lmV(362) - lmV(263))/2
soft_eye = ((dr < er*0.95) | (dl < el*0.95))
ear = np.zeros(len(V), bool); ear[[i for i in range(NB)]] = False
ears_g = H['g_idx'][list(H['g_names']).index('ears')]; ear[ears_g] = True
zmin_t = min(v.co.z for v in sc.data.vertices)
body = np.arange(len(V)) < NB
back = (P[:, 1] > y_back) & (P[:, 2] < 0.145)   # só o bloco abaixo do coque (cabelo caído + pescoço) fica anatômico; topo, massa de cabelo e coque entram no ajuste
low = P[:, 2] < zmin_t + 0.012
fit = body & ~interior & ~soft_eye & ~back & ~low & ~ear
print("R_PREP vertices: corpo %d, interior %d, olho macio %d, nuca %d, orelhas %d, abaixo do alvo %d -> fit %d" % (NB, (interior & body).sum(), soft_eye.sum(), (back & body).sum(), ear.sum(), (low & body).sum(), fit.sum()))
print("R_PREP perfil do humano alinhado (mm): topo z %.0f, nuca y max %.0f, nariz y %.0f; alvo: y max %.0f" % (V[:NB, 2].max()*1000, V[:NB][V[:NB, 2] > 0.12][:, 1].max()*1000, V[lm_h[4], 1]*1000, max(v.co.y for v in sc.data.vertices)*1000))
lk = [k for k in lm_h if k in LT and k < 468]
li = np.array([lm_h[k] for k in lk]); lp = np.array([LT[k] for k in lk])
# alvo: vértices e normais densos, sem a tampa
T = np.array([v.co[:] for v in sc.data.vertices]); TN = np.array([v.normal[:] for v in sc.data.vertices])
cap = (T[:, 2] < zmin_t + 0.003) & (TN[:, 2] < -0.5)
T, TN = T[~cap], TN[~cap]
CLS = np.load(out.rsplit('/', 1)[0] + '/s07_cls.npy')[~cap] if len(a) < 6 else np.load(a[5])[~cap]
lips_idx = H['g_idx'][list(H['g_names']).index('lips')]
np.savez(out + "_src.npz", V=V, lips=lips_idx, E=E, F=F, NB=NB, fit=fit, interior=interior, soft_eye=soft_eye, back=back, ear=ear, low=low,
         g_names=np.array(list(groups.keys())), g_idx=np.array(list(groups.values()), dtype=object), sim=np.r_[s, R.ravel(), ca, cb])
np.savez(out + "_tgt.npz", V=T, N=TN, cls=CLS)
np.savez(out + "_lm.npz", idx=li, pos=lp, mp_id=np.array(lk))
print("R_PREP salvo: alvo %d vertices, %d landmarks" % (len(T), len(lk)))
