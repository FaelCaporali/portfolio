"""/data/venv-face/bin/python tools/region_crop.py <render_prefix> <foto> <ds> <lm_ids,sep,virgula> <pad> <out.jpg>
Recorte ampliado de uma região (landmarks MediaPipe) : foto | foto+clay | foto com contorno da malha em vermelho e
bordas da foto (Canny) em verde. Landmarks da foto em verde, 3D projetados em vermelho, com o erro em px."""
import sys, json, numpy as np, cv2
from PIL import Image
pre, name, ds, ids, pad, outp = sys.argv[1], sys.argv[2], int(sys.argv[3]), [int(i) for i in sys.argv[4].split(',')], int(sys.argv[5]), sys.argv[6]
L = json.load(open('analise/landmarks.json')); lm3 = json.load(open('analise/lm3d_base.json')); p = json.load(open(f'analise/pnp/{name}.json'))
ph0 = Image.open(f'referencias/upload-02/{name}.jpg').convert('RGB'); iw, ih = ph0.size; ph = np.asarray(ph0.resize((iw//ds, ih//ds)))
rd = np.asarray(Image.open(f'{pre}_{name}.png').convert('RGBA')).astype(float); rd = rd[:ph.shape[0], :ph.shape[1]]; ra = rd[..., 3:]/255
ent = L[name + '.jpg']; W0, H0 = ent['size']; P2 = np.array(ent['pts'])[:468, :2] * [iw/W0/ds, ih/H0/ds]
K = np.array([[p['f']/ds, 0, iw/2/ds], [0, p['f']/ds, ih/2/ds], [0, 0, 1]])
ok = [i for i in ids if str(i) in lm3]; pr = cv2.projectPoints(np.array([lm3[str(i)] for i in ok], float), np.array(p['rvec']), np.array(p['tvec']), K, None)[0][:, 0]
x0, y0 = (P2[ids].min(0) - pad).astype(int); x1, y1 = (P2[ids].max(0) + pad).astype(int)
mix = (ph*(1-0.5*ra) + rd[..., :3]*0.5*ra).astype(np.uint8); ctr = ph.copy()
cs, _ = cv2.findContours((ra[..., 0] > 0.5).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); cv2.drawContours(ctr, cs, -1, (255, 30, 30), 1)
g = cv2.Canny(cv2.GaussianBlur(cv2.cvtColor(ph, cv2.COLOR_RGB2GRAY), (5, 5), 0), 30, 80); ctr[g > 0] = (0, 255, 0)
e = np.linalg.norm(P2[ok] - pr, axis=1) * ds
for k, i in enumerate(ok):
    cv2.circle(ctr, tuple(int(v) for v in P2[i]), 2, (0, 255, 0), -1); cv2.circle(ctr, tuple(int(v) for v in pr[k]), 2, (255, 0, 0), -1)
row = np.concatenate([im[max(y0,0):y1, max(x0,0):x1] for im in (ph, mix, ctr)], 1)
row = cv2.resize(row, (1500, int(row.shape[0]*1500/row.shape[1])), interpolation=cv2.INTER_CUBIC)
cv2.putText(row, f'{name} lm err med {np.median(e):.0f}px (foto 4208px)', (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
Image.fromarray(row).save(outp, quality=90); print("CROP", outp, "err", np.round(e).astype(int).tolist())
