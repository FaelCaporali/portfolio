"""/data/venv-face/bin/python tools/profile_low.py <render_prefix> <foto> <out.jpg> [ctx_ids]
Perfil do terço inferior (bigode, lábios, queixo, barba): mesmo alinhamento local do profile_cmp (landmarks de contexto),
recorte do nariz até abaixo da barba. Por linha da imagem, compara o ponto mais à frente da malha com o da foto
(perfil voltado para a direita). Imprime a diferença em mm por faixa (+ = malha à frente da foto)."""
import sys, os, json, numpy as np, cv2
from PIL import Image
pre, name, outp = sys.argv[1:4]
ctx = [int(i) for i in (sys.argv[4] if len(sys.argv) > 4 else '9,151,168,6,197,33,133,159,145,116,123,50,205,234,127,162,21,1,4').split(',')]
ds = 2; L = json.load(open('analise/landmarks.json')); lm3 = json.load(open('analise/lm3d_base.json')); p = json.load(open(f'analise/pnp/{name}.json'))
ph0 = Image.open(f'referencias/upload-02/{name}.jpg').convert('RGB'); iw, ih = ph0.size; ph = np.asarray(ph0.resize((iw//ds, ih//ds)))
pm = (np.asarray(Image.open(f'analise/photo_masks/{name}_ds2.png')) > 127).astype(np.uint8)
rd = np.asarray(Image.open(f'{pre}_{name}.png').convert('RGBA'))[:ph.shape[0], :ph.shape[1]]; ra = (rd[..., 3] > 127).astype(np.uint8)
ent = L[name + '.jpg']; W0, H0 = ent['size']; P2 = np.array(ent['pts'])[:468, :2] * [iw/W0/ds, ih/H0/ds]
K = np.array([[p['f']/ds, 0, iw/2/ds], [0, p['f']/ds, ih/2/ds], [0, 0, 1]])
ok = [i for i in ctx if str(i) in lm3]
pr = cv2.projectPoints(np.array([lm3[str(i)] for i in ok], float), np.array(p['rvec']), np.array(p['tvec']), K, None)[0][:, 0]
M, inl = cv2.estimateAffinePartial2D(pr.astype(np.float32), P2[ok].astype(np.float32), method=cv2.RANSAC, ransacReprojThreshold=6)
ra2 = cv2.warpAffine(ra, M, (ra.shape[1], ra.shape[0]), flags=cv2.INTER_NEAREST); rd2 = cv2.warpAffine(rd, M, (ra.shape[1], ra.shape[0]))
mmpx = abs(p['tvec'][2])/(p['f']/ds)*1000
y0 = int(P2[4][1] - 40); y1 = int(P2[152][1] + 260); xc = int(P2[4][0]); x0, x1 = xc - 330, xc + 90
ctr = ph.copy()
for msk, c in ((pm, (0, 255, 0)), (ra2, (255, 30, 30))):
    cs, _ = cv2.findContours(msk, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); cv2.drawContours(ctr, cs, -1, c, 1)
mix = (ph*0.5 + rd2[..., :3]*0.5*(ra2[..., None]) + ph*0.5*(1-ra2[..., None])).astype(np.uint8)
rows = []
for y in range(y0, y1):
    a = np.nonzero(ra2[y, x0:x1])[0]; b = np.nonzero(pm[y, x0:x1])[0]
    if len(a) and len(b): rows.append((y, (a.max() - b.max())*mmpx))
rows = np.array(rows)
lab = {'subnasal': P2[2][1], 'labio sup': P2[0][1], 'labio inf': P2[17][1], 'queixo(lm)': P2[152][1]}
print("PERFIL_BAIXO", name, "mm/px %.3f alinh %d/%d" % (mmpx, inl.sum(), len(ok)), {k: round(float((v - P2[4][1])*mmpx), 1) for k, v in lab.items()})
for a in range(y0, y1, 20):
    s = rows[(rows[:, 0] >= a) & (rows[:, 0] < a + 20)]
    if len(s): print("  z%+6.1f mm abaixo da ponta: malha-foto med %+5.1f  min %+5.1f max %+5.1f" % ((a + 10 - P2[4][1])*mmpx, np.median(s[:, 1]), s[:, 1].min(), s[:, 1].max()))
row = np.concatenate([im[y0:y1, x0:x1] for im in (ph, mix, ctr)], 1)
for k, v in lab.items(): cv2.putText(row, k, (2*(x1-x0)+4, int(v - y0)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 0), 1)
row = cv2.resize(row, (1500, int(row.shape[0]*1500/row.shape[1])), interpolation=cv2.INTER_CUBIC)
Image.fromarray(row).save(outp, quality=92)
