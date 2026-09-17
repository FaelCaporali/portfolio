"""/data/venv-face/bin/python tools/r_patch_tex.py <prefix_masks> <bake_prefix> <out.jpg>
Mantém a textura do scan e preenche só o que ele não cobre (texels sem acerto no bake curto, calva cinza do topo,
base abaixo da barba): cor de cabelo ou de barba medida no próprio scan, com fios verticais leves e borda esfumada."""
import sys, numpy as np, cv2
pre, bp, outf = sys.argv[1:4]
tex = cv2.imread(bp + "_tex.jpg").astype(np.float32)/255; S = tex.shape[0]
raw = cv2.imread(bp + "_tex_raw.png", cv2.IMREAD_UNCHANGED); hit = raw[..., 3] > 128
valid = cv2.imread(bp + "_islands.png", 0) > 128
pos = cv2.resize(np.load(pre + "_pos.npy"), (S, S), interpolation=cv2.INTER_NEAREST); x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
cls = cv2.resize(np.load(pre + "_cls.npy"), (S, S), interpolation=cv2.INTER_NEAREST)
hair_c = (cls[..., 2] > cls[..., 0] + 0.2) & hit; beard_c = (cls[..., 0] > cls[..., 2] + 0.2) & (cls[..., 1] < 0.6) & hit
lum = tex @ np.array([0.114, 0.587, 0.299], np.float32); chroma = tex[..., 2] - tex[..., 0]
hmed = np.median(tex[hair_c & (lum < 0.25)], 0); bmed = np.median(tex[beard_c & (lum < 0.2)], 0)
gray_top = valid & (lum > 0.16) & (((z > 0.262) & (y > 0.0)) | ((z > 0.2) & (y > 0.09)))
base = valid & (z < 0.035)
fill = valid & (~hit | gray_top | base)
fill = cv2.morphologyEx(fill.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)) > 0
use_beard = (z < 0.125) & (y < 0.07)
col = np.where(use_beard[..., None], bmed, hmed).astype(np.float32)
rng = np.random.default_rng(7); nz = cv2.GaussianBlur(rng.normal(0, 1, (S, S)).astype(np.float32), (0, 0), sigmaX=0.7, sigmaY=10)
col = np.clip(col*(1 + 0.25*nz[..., None]/nz.std()), 0, 1)
w = cv2.GaussianBlur(fill.astype(np.float32), (0, 0), 4)[..., None]
out = tex*(1 - w) + col*w
import os
if os.path.exists(pre + "_lid.npy"):              # pálpebras: pele ao redor (inpaint), sem o olho pintado do scan
    lidm = cv2.resize(np.load(pre + "_lid.npy")[..., 0], (S, S)) > 0.3
    lidm = cv2.dilate(lidm.astype(np.uint8), np.ones((5, 5), np.uint8))
    u8 = (np.clip(out, 0, 1)*255).astype(np.uint8)
    out = cv2.inpaint(u8, lidm, 9, cv2.INPAINT_TELEA).astype(np.float32)/255
    print("PATCH palpebras repintadas: %d texels" % lidm.sum())
cv2.imwrite(outf, (np.clip(out, 0, 1)*255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])
print("PATCH preenchido %.1f%% das ilhas; cabelo %s barba %s" % (100*fill[valid].mean(), np.round(hmed[::-1]*255), np.round(bmed[::-1]*255)))
