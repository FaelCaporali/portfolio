"""/data/venv-face/bin/python tools/profile_cmp.py <render_prefix> <foto> <out.jpg> [ctx_ids] [reg_ids]
Perfil do nariz: contorno da malha (render ds=2) sobre a foto, após alinhamento LOCAL por similaridade 2D usando
landmarks de contexto (testa, raiz do nariz, olho, bochecha), para tirar o erro de câmera. Máscara da foto em ds=2
(rembg, cache). Mede a distância do contorno da malha ao da foto por trecho (dorso, ponta, columela, subnasal)."""
import sys, os, json, numpy as np, cv2
from PIL import Image
pre, name, outp = sys.argv[1:4]
ctx = [int(i) for i in (sys.argv[4] if len(sys.argv) > 4 else '9,151,168,6,197,33,133,159,145,116,123,50,205,234,127,162,21').split(',')]
ds = 2; L = json.load(open('analise/landmarks.json')); lm3 = json.load(open('analise/lm3d_base.json')); p = json.load(open(f'analise/pnp/{name}.json'))
ph0 = Image.open(f'referencias/upload-02/{name}.jpg').convert('RGB'); iw, ih = ph0.size; ph = np.asarray(ph0.resize((iw//ds, ih//ds)))
mp_ = f'analise/photo_masks/{name}_ds2.png'
if not os.path.exists(mp_):
    from rembg import remove, new_session
    m = np.asarray(remove(Image.fromarray(ph), session=new_session("isnet-general-use"), post_process_mask=True))[..., 3]
    Image.fromarray(((m > 127)*255).astype(np.uint8)).save(mp_)
pm = (np.asarray(Image.open(mp_)) > 127).astype(np.uint8)
rd = np.asarray(Image.open(f'{pre}_{name}.png').convert('RGBA'))[:ph.shape[0], :ph.shape[1]]; ra = (rd[..., 3] > 127).astype(np.uint8)
ent = L[name + '.jpg']; W0, H0 = ent['size']; P2 = np.array(ent['pts'])[:468, :2] * [iw/W0/ds, ih/H0/ds]
K = np.array([[p['f']/ds, 0, iw/2/ds], [0, p['f']/ds, ih/2/ds], [0, 0, 1]])
ok = [i for i in ctx if str(i) in lm3]
pr = cv2.projectPoints(np.array([lm3[str(i)] for i in ok], float), np.array(p['rvec']), np.array(p['tvec']), K, None)[0][:, 0]
M, inl = cv2.estimateAffinePartial2D(pr.astype(np.float32), P2[ok].astype(np.float32), method=cv2.RANSAC, ransacReprojThreshold=6)
ra2 = cv2.warpAffine(ra, M, (ra.shape[1], ra.shape[0]), flags=cv2.INTER_NEAREST); rd2 = cv2.warpAffine(rd, M, (ra.shape[1], ra.shape[0]))
nose = [1, 2, 4, 5, 6, 19, 94, 168, 197, 195, 0, 164]
q = P2[nose]; x0, y0 = (q.min(0) - 90).astype(int); x1, y1 = (q.max(0) + 90).astype(int)
ctr = ph.copy()
for msk, c in ((pm, (0, 255, 0)), (ra2, (255, 30, 30))):
    cs, _ = cv2.findContours(msk, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); cv2.drawContours(ctr, cs, -1, c, 1)
mix = (ph*0.5 + rd2[..., :3]*0.5*(ra2[..., None]) + ph*0.5*(1-ra2[..., None])).astype(np.uint8)
# distância assinada no recorte: contorno da malha -> máscara da foto (+ = malha para fora)
sd = cv2.distanceTransform(1-pm, cv2.DIST_L2, 5) - cv2.distanceTransform(pm, cv2.DIST_L2, 5)
cs, _ = cv2.findContours(ra2, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); cp = np.concatenate(cs)[:, 0]
cp = cp[(cp[:, 0] > x0) & (cp[:, 0] < x1) & (cp[:, 1] > y0) & (cp[:, 1] < y1)]
mmpx = abs(p['tvec'][2])/(p['f']/ds)*1000
segs = {'dorso': (P2[168][1], P2[4][1]-25), 'ponta': (P2[4][1]-25, P2[4][1]+25), 'columela': (P2[4][1]+25, P2[2][1]), 'labio': (P2[2][1], P2[0][1])}
rep = {}
for k, (a, b) in segs.items():
    s = cp[(cp[:, 1] >= min(a, b)) & (cp[:, 1] < max(a, b))]
    s = s[s[:, 0] > np.percentile(cp[:, 0], 40)] if len(s) else s   # lado da frente (perfil voltado para a direita da imagem)
    if len(s): v = sd[s[:, 1], s[:, 0]]; rep[k] = (round(float(np.median(v))*mmpx, 1), round(float(v.max())*mmpx, 1), round(float(v.min())*mmpx, 1))
row = np.concatenate([im[y0:y1, x0:x1] for im in (ph, mix, ctr)], 1)
row = cv2.resize(row, (1500, int(row.shape[0]*1500/row.shape[1])), interpolation=cv2.INTER_CUBIC)
cv2.putText(row, f'{name} alinh. local {int(inl.sum())}/{len(ok)} | mm (med,max,min) + = malha p/ fora', (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
Image.fromarray(row).save(outp, quality=92); print("PERFIL", outp, rep, "mm/px", round(mmpx, 3))
