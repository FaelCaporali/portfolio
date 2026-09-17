"""/data/venv-face/bin/python tools/region_tri.py <regiao> [fotos=ref-11,ref-12,ref-14,ref-15]
Alvo 3D de uma região por triangulação multi-vista com câmera LOCAL: em cada foto a pose é refeita (PnP) só com os
landmarks do contexto em volta da região (não da própria região), o que tira o erro global de câmera/lente. Os
landmarks da região são triangulados (DLT + refinamento) nas fotos em que a vista é confiável.
Saída: analise/tri_<regiao>.json {id: {cur, tgt, d_mm, res_px, n}} e resumo."""
import sys, json, numpy as np, cv2
REG = {  # região: (ids da região, ids do contexto)
 'nariz': ([1,2,4,5,6,19,94,98,327,168,197,195,48,278,64,294,129,358,45,275,220,440,102,331],
           [33,133,263,362,70,63,105,66,107,336,296,334,293,300,9,151,116,345,123,352,50,280,101,330,61,291,0,13,17]),
 'olho_esq': ([263,249,390,373,374,380,381,382,362,466,388,387,386,385,384,398,276,283,282,295,285,300,293,334,296,336],
              [1,4,6,168,197,195,5,33,133,9,151,108,337,50,280,345,352,61,291,454]),
 'olho_dir': ([33,7,163,144,145,153,154,155,133,246,161,160,159,158,157,173,46,53,52,65,55,70,63,105,66,107],
              [1,4,6,168,197,195,5,263,362,9,151,108,337,50,280,116,123,61,291,234]),
 'boca': ([0,13,14,17,37,39,40,61,84,91,146,181,185,267,269,270,291,314,321,375,405,409,78,308,82,312,87,317],
          [1,2,4,5,6,33,133,263,362,168,197,98,327,50,280,101,330,116,345]),
}
name = sys.argv[1]; fotos = (sys.argv[2] if len(sys.argv) > 2 else 'ref-11,ref-12,ref-14,ref-15').split(',')
R_ids, C_ids = REG[name]; L = json.load(open('analise/landmarks.json')); lm3 = json.load(open('analise/lm3d_base.json'))
from PIL import Image
cams = []
for f in fotos:
    p = json.load(open(f'analise/pnp/{f}.json')); iw, ih = Image.open(f'referencias/upload-02/{f}.jpg').size
    ent = L[f + '.jpg']; W0, H0 = ent['size']; P2 = np.array(ent['pts'])[:468, :2] * [iw/W0, ih/H0]
    K = np.array([[p['f'], 0, iw/2], [0, p['f'], ih/2], [0, 0, 1.]])
    C = [i for i in C_ids if str(i) in lm3]; X = np.array([lm3[str(i)] for i in C], float)
    rv, tv = np.array(p['rvec'], float).reshape(3, 1), np.array(p['tvec'], float).reshape(3, 1)
    e0 = np.median(np.linalg.norm(cv2.projectPoints(X, rv, tv, K, None)[0][:, 0] - P2[C], axis=1))
    ok, rv2, tv2, inl = cv2.solvePnPRansac(X, P2[C], K, None, rv.copy(), tv.copy(), True, 200, 12.0)
    rv2, tv2 = cv2.solvePnPRefineLM(X[inl[:, 0]], P2[C][inl[:, 0]], K, None, rv2, tv2)
    e1 = np.median(np.linalg.norm(cv2.projectPoints(X, rv2, tv2, K, None)[0][:, 0] - P2[C], axis=1))
    Rm = cv2.Rodrigues(rv2)[0]; cams.append((f, K @ np.hstack([Rm, tv2]), P2, Rm, tv2[:, 0]))
    print(f"{f}: contexto {len(C)} pts, inliers {len(inl)}, erro {e0:.0f} -> {e1:.0f} px")
out = {}; D = []
for i in R_ids:
    if str(i) not in lm3: continue
    cur = np.array(lm3[str(i)]); A = []; used = []
    for f, P, P2, Rm, t in cams:
        # vista confiável: ponto voltado para a câmera (aprox. pela direção do centro do rosto)
        A.append(P2[i][0]*P[2] - P[0]); A.append(P2[i][1]*P[2] - P[1]); used.append(f)
    A = np.array(A); _, _, Vt = np.linalg.svd(A); X = Vt[-1]; X = X[:3]/X[3]
    res = [np.linalg.norm((P @ np.append(X, 1))[:2]/(P @ np.append(X, 1))[2] - P2[i]) for f, P, P2, _, _ in cams]
    d = (X - cur)*1000; out[i] = dict(cur=cur.tolist(), tgt=X.tolist(), d_mm=d.round(2).tolist(), res_px=np.round(res, 1).tolist())
    D.append(d); print(f"  {i:3d}: d = {d.round(1)} mm |d| {np.linalg.norm(d):.1f}  res px {np.round(res).astype(int)}")
D = np.array(D); print(f"{name}: |d| mediano {np.median(np.linalg.norm(D,axis=1)):.1f} mm, média do vetor {D.mean(0).round(1)} mm")
json.dump(out, open(f'analise/tri_{name}.json', 'w'), indent=1)
