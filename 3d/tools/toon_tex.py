"""/data/venv-face/bin/python tools/toon_tex.py <tex.jpg> <islands.png> <out.jpg> [k=14] [sat=1.25] [pos.npy lm3d.json]
Com pos.npy + lm3d.json: olhos e sobrancelhas (raio 2,8 cm dos centros dos olhos) ficam com a textura original.
Textura pintada/cartoon: estilização preservando bordas (cv2.stylization), quantização de cores por k-means em Lab
com mistura suave, saturação +25 %, olhos mantidos nítidos pela própria estilização (bordas fortes ficam)."""
import sys, numpy as np, cv2
src, isl, out = sys.argv[1:4]; k = int(sys.argv[4]) if len(sys.argv) > 4 else 14; sat = float(sys.argv[5]) if len(sys.argv) > 5 else 1.25
im = cv2.imread(src); il = cv2.imread(isl, 0) > 128
small = cv2.resize(im, (2048, 2048), interpolation=cv2.INTER_AREA)
st = cv2.edgePreservingFilter(small, flags=cv2.RECURS_FILTER, sigma_s=30, sigma_r=0.25)   # pintura leve: regiões planas, bordas e olhos mantidos
lab = cv2.cvtColor(st, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
m = cv2.resize(il.astype(np.uint8), (2048, 2048), interpolation=cv2.INTER_NEAREST).ravel() > 0
samp = lab[m][::37]
crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5); _, _, centers = cv2.kmeans(samp, k, None, crit, 3, cv2.KMEANS_PP_CENTERS)
d = ((lab[:, None, :] - centers[None, :, :])**2).sum(2); lbl = d.argmin(1); q = centers[lbl]
mix = 0.35*q + 0.65*lab                                                   # paleta dominante, sem posterização dura
res = cv2.cvtColor(np.clip(mix, 0, 255).astype(np.uint8).reshape(2048, 2048, 3), cv2.COLOR_LAB2BGR)
hsv = cv2.cvtColor(res, cv2.COLOR_BGR2HSV).astype(np.float32); hsv[..., 1] = np.clip(hsv[..., 1]*sat, 0, 255); res = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
res = cv2.resize(res, (im.shape[1], im.shape[0]), interpolation=cv2.INTER_CUBIC)
lab2 = cv2.cvtColor(res, cv2.COLOR_BGR2LAB).astype(np.float32); Lc = lab2[..., 0]; lift = 255*(Lc/255)**0.8; lab2[..., 0] = np.where(Lc > 70, lift, Lc + (lift-Lc)*np.clip((Lc-40)/30, 0, 1))   # levanta sombras da pele, cabelo continua escuro; res = cv2.cvtColor(lab2.astype(np.uint8), cv2.COLOR_LAB2BGR)
if len(sys.argv) > 7:
    import json; pos = np.load(sys.argv[6]); lm = json.load(open(sys.argv[7]))
    keep = np.zeros(il.shape, np.float32)
    for g in ((33,133,159,145), (362,263,386,374)):
        c = np.mean([lm[str(i)] for i in g], 0); d = np.linalg.norm(pos - c, axis=2); keep = np.maximum(keep, np.clip((0.032 - d) / 0.008, 0, 1))
    res = (res*(1-keep[..., None]) + im*keep[..., None]).astype(np.uint8); print("TOON olhos preservados: %.1f%% dos texels" % (100*(keep > 0.5).mean()))
res[~il] = 0
cv2.imwrite(out, res, [cv2.IMWRITE_JPEG_QUALITY, 92]); print("TOON tex", out, "cores", k)
