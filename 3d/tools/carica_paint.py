"""/data/venv-face/bin/python tools/carica_paint.py <tex_base.png> <islands.png> <pos.npy> <lm3d_base.json> <out.jpg> [config.json]
Textura CARTOON por regiões (não por filtro): pele chapada (mediana da pele da foto + 15 % da foto borrada), cabelo, barba e
sobrancelhas como massas de cor sólida (máscara de escuridão da foto, limpa por borrão + limiar), lábios levemente
avermelhados, olhos como pele (os globos são geometria). Regiões definidas por posição 3D (atlas pos.npy) e landmarks."""
import sys, json, numpy as np, cv2
src, islf, posf, lmf, out = sys.argv[1:6]; cfg = json.load(open(sys.argv[6])) if len(sys.argv) > 6 else {}
im = cv2.imread(src, cv2.IMREAD_UNCHANGED); P = np.load(posf); lm = json.load(open(lmf))
S = im.shape[0]
if P.shape[0] != S: P = cv2.resize(P, (S, S), interpolation=cv2.INTER_NEAREST)
il = (np.linalg.norm(P, axis=2) > 1e-6) if islf == 'auto' else (cv2.imread(islf, 0) > 128)
rgb = im[..., :3]; lab = cv2.cvtColor(rgb, cv2.COLOR_BGR2LAB).astype(np.float32); L = lab[..., 0]; A = lab[..., 1]
g = lambda k: np.array(lm[str(k)])
eyes = [g(468), g(473)] if '468' in lm else [g(33), g(263)]; nose = g(1); mouth = (g(13) + g(14)) / 2
d = lambda c: np.linalg.norm(P - c[None, None, :], axis=2)
deye = np.minimum(d(eyes[0]), d(eyes[1])); z = P[..., 2]; x = P[..., 0]; y = P[..., 1]
zeye = (eyes[0][2] + eyes[1][2]) / 2
Lb = cv2.GaussianBlur(L, (0, 0), 3)
dark = (Lb < cfg.get('dark_L', 105)) & il
eye_zone = (deye < 0.05) & (z < zeye + 0.015)                # olho, cílios, olheira: nunca cabelo
brow_zone = (deye < 0.045) & (z > zeye + 0.016) & (z < zeye + 0.028) & (np.abs(x) > 0.016)
nose_zone = d(nose) < 0.016; mouth_zone = d(mouth) < cfg.get('mouth_r', 0.015)
ear_box = (np.abs(x) > 0.055) & (y > -0.015) & (z > 0.12) & (z < 0.21)
hair = dark & ~eye_zone & ~nose_zone & ~mouth_zone & (z > cfg.get('zmin', 0.035))
hair[ear_box] = False
hair |= il & (z > zeye + cfg.get('top', 0.085)) & ~ear_box                     # topo da cabeça: sempre cabelo
hair = cv2.morphologyEx(hair.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (81, 81)))   # reflexos no topo
ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)); hair = cv2.morphologyEx(hair, cv2.MORPH_OPEN, ker).astype(bool)   # pintas/ruído fora
brow = brow_zone & (Lb < cfg.get('brow_L', 105)); brow = cv2.morphologyEx(brow.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
brow = cv2.dilate(brow, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))).astype(bool)
hair = hair | brow
hm = cv2.GaussianBlur(hair.astype(np.float32), (0, 0), cfg.get('hair_blur', 9)); hair_m = np.clip((hm - 0.42) * 8, 0, 1)   # borda limpa, quase binária
if cfg.get('vdata'):
    # --- classificação em 3D por vértice (atlas picado em ilhas: borrar em UV vaza entre ilhas)
    from scipy.spatial import cKDTree
    Dv = np.load(cfg['vdata']); V = Dv['V']; E = Dv['E']; lumv = Dv['lum'] * 255; nv = len(V); nbv = [[] for _ in range(nv)]
    for a_, b_ in E: nbv[a_].append(b_); nbv[b_].append(a_)
    def gsm(a, it):
        for _ in range(it): a = 0.5 * a + 0.5 * np.array([a[k].mean(0) if k else a[i] for i, k in enumerate(nbv)])
        return a
    def gdil(m, it):
        for _ in range(it): m = np.array([m[i] or any(m[k] for k in nbv[i]) for i in range(nv)])
        return m
    def gero(m, it):
        for _ in range(it): m = np.array([m[i] and all(m[k] for k in nbv[i]) for i in range(nv)])
        return m
    dv = lambda c: np.linalg.norm(V - c[None], axis=1)
    deye_v = np.minimum(dv(eyes[0]), dv(eyes[1])); zv = V[:, 2]; xv = V[:, 0]; yv = V[:, 1]; lsm = gsm(lumv.copy(), 2)
    dark_v = lsm < cfg.get('dark_L', 105)
    eye_v = (deye_v < 0.05) & (zv < zeye + 0.015); brow_v = (deye_v < 0.045) & (zv > zeye + 0.016) & (zv < zeye + 0.028) & (np.abs(xv) > 0.016)
    nose_v = dv(nose) < cfg.get('nose_r', 0.012); mouth_v = dv(mouth) < cfg.get('mouth_r', 0.015); eo = np.array(cfg.get('ear_off', [0, 0.028, 0.008])); earL, earR = g(234) + eo * [-1, 1, 1], g(454) + eo; er = cfg.get('ear_r', 0.038)
    ear_v = (dv(earL) < er) | (dv(earR) < er)   # orelhas: landmarks 234/454 do oval deslocados para trás/cima
    hair_v = dark_v & ~eye_v & ~nose_v & ~mouth_v & (zv > cfg.get('zmin', 0.035)); hair_v[ear_v] = False
    hair_v |= (zv > zeye + cfg.get('top', 0.085)) & ~ear_v
    hair_v |= (yv > cfg.get('yback', 0.10)) & (zv > cfg.get('zback', 0.09)) & ~ear_v          # nuca e coque: sempre cabelo
    hair_v = gero(gdil(hair_v, cfg.get('close_it', 2)), cfg.get('close_it', 2)); hair_v = gdil(gero(hair_v, cfg.get('open_it', 1)), cfg.get('open_it', 1))
    brow_v = gdil(brow_v & (lsm < cfg.get('brow_L', 105)), 1); hair_v = hair_v | brow_v
    hv = gsm(hair_v.astype(np.float32), cfg.get('hair_smooth', 2))
    tree = cKDTree(V); idx = tree.query(P[il])[1]; hair_m = np.zeros((S, S), np.float32); hair_m[il] = hv[idx]; hair_m = cv2.GaussianBlur(hair_m, (0, 0), cfg.get('uv_blur', 2.5)); hair_m = np.clip((hair_m - 0.45) * 6, 0, 1); hair_m[~il] = 0
    hair = hair_m > 0.5; print("PAINT 3D: vertices cabelo/barba %d de %d" % (int(hair_v.sum()), nv))
skin_sel = il & ~dark & ~hair & ~eye_zone & ~mouth_zone & (deye < 0.09)
if cfg.get('vdata'): skin_sel = il & ~hair & ~eye_zone & ~mouth_zone & (deye < 0.09) & (Lb > 90) & (im[..., 3] > 128 if im.shape[2] == 4 else True)
skin_lab = np.median(lab[skin_sel], axis=0); print("PAINT pele Lab mediana", skin_lab.round(1), "texels", int(skin_sel.sum()))
skin_lab = skin_lab + np.array(cfg.get('skin_shift', [8, 2, 4]), np.float32)          # um pouco mais clara e quente
flat = np.empty_like(lab); flat[...] = skin_lab
blur = cv2.GaussianBlur(lab, (0, 0), 25); k = cfg.get('photo_mix', 0.06)
skin = (1 - k) * flat + k * (blur - np.median(blur[skin_sel], axis=0) + skin_lab)
lips = il & (d(mouth) < cfg.get('lip_fill_r', 0.012)) & (z < mouth[2] - 0.001) & (z > mouth[2] - cfg.get('lip_h', 0.009))   # só o lábio inferior, como crescente
lm_ = cv2.GaussianBlur(lips.astype(np.float32), (0, 0), 4); lm_ = np.clip((lm_ - 0.4) * 6, 0, 1)
lip_lab = skin_lab + np.array(cfg.get('lip_shift', [-8, 7, 2]), np.float32)
hair_lab = np.array(cfg.get('hair_lab', [26, 133, 136]), np.float32)
res = skin * (1 - lm_[..., None]) + lip_lab * lm_[..., None]
res = res * (1 - hair_m[..., None]) + hair_lab * hair_m[..., None]
# linhas desenhadas: texels muito escuros da foto dentro das zonas de olho (cílios/linha da pálpebra), narinas e boca
line_zone = (d(nose) < 0.02) | (d(mouth) < 0.03)
line = line_zone & il & (Lb < cfg.get('line_L', 58))
line = cv2.morphologyEx(line.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))).astype(bool)
lnm = cv2.GaussianBlur(line.astype(np.float32), (0, 0), 3); lnm = np.clip((lnm - 0.3) * 4, 0, 1) * (1 - hair_m)
res = res * (1 - lnm[..., None]) + np.array(cfg.get('line_lab', [22, 132, 134]), np.float32) * lnm[..., None]
res[~il] = skin_lab
if cfg.get('eyes_painted'):
    # olhos desenhados sobre a superfície do scan: contorno MediaPipe -> polígono em 3D projetado no plano do olho; íris nos landmarks 468/473
    RING = {'L': [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7], 'R': [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249]}
    IR = {'L': 468, 'R': 473}; eye_m = np.zeros((S, S), np.float32); iris_m = np.zeros((S, S), np.float32); pup_m = np.zeros((S, S), np.float32); lash_m = np.zeros((S, S), np.float32)
    for side in ('L', 'R'):
        ring = np.array([g(i) for i in RING[side]]); c = ring.mean(0); u_, s_, vt = np.linalg.svd(ring - c); ex, ey = vt[0], vt[1]     # plano do olho
        R2 = np.stack([(ring - c) @ ex, (ring - c) @ ey], 1) * cfg.get('eye_scale', 1.25)                                                    # abertura um pouco maior (cartoon)
        near = d(c) < 0.03; Q = P[near] - c; q2 = np.stack([Q @ ex, Q @ ey], 1)
        import matplotlib.path as mpath; inside = mpath.Path(R2).contains_points(q2)
        m = np.zeros(near.sum(), np.float32); m[inside] = 1; eye_m[near] = m
        ic = g(IR[side]); iris_m[near] = (np.linalg.norm(Q - (ic - c), axis=1) < cfg.get('iris_r', 0.0058)) * m; pup_m[near] = (np.linalg.norm(Q - (ic - c), axis=1) < cfg.get('pupil_r', 0.0028)) * m
        up = ring[:9]; upd = np.min(np.linalg.norm(P[near][:, None, :] - up[None], axis=2), axis=1); lash_m[near] = ((upd < 0.0022) & (q2[:, 1] > 0)) * 1.0
    sm = lambda a, k: cv2.GaussianBlur(a, (0, 0), k)
    eye_m = np.clip((sm(eye_m, 1.5) - 0.5) * 6, 0, 1); iris_m = np.clip((sm(iris_m, 1.2) - 0.5) * 6, 0, 1); pup_m = np.clip((sm(pup_m, 1.0) - 0.5) * 6, 0, 1); lash_m = np.clip((sm(lash_m, 1.5) - 0.4) * 6, 0, 1)
    for mk, col in ((eye_m, [236, 128, 130]), (iris_m, cfg.get('iris_lab', [42, 140, 150])), (pup_m, [10, 128, 128]), (lash_m, [18, 130, 132])):
        res = res * (1 - mk[..., None]) + np.array(col, np.float32) * mk[..., None]
    print("PAINT olhos pintados: esclera %d, iris %d texels" % ((eye_m > 0.5).sum(), (iris_m > 0.5).sum()))
outbgr = cv2.cvtColor(np.clip(res, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
cv2.imwrite(out, outbgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
dbg = np.zeros((S, S, 3), np.uint8); dbg[..., 2] = (hair_m * 255).astype(np.uint8); dbg[..., 1] = (lm_ * 255).astype(np.uint8); dbg[..., 0] = (eye_zone * 255).astype(np.uint8)
cv2.imwrite(out.replace('.jpg', '_mask.png'), cv2.resize(dbg, (1024, 1024)))
print("PAINT salvo", out, "cabelo/barba %.1f %% das ilhas, labios %.2f %%" % (100 * (hair_m > 0.5)[il].mean(), 100 * (lm_ > 0.5)[il].mean()))
