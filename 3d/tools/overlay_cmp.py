"""/data/venv-face/bin/python tools/overlay_cmp.py <render_prefix> <label> <out.jpg> [ds=4]
Folha de sobreposição por foto (ref-11,12,14,15): foto | foto + clay 50% | contornos (verde = silhueta da foto
(cabeça+cabelo+barba, rembg isnet), vermelho = silhueta da malha) + landmarks 2D da foto (verde) e 3D projetados (vermelho).
Máscaras da foto ficam em cache em analise/photo_masks/."""
import sys, os, json, numpy as np, cv2
from PIL import Image
pre, label, outp = sys.argv[1:4]; ds = int(sys.argv[4]) if len(sys.argv) > 4 else 4
L = json.load(open('analise/landmarks.json')); lm3 = json.load(open('analise/lm3d_base.json')); os.makedirs('analise/photo_masks', exist_ok=True)
cols = []; M_ = []
for name in ['ref-11', 'ref-12', 'ref-14', 'ref-15']:
    ph = Image.open(f'referencias/upload-02/{name}.jpg').convert('RGB'); iw, ih = ph.size; ph = np.asarray(ph.resize((iw//ds, ih//ds)))
    mp_ = f'analise/photo_masks/{name}.png'
    if not os.path.exists(mp_):
        from rembg import remove, new_session
        m = np.asarray(remove(Image.fromarray(ph), session=new_session("isnet-general-use"), post_process_mask=True))[..., 3]
        Image.fromarray(((m > 127)*255).astype(np.uint8)).save(mp_)
    pm = np.asarray(Image.open(mp_)) > 127
    rd = np.asarray(Image.open(f'{pre}_{name}.png').convert('RGBA')).astype(float); ra = rd[..., 3:]/255
    h, w = pm.shape; rd = rd[:h, :w]; ra = ra[:h, :w]
    mix = (ph*(1-0.55*ra) + rd[..., :3]*0.55*ra).astype(np.uint8); ctr = (ph*0.35).astype(np.uint8).copy()
    for msk, c in ((pm, (0, 255, 0)), (ra[..., 0] > 0.5, (255, 40, 40))):
        cs, _ = cv2.findContours(msk.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); cv2.drawContours(ctr, cs, -1, c, 2)
    p = json.load(open(f'analise/pnp/{name}.json')); ent = L[name + '.jpg']; W0, H0 = ent['size']
    P2 = np.array(ent['pts'])[:468, :2] * [iw / W0 / ds, ih / H0 / ds]
    ids = [i for i in range(468) if str(i) in lm3]; P3 = np.array([lm3[str(i)] for i in ids], float)
    K = np.array([[p['f']/ds, 0, iw/2/ds], [0, p['f']/ds, ih/2/ds], [0, 0, 1]])
    pr, _ = cv2.projectPoints(P3, np.array(p['rvec']), np.array(p['tvec']), K, None); pr = pr[:, 0]
    for k_, i in enumerate(ids):
        a_ = tuple(int(v) for v in P2[i]); b_ = tuple(int(v) for v in pr[k_])
        cv2.line(ctr, a_, b_, (255, 255, 0), 1); cv2.circle(ctr, a_, 1, (0, 255, 0), -1); cv2.circle(ctr, b_, 1, (255, 40, 40), -1)
    e = np.linalg.norm(P2[ids] - pr, axis=1) * ds
    sdm = np.load(f'analise/photo_masks/{name}_sd.npy'); rm = (ra[..., 0] > 0.5).astype(np.uint8)
    cs, _ = cv2.findContours(rm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); cp = np.concatenate(cs)[:, 0]
    yb = np.nonzero(rm.any(1))[0]; cp = cp[cp[:, 1] < yb[0] + 0.75*(yb[-1]-yb[0])]   # sem o quarto inferior (pescoço)
    sil = np.abs(sdm[cp[:, 1], cp[:, 0]]) * ds; M_.append((name, np.median(e), np.median(sil), np.percentile(sil, 90)))
    cv2.putText(ctr, f'lm err med {np.median(e):.0f}px', (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    # recorte na cabeça
    ys, xs = np.nonzero(pm | (ra[..., 0] > 0.5)); y0, y1 = max(ys.min()-10, 0), min(ys.max()+10, h); x0, x1 = max(xs.min()-10, 0), min(xs.max()+10, w)
    y1 = min(y1, y0 + int((x1-x0)*1.6))
    row = np.concatenate([im[y0:y1, x0:x1] for im in (ph, mix, ctr)], 1)
    cols.append(cv2.resize(row, (1500, int(row.shape[0]*1500/row.shape[1]))))
sheet = np.concatenate([np.full((40, 1500, 3), 40, np.uint8)] + cols, 0)
cv2.putText(sheet, f'FOTO | FOTO+CLAY | CONTORNO verde=foto vermelho=malha  -- {label}', (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)
Image.fromarray(sheet).save(outp, quality=88); print("SHEET", outp, sheet.shape)
print("METRICA", label, " ".join(f"{n}: lm {a:.0f} sil {b:.0f}/{c:.0f}" for n, a, b, c in M_), "| media lm %.1f sil %.1f p90 %.1f" % tuple(np.mean([m[1:] for m in M_], 0)))
