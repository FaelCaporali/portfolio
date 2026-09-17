"""/data/venv-face/bin/python tools/r_style_tex.py <prefix_masks> <baked_tex.jpg> <out.jpg>
Textura estilizada ("lúdica", uniforme) na UV limpa:
  - rótulos por texel: classes do alvo (pele/cabelo/barba) + posição 3D para o que o scan não cobre
    (nuca e topo = cabelo; base abaixo da barba = barba); rótulos alisados e bordas esfumadas;
  - pele: textura do scan com filtro que preserva bordas e sombra assada nivelada (luminância dividida pela
    baixa frequência), mantendo olhos, sobrancelhas, lábios e narinas;
  - cabelo e barba: cor média medida no próprio scan, variação só de baixa frequência (grisalho do queixo),
    leve textura de fios na direção vertical."""
import sys, numpy as np, cv2
pre, texf, outf = sys.argv[1:4]
tex = cv2.imread(texf).astype(np.float32)/255; S = tex.shape[0]
cls = np.load(pre + "_cls.npy"); pos = np.load(pre + "_pos.npy")
cls = cv2.resize(cls, (S, S), interpolation=cv2.INTER_NEAREST); pos = cv2.resize(pos, (S, S), interpolation=cv2.INTER_NEAREST)
isl = cv2.imread(sys.argv[4] if len(sys.argv) > 4 else texf.replace('_tex.jpg', '_islands.png'), 0)
valid = cv2.resize(isl, (S, S), interpolation=cv2.INTER_NEAREST) > 128
x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
hit = cls[..., 3] > 0.5
lab = np.zeros((S, S), np.uint8)                                   # 0 pele, 1 cabelo, 2 barba
lab[hit & (cls[..., 2] > cls[..., 0] + 0.2)] = 1                   # azul = cabelo (cores em sRGB após o bake)
lab[hit & (cls[..., 0] > cls[..., 2] + 0.2) & (cls[..., 1] < 0.6)] = 2   # vermelho = barba
lab[valid & (y > 0.05) & (z > 0.13)] = 1                           # nuca/topo atrás: cabelo
lab[valid & (z > 0.24) & (y > -0.03)] = 1                          # topo (calva cinza do scan)
lab[valid & (z < 0.045) & (y < 0.06)] = 2                          # base sob a barba
lab[valid & (z < 0.13) & (y > 0.10)] = 1                           # nuca baixa: cabelo preso caindo
# alisa rótulos (voto em janela) e esfuma
oh = np.stack([(lab == k).astype(np.float32) for k in range(3)], 2)
oh = cv2.GaussianBlur(oh, (0, 0), 6); lab = oh.argmax(2)
w = cv2.GaussianBlur(np.stack([(lab == k).astype(np.float32) for k in range(3)], 2), (0, 0), 3)
# pele: bilateral + nivelamento de sombra
lum = tex @ np.array([0.114, 0.587, 0.299], np.float32)
skin_m = (lab == 0) & valid
low = cv2.GaussianBlur(np.where(skin_m, lum, 0), (0, 0), 40); nrm = cv2.GaussianBlur(skin_m.astype(np.float32), (0, 0), 40)
low = low/np.maximum(nrm, 1e-3); target = np.median(lum[skin_m])
gain = np.clip((0.55*target + 0.45*low)/np.maximum(low, 1e-3), 0.85, 1.35)
sk = cv2.bilateralFilter((tex*255).astype(np.uint8), 9, 40, 7).astype(np.float32)/255
sk = cv2.bilateralFilter((sk*255).astype(np.uint8), 9, 30, 7).astype(np.float32)/255
sk = np.clip(sk*gain[..., None], 0, 1)
def flat(mask, sigma, keep_low):
    med = np.median(tex[mask & valid], 0)
    lo = cv2.GaussianBlur(np.where(mask[..., None], tex, 0), (0, 0), sigma)/np.maximum(cv2.GaussianBlur(mask.astype(np.float32), (0, 0), sigma), 1e-3)[..., None]
    return med*(1 - keep_low) + lo*keep_low, med
hair, hmed = flat(lab == 1, 60, 0.25); beard, bmed = flat(lab == 2, 25, 0.6)
rng = np.random.default_rng(7); nz = rng.normal(0, 1, (S, S)).astype(np.float32)
strands = cv2.GaussianBlur(nz, (1, 0), sigmaX=0.6, sigmaY=9)                   # fios verticais finos
strands = strands/strands.std()*0.035
hair = np.clip(hair*(1 + strands[..., None]), 0, 1); beard = np.clip(beard*(1 + 1.3*strands[..., None]), 0, 1)
out = w[..., :1]*sk + w[..., 1:2]*hair + w[..., 2:3]*beard
out[~valid] = tex[~valid]
cv2.imwrite(outf, (np.clip(out, 0, 1)*255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])
print("STYLE pele %.0f%% cabelo %.0f%% barba %.0f%%; cor cabelo %s barba %s" % (100*(lab[valid] == 0).mean(), 100*(lab[valid] == 1).mean(), 100*(lab[valid] == 2).mean(), np.round(hmed[::-1]*255), np.round(bmed[::-1]*255)))
