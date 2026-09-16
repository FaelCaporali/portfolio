"""venv: python tools/v13_fuse_fit.py <lm3d_mesh.json> <fused_landmarks.json> <out_disp.json> [clip_cm=1.5]
Alinha a medida 3D fundida (9 fotos, cm) aos landmarks raycast da malha (m) por Procrustes com escala,
descarta outliers, e grava deslocamento-alvo por landmark (em metros da malha) + estatísticas."""
import json, sys, numpy as np
lm = json.load(open(sys.argv[1])); F = np.array(json.load(open(sys.argv[2]))['pts_cm'])
out = sys.argv[3]; clip_cm = float(sys.argv[4]) if len(sys.argv) > 4 else 1.5
eye = {33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398}
lips = {78,95,88,178,87,14,317,402,318,324,308,191,80,81,82,13,312,311,310,415}
ids = [i for i in range(468) if str(i) in lm]
A = np.array([lm[str(i)] for i in ids]); B = F[ids]
def procrustes(A, B):
    ca, cb = A.mean(0), B.mean(0); A0, B0 = A-ca, B-cb
    U, S, Vt = np.linalg.svd(B0.T @ A0); D = np.eye(3); D[2,2] = np.sign(np.linalg.det(U@Vt))
    R = U @ D @ Vt; s = (S*np.diag(D)).sum() / (B0**2).sum()
    return s, R, ca - s*(cb@R)
use = np.array([i not in eye and i not in lips for i in ids])
for it in range(4):
    s, R, t = procrustes(A[use], B[use]); P = s*(B@R) + t; r = np.linalg.norm(P-A, axis=1)
    thr = np.median(r[use])*2.5; use = use & (r < thr)
d = P - A; n = np.linalg.norm(d, axis=1)
print("FIT escala_malha/cm=%.4f (1 cm real = %.2f cm na malha)  residuo mediano=%.2f cm  p90=%.2f cm  usados=%d/%d" % (s, s*100, np.median(n)/s, np.percentile(n,90)/s, use.sum(), len(ids)))
clip = clip_cm*s
d = np.where((n > clip)[:,None], d*(clip/np.maximum(n,1e-9))[:,None], d)
# não empurrar olhos/lábios internos: peso zero
w = np.array([0.0 if (i in eye or i in lips) else 1.0 for i in ids])
json.dump({'ids': ids, 'A': A.tolist(), 'disp': d.tolist(), 'w': w.tolist(), 'scale': s}, open(out, 'w'))
# maiores desvios por região (para o relatório)
names = {1:'ponta nariz',4:'dorso nariz',195:'raiz nariz',234:'zigoma D',454:'zigoma E',172:'mandíbula D',397:'mandíbula E',152:'queixo',
         70:'sobranc D ext',300:'sobranc E ext',105:'sobranc D',334:'sobranc E',61:'boca D',291:'boca E',10:'testa',127:'têmpora D',356:'têmpora E'}
for i, nm in names.items():
    if i in ids: k = ids.index(i); print("  %-14s desvio %.2f cm (dx=%+.2f dy=%+.2f dz=%+.2f)" % (nm, n[k]/s, *(d[k]/s)))
