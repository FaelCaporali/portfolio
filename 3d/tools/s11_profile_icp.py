"""/data/venv-face/bin/python tools/s11_profile_icp.py <overlay_ref-12.png> <saida.jpg>
O PnP da foto de perfil (ref-12) é ruim (36 px). Aqui o contorno da MALHA é alinhado ao da FOTO por similaridade 2D (ICP) usando só
a frente do rosto (testa, nariz: partes confiáveis do scan). Depois de alinhado, mede a folga no topo e atrás da cabeça."""
import sys, cv2, json, numpy as np
ovf, out = sys.argv[1:3]; n = 'ref-12'
ov = cv2.imread(ovf, cv2.IMREAD_UNCHANGED); h, w = ov.shape[:2]; ph = cv2.resize(cv2.imread(f'referencias/upload-02/{n}.jpg'), (w, h))
mm = (ov[..., 3] > 127).astype(np.uint8); pm = (cv2.resize(cv2.imread(f'analise/photo_masks/{n}.png', 0), (w, h)) > 127).astype(np.uint8)
pm = cv2.morphologyEx(pm, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
def contour(m): c, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); return max(c, key=len)[:, 0, :].astype(float)
Cm, Cp = contour(mm), contour(pm)
# dois pontos do contorno que existem nos dois: ponta do nariz (x máximo) e raiz do nariz (x mínimo do contorno frontal entre a testa e a ponta)
def anchors(m):
    hh = m.shape[0]; xr = np.array([np.nonzero(m[y])[0].max() if m[y].any() else -1 for y in range(hh)]); top = np.nonzero(m.any(1))[0][0]
    beard = int(np.argmax(xr)); ny = int(top + np.argmax(xr[top:top + int(0.62*(np.nonzero(m.any(1))[0][-1] - top))]))       # ponta do nariz: x máximo na metade de cima (a barba pode passar do nariz)
    seg = xr[ny - int(0.30*(ny - top)):ny]; ry = ny - int(0.30*(ny - top)) + int(np.argmin(seg)); return np.array([xr[ny], ny], float), np.array([xr[ry], ry], float)
tm_, rm_ = anchors(mm); tp_, rp_ = anchors(pm); vm, vp = tm_ - rm_, tp_ - rp_
S = np.linalg.norm(vp)/np.linalg.norm(vm); ang = np.arctan2(vp[1], vp[0]) - np.arctan2(vm[1], vm[0]); R = np.array([[np.cos(ang), -np.sin(ang)], [np.sin(ang), np.cos(ang)]]); t = tp_ - S*(R @ tm_)
M = S*(Cm @ R.T) + t; res = 0.0
p = json.load(open(f'analise/pnp/{n}.json')); mmpx = 1000*np.linalg.norm(p['tvec'])/(p['f']/(p['w']/w))/S
print("PERFIL por 2 pontos (ponta e raiz do nariz): escala %.3f, rot %.1f graus" % (S, np.degrees(ang)))
# folgas: topo (linha mais alta) e parte de trás em 3 alturas, medidas na foto
mask_m = np.zeros((h, w), np.uint8); cv2.fillPoly(mask_m, [M.astype(np.int32)], 1)
tp, tm = np.nonzero(pm.any(1))[0][0], np.nonzero(mask_m.any(1))[0][0]; print("  topo: malha %+.1f mm em relacao a foto (negativo = malha mais baixa)" % ((tp - tm)*mmpx*S))
nose_p = int(np.argmax([np.nonzero(pm[y])[0].max() if pm[y].any() else -1 for y in range(h)])); H = nose_p - tp
for fr in (0.15, 0.3, 0.45, 0.6):
    y = int(tp + fr*H); bp, bm_ = np.nonzero(pm[y])[0].min(), (np.nonzero(mask_m[y])[0].min() if mask_m[y].any() else -1)
    print("  a %.0f%% da altura topo-nariz: tras da cabeca malha %+.1f mm em relacao a foto (positivo = malha mais para tras)" % (fr*100, (bp - bm_)*mmpx*S))
im = ph.copy(); cv2.drawContours(im, [Cp.astype(np.int32)], -1, (0, 0, 255), 2); cv2.drawContours(im, [M.astype(np.int32)], -1, (0, 255, 0), 2)
cv2.imwrite(out, im[max(0, tp-40):nose_p + int(0.8*H)], [cv2.IMWRITE_JPEG_QUALITY, 90])
