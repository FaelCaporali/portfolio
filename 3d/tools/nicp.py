"""/data/venv-face/bin/python tools/nicp.py <prefix> [out.npy]
Registro não rígido (Amberg et al. 2007, 'Optimal step nonrigid ICP'): cada vértice da malha limpa recebe uma
transformação afim 3x4; minimiza rigidez (transformações vizinhas parecidas) + distância ao ponto mais próximo
do scan (só pares com normais compatíveis e distância curta) + landmarks (pontos e vetores: vértice -> alvo).
Rigidez decrescente. Trabalha em cm. Saída: vértices deformados (m) no mesmo índice da malha limpa."""
import sys, numpy as np, scipy.sparse as sp, scipy.sparse.linalg as spl, trimesh
pre = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else pre + "_nicp.npy"
S = np.load(pre + "_src.npz"); T = np.load(pre + "_tgt.npz"); L = np.load(pre + "_lm.npz")
V0 = S['V']*100; E = S['E']; F = S['F']; occl = S['occl'] if 'occl' in S else np.zeros(len(V0), bool); soft = S['soft'] if 'soft' in S else np.zeros(len(V0), bool); occl = occl | soft; TV = T['V']*100; TF = T['F']; li = L['idx']; lp = L['pos']*100
dl = np.linalg.norm(V0[li]-lp, axis=1); keep = (dl < 2.0) & ~soft[li]; print("NICP landmarks: %d de %d com par a menos de 2 cm (descartados os outros)" % (keep.sum(), len(li))); li, lp = li[keep], lp[keep]
n = len(V0); m = len(E); tm = trimesh.Trimesh(TV, TF, process=False)
gamma = 1.0
M = sp.coo_matrix((np.r_[-np.ones(m), np.ones(m)], (np.r_[np.arange(m), np.arange(m)], np.r_[E[:,0], E[:,1]])), shape=(m, n))
G = sp.diags([1, 1, 1, gamma]); MG = sp.kron(M, G).tocsr()                       # 4m x 4n
def Dmat(V, rows=None):
    rows = np.arange(n) if rows is None else rows; k = len(rows)
    r = np.repeat(np.arange(k), 4); c = (4*rows[:,None] + np.arange(4)[None,:]).ravel()
    d = np.c_[V[rows], np.ones(k)].ravel(); return sp.coo_matrix((d, (r, c)), shape=(k, 4*n)).tocsr()
D = Dmat(V0); DL = Dmat(V0, li)
X = np.tile(np.vstack([np.eye(3), np.zeros((1,3))]), (n, 1))                        # 4n x 3
sched = [(50, 5, 5.0), (20, 5, 3.0), (10, 3, 2.0), (5, 2, 1.5), (3, 1, 1.0)]
for alpha, beta, dmax in sched:
    for it in range(10):
        V = D @ X; sm = trimesh.Trimesh(V, F, process=False); N = sm.vertex_normals
        P, dist, tri = trimesh.proximity.closest_point(tm, V); TN = tm.face_normals[tri]
        ok = (dist < dmax) & ((N*TN).sum(1) > 0.5) & ~occl
        weak = ~ok & (dist < 5.0) & ~occl                      # sem par confiável: termo fraco para não extrapolar
        W = sp.diags(ok.astype(float) + 0.15*weak)
        reg = 1e-3*sp.identity(4*n)
        A = sp.vstack([alpha*MG, W @ D, beta*DL, reg]).tocsr(); B = np.vstack([np.zeros((4*m, 3)), W @ P, beta*lp, 1e-3*X])
        Xn = spl.spsolve((A.T @ A).tocsc(), A.T @ B); Xn = np.asarray(Xn)
        ch = np.abs(Xn - X).max(); X = Xn
        if ch < 1e-3: break
    V = D @ X; P, dist, tri = trimesh.proximity.closest_point(tm, V); lrms = np.sqrt(((V[li]-lp)**2).sum(1).mean())
    print("NICP alpha=%g beta=%g: it=%d validos=%.0f%% dist mediana=%.2f cm landmarks rms=%.2f cm" % (alpha, beta, it+1, 100*ok.mean(), np.median(dist), lrms), flush=True)
V = D @ X; dv = np.linalg.norm(V - V0, axis=1); print("NICP deslocamento: mediana %.2f cm, p95 %.2f cm, max %.2f cm" % (np.median(dv), np.percentile(dv, 95), dv.max()))
np.save(out, V/100); print("NICP salvo", out)
