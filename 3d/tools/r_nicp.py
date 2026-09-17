"""/data/venv-face/bin/python tools/r_nicp.py <prefix> [z_solve_m=-0.20]
NICP (Amberg 2007) da malha MPFB completa sobre o alvo denso (r_prep). Só os vértices do corpo acima de z_solve
entram no sistema; os de baixo ficam como estão. Termo de dados só onde fit=True (par = projeção no plano tangente
do vértice mais próximo do alvo, com normal compatível e distância curta); landmarks (sem contorno do rosto) com par
inicial < 2 cm. Grava <prefix>_nicp.npz: V (todos os vértices; helpers ainda sem mover), X (afim 4x3 por vértice
resolvido) e solve (índices)."""
import sys, numpy as np, scipy.sparse as sp, scipy.sparse.linalg as spl
from scipy.spatial import cKDTree
pre = sys.argv[1]; zs = float(sys.argv[2]) if len(sys.argv) > 2 else -0.20
S = np.load(pre + "_src.npz", allow_pickle=True)   # gerado por r_prep.py deste repo
T = np.load(pre + "_tgt.npz"); L = np.load(pre + "_lm.npz")
Vall = S['V']*100; NB = int(S['NB']); E0 = S['E']; F0 = S['F']
fitall = S['fit'].copy()
Vb = Vall[:NB]
solve = np.nonzero(Vb[:, 2] > zs*100)[0]; loc = -np.ones(NB, int); loc[solve] = np.arange(len(solve))
V0 = Vb[solve]; n = len(V0); fit = fitall[solve]
lips = np.zeros(len(Vall), bool); lips[S['lips']] = True
fitw = fit.copy()
back = S['back'][solve] & ~(S['low'] | S['interior'] | S['ear'])[solve]
N0 = None
penok = ~(S['low'] | S['interior'] | S['ear'] | S['soft_eye'])[solve]            # só a cabeça pode ser empurrada para dentro do pelo
E = loc[E0]; E = E[(E >= 0).all(1)]; F = loc[F0]; F = F[(F >= 0).all(1)]
# zíper da boca: pares de vértices dos lábios muito próximos e não vizinhos (linha de contato superior/inferior)
lip_loc = loc[np.nonzero(lips[:NB])[0]]; lip_loc = lip_loc[lip_loc >= 0]
kdl = cKDTree(V0[lip_loc]); nbset = set(map(tuple, np.sort(E, 1)))
ZP = [(lip_loc[i], lip_loc[j]) for i, j in kdl.query_pairs(0.25) if tuple(sorted((lip_loc[i], lip_loc[j]))) not in nbset]
ZP = np.array(ZP) if ZP else np.zeros((0, 2), int)
print("R_NICP ziper da boca: %d pares" % len(ZP))
TV = T['V']*100; TN = T['N']; CLS = T['cls']
ALL = len(sys.argv) > 5 and sys.argv[5] == 'all'
selT = (CLS != 1) if ALL else (CLS == 0)     # 'all' = pele + barba (o cabelo vira casca própria)
kd = cKDTree(TV[selT]); TVs, TNs = TV[selT], TN[selT]                         # pares: pele (ou todo o alvo com 'all')
kh = cKDTree(TV[CLS > 0]); TVh, TNh = TV[CLS > 0], TN[CLS > 0]               # cabelo/barba: só impede a pele de atravessar
TMIN = float(sys.argv[3]) if len(sys.argv) > 3 else 0.3
LAM = float(sys.argv[4]) if len(sys.argv) > 4 else 0.3      # regularização para a identidade (anatomia MPFB alinhada)
oval = {10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109}
li = loc[L['idx']]; lp = L['pos']*100; mid = L['mp_id']
ok_l = (li >= 0) & np.array([(m not in oval) or m in (152, 148, 377, 176, 400) for m in mid])
dl = np.linalg.norm(V0[np.clip(li, 0, None)] - lp, axis=1); ok_l &= dl < 2.0
print("R_NICP resolver %d vertices (%d com dados), %d arestas; landmarks %d de %d" % (n, fit.sum(), len(E), ok_l.sum(), len(li)), flush=True)
li, lp = li[ok_l], lp[ok_l]
def vnormals(V):
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]); N = np.zeros_like(V)
    for k in range(3): np.add.at(N, F[:, k], fn)
    return N/np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
m = len(E)
M = sp.coo_matrix((np.r_[-np.ones(m), np.ones(m)], (np.r_[np.arange(m), np.arange(m)], np.r_[E[:, 0], E[:, 1]])), shape=(m, n))
# rigidez por região (Wrap3: regiões de detalhe da malha base se movem quase como bloco)
Hb = np.load(pre.rsplit('/', 1)[0] + '/human_base.npz', allow_pickle=True)   # gerado por r_human.py
lmh = dict(zip(Hb['lm_keys'].tolist(), Hb['lm_vals'].tolist()))
def ctr(ids): return np.mean([V0[loc[lmh[k]]] for k in ids if loc[lmh[k]] >= 0], 0)
KM = float(sys.argv[7]) if len(sys.argv) > 7 else 10.0
ew = np.ones(n)
for c_, r_, k_ in ((ctr((13, 14, 61, 291)), 3.2, KM), (ctr((33, 133, 159, 145)), 2.4, KM), (ctr((362, 263, 386, 374)), 2.4, KM), (ctr((98, 327, 4, 2)), 1.6, max(KM/3, 1))):
    dd_ = np.linalg.norm(V0 - c_, axis=1); ew = np.maximum(ew, 1 + (k_ - 1)*np.clip((2.6 - dd_/r_)/1.6, 0, 1)**2)
eW = np.maximum(ew[E[:, 0]], ew[E[:, 1]])
MG = sp.kron(sp.diags(eW) @ M, sp.diags([1, 1, 1, 1.0])).tocsr()
def Dmat(V, rows):
    k = len(rows); r = np.repeat(np.arange(k), 4); c = (4*rows[:, None] + np.arange(4)[None, :]).ravel()
    return sp.coo_matrix((np.c_[V[rows], np.ones(k)].ravel(), (r, c)), shape=(k, 4*n)).tocsr()
D = Dmat(V0, np.arange(n)); DL = Dmat(V0, li)
DZ = (Dmat(V0, ZP[:, 0]) - Dmat(V0, ZP[:, 1])) if len(ZP) else None
HCAP = float(sys.argv[6]) if len(sys.argv) > 6 else 1.5
CAPT = V0 + HCAP*vnormals(V0); backcap = back & (V0[:, 2] > 12.0)
X = np.tile(np.vstack([np.eye(3), np.zeros((1, 3))]), (n, 1)); XI = X.copy()
def flips(V):
    f0 = np.cross(V0[F[:, 1]] - V0[F[:, 0]], V0[F[:, 2]] - V0[F[:, 0]]); f1 = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    c = (f0*f1).sum(1)/np.maximum(np.linalg.norm(f0, axis=1)*np.linalg.norm(f1, axis=1), 1e-12)
    return int((c < 0).sum()), int((c < 0.5).sum())
sched = [(60, 5, 4.0), (25, 5, 3.0), (12, 3, 2.0), (6, 2, 1.5), (3, 1, 1.0), (1.5, 1, 0.8)]
AMIN = float(sys.argv[8]) if len(sys.argv) > 8 else 0
for alpha, beta, dmax in [t for t in sched if t[0] >= AMIN]:
    for it in range(12):
        V = D @ X; N = vnormals(V)
        dist, j = kd.query(V); q = TVs[j]; nq = TNs[j]
        P = V - ((V - q)*nq).sum(1, keepdims=True)*nq                 # projeção no plano tangente do alvo
        dd = np.linalg.norm(P - V, axis=1)
        ok = fit & (dd < dmax) & ((N*nq).sum(1) > 0.4)
        dh, jh = kh.query(V); qh = TVh[jh]; nh = TNh[jh]; sd = ((V - qh)*nh).sum(1)
        pen = ~ok & (dh < dmax) & (sd > -TMIN) & ((N*nh).sum(1) > 0.3) & penok
        P = np.where(pen[:, None], V - (sd + TMIN)[:, None]*nh, P)
        weak = fitw & ~ok & ~pen & (dist < 5.0)                                  # sem par confiável: termo fraco (DD07)
        P = np.where(weak[:, None], q, P)
        cap = backcap                                                             # nuca: calota anatômica + espessura do cabelo
        P = np.where(cap[:, None], CAPT, P)
        W = sp.diags(ok.astype(float) + 0.5*pen + 0.15*weak + 0.3*cap)
        A = sp.vstack([alpha*MG, W @ D, beta*DL, LAM*sp.identity(4*n)] + ([5.0*DZ] if DZ is not None else [])).tocsr()
        B = np.vstack([np.zeros((4*m, 3)), W @ P, beta*lp, LAM*XI] + ([np.zeros((len(ZP), 3))] if DZ is not None else []))
        AtA = (A.T @ A).tocsc(); solver = spl.factorized(AtA); AtB = A.T @ B; Xn = np.column_stack([solver(AtB[:, c]) for c in range(3)])
        ch = np.abs(Xn - X).max(); X = Xn
        if ch < 2e-3: break
    V = D @ X; dist, j = kd.query(V); fit_ = fit & (dist < 1.0); lr = np.sqrt(((V[li] - lp)**2).sum(1).mean())
    print("R_NICP alpha=%g beta=%g it=%d pares=%d pen=%d dist mediana(fit)=%.2f mm landmarks rms=%.2f mm dobras(<0, <60 graus)=%s" % (alpha, beta, it+1, ok.sum(), pen.sum(), np.median(dist[fit])*10, lr*10, flips(V)), flush=True)
V = D @ X; dv = np.linalg.norm(V - V0, axis=1)
print("R_NICP deslocamento: mediana %.1f mm, p95 %.1f mm, max %.1f mm" % (np.median(dv)*10, np.percentile(dv, 95)*10, dv.max()*10))
out = Vall.copy(); out[solve] = V
np.savez(pre + "_nicp.npz", V=out/100, X=X.reshape(n, 4, 3), solve=solve, V0=V0/100)
print("R_NICP salvo")
