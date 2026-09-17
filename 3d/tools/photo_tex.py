"""/data/venv-face/bin/python tools/photo_tex.py <geo_prefix> <base_tex.jpg> <islands.png> <out.jpg> <foto:peso> [...]
Textura por projeção multi-vista com separação de frequência: para cada texel das ilhas UV (posição/normal do bake),
projeta nas fotos (PnP), testa visibilidade pelo mapa de profundidade, pesa por ângulo de visão e máscara de rosto
(oval dos landmarks), troca a baixa frequência da foto pela da textura base (mantém cor/sombra da base, detalhe da foto)
e mistura com "vencedor leva quase tudo". Fora das máscaras fica a textura base."""
import os, sys, json, numpy as np
os.environ['OPENCV_IO_ENABLE_OPENEXR'] = '1'
import cv2
geo, base_f, isl_f, out = sys.argv[1:5]; specs = sys.argv[5:]
pos = np.load(geo + "_pos.npy").astype(np.float64); nrm = np.load(geo + "_nrm.npy").astype(np.float64)
base = cv2.imread(base_f).astype(np.float64); il = cv2.imread(isl_f, 0) > 128; S = base.shape[0]
L = json.load(open('analise/landmarks.json'))
oval = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109]
def rod(rv):
    rv = np.array(rv); th = np.linalg.norm(rv); k = rv/th; Kx = np.array([[0,-k[2],k[1]],[k[2],0,-k[0]],[-k[1],k[0],0]]); return np.eye(3)+np.sin(th)*Kx+(1-np.cos(th))*(Kx@Kx)
def nblur(img, m, sig):
    k = int(sig*3)|1; num = cv2.GaussianBlur(img*m[..., None], (k, k), sig); den = cv2.GaussianBlur(m.astype(np.float64), (k, k), sig)
    return num / np.maximum(den, 1e-4)[..., None]
iy, ix = np.nonzero(il); X = pos[iy, ix]; N = nrm[iy, ix]; N /= np.maximum(np.linalg.norm(N, axis=1), 1e-9)[:, None]
acc = np.zeros_like(base); wacc = np.zeros((S, S)); win = np.zeros((S, S), np.int32); cover = np.zeros((S, S))
for si, spec in enumerate(specs):
    name, wq = spec.split(':'); wq = float(wq); p = json.load(open('analise/pnp/%s.json' % name)); R = rod(p['rvec']); t = np.array(p['tvec']); f = p['f']; W, H = p['w'], p['h']
    ph = cv2.imread('referencias/upload-02/%s.jpg' % name).astype(np.float64)
    dep = np.load(geo + "_depth_" + name + ".npy"); ds = W / dep.shape[1]
    ent = L[name + '.jpg']; sw, sh = ent['size']; P2 = np.array(ent['pts'])[:468, :2] * [W / sw, H / sh]
    mask = np.zeros((H, W), np.uint8); cv2.fillPoly(mask, [P2[oval].astype(np.int32)], 255)
    dt = cv2.distanceTransform(mask, cv2.DIST_L2, 5); soft = np.clip(dt / (0.06*H), 0, 1)     # borda suave de 6 % da altura
    Xc = X @ R.T + t; z = Xc[:, 2]; ok = z > 0.05
    u = f*Xc[:, 0]/np.maximum(z, 1e-6) + W/2; v = f*Xc[:, 1]/np.maximum(z, 1e-6) + H/2
    ok &= (u >= 1) & (u < W-2) & (v >= 1) & (v < H-2)
    du, dv = np.clip(u/ds, 0, dep.shape[1]-1), np.clip(v/ds, 0, dep.shape[0]-1); d = dep[dv.astype(int), du.astype(int)]
    r = np.linalg.norm(Xc, axis=1); vis = np.abs(r - d) < 0.015*r + 0.004
    Nc = N @ R.T; cosv = -(Nc * Xc).sum(1) / np.maximum(r, 1e-9); facing = np.clip(cosv, 0, 1)
    m = soft[np.clip(v, 0, H-1).astype(int), np.clip(u, 0, W-1).astype(int)]
    w = np.where(ok & vis, facing**2 * m, 0.0) * wq
    uc, vc = np.clip(u, 0, W-2), np.clip(v, 0, H-2); u0, v0 = uc.astype(int), vc.astype(int); fu, fv = (uc-u0)[:, None], (vc-v0)[:, None]
    col = (ph[v0, u0]*(1-fu)*(1-fv) + ph[v0, u0+1]*fu*(1-fv) + ph[v0+1, u0]*(1-fu)*fv + ph[v0+1, u0+1]*fu*fv)
    P = np.zeros_like(base); M = np.zeros((S, S)); P[iy, ix] = col; M[iy, ix] = (w > 0)
    lowP = nblur(P, M, 60); lowB = nblur(base, M, 60)
    mB = base[M > 0].mean(0); mP = P[M > 0].mean(0); lowPa = lowP * (mB / np.maximum(mP, 1))          # baixa frequência da foto com a cor média da base
    Pd = np.clip(P - lowP + 0.5*lowB + 0.5*lowPa, 0, 255)                                              # metade sombra da base, metade luz (mais uniforme) da foto
    wimg = np.zeros((S, S)); wimg[iy, ix] = w
    wimg = np.minimum(wimg, cv2.GaussianBlur(wimg, (0, 0), 12) * 1.2)     # taper nas bordas de visibilidade/máscara (sem costura dura)
    wp = wimg**6
    acc += Pd * wp[..., None]; wacc += wp; better = wp > cover; win[better] = si + 1; cover = np.maximum(cover, wp)
    print("PHOTO %s: texels visiveis %d (%.1f%% das ilhas), peso medio %.2f" % (name, int((w > 0).sum()), 100*(w > 0).mean(), w[w > 0].mean() if (w > 0).any() else 0), flush=True)
w0 = 0.02**3
res = (acc + base*w0) / (wacc + w0)[..., None]; res[wacc <= 0] = base[wacc <= 0]
cv2.imwrite(out, np.clip(res, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])
pal = np.array([[0,0,0],[0,255,0],[255,0,0],[0,0,255],[255,255,0],[255,0,255],[0,255,255],[128,128,255],[255,128,0]], np.uint8)
cv2.imwrite(out.replace('.jpg', '_win.png'), cv2.resize(pal[win], (1024, 1024), interpolation=cv2.INTER_NEAREST)); print("PHOTO salvo", out)
