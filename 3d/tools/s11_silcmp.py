"""/data/venv-face/bin/python tools/s11_silcmp.py <prefixo_overlay> <saida.jpg> [fotos...]
Contorno da MALHA (verde) e da PESSOA na foto (vermelho, máscara rembg aberta) sobre a foto, pela câmera PnP.
Imprime, por foto, a folga do topo da cabeça em mm (malha - foto; negativo = malha mais baixa) e a largura máxima acima das orelhas."""
import sys, json, cv2, numpy as np
pre, out = sys.argv[1:3]; fotos = sys.argv[3:] or ['ref-15', 'ref-12', 'ref-14', 'ref-11']; tiles = []
for n in fotos:
    ph = cv2.imread(f'referencias/upload-02/{n}.jpg'); ov = cv2.imread(f'{pre}_{n}.png', cv2.IMREAD_UNCHANGED); h, w = ov.shape[:2]; ph = cv2.resize(ph, (w, h))
    mm = (ov[..., 3] > 127).astype(np.uint8); pm = (cv2.resize(cv2.imread(f'analise/photo_masks/{n}.png', 0), (w, h)) > 127).astype(np.uint8)
    pm = cv2.morphologyEx(pm, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    p = json.load(open(f'analise/pnp/{n}.json')); mmpx = 1000*np.linalg.norm(p['tvec'])/(p['f']/(p['w']/w))            # mm por pixel na distância da cabeça
    ys = np.nonzero(mm.any(1))[0]; top_m = ys[0]; top_p = np.nonzero(pm.any(1))[0][0]
    rows = range(top_m, top_m + int(90/mmpx)); wm = max(np.ptp(np.nonzero(mm[r])[0]) for r in rows if mm[r].any()); wp = max(np.ptp(np.nonzero(pm[r])[0]) for r in range(top_p, top_p + int(90/mmpx)) if pm[r].any())
    print("SIL %s: %.2f mm/px | topo malha-foto %+.1f mm | largura max nos 90 mm de cima: malha %.0f mm, foto %.0f mm (%+.0f)" % (n, mmpx, (top_p - top_m)*mmpx, wm*mmpx, wp*mmpx, (wm - wp)*mmpx))
    im = ph.copy()
    for m_, c in ((pm, (0, 0, 255)), (mm, (0, 255, 0))):
        cs, _ = cv2.findContours(m_, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); cv2.drawContours(im, cs, -1, c, 2)
    y0 = max(0, min(top_m, top_p) - 40); im = im[y0:y0 + int(330/mmpx)]; im = cv2.resize(im, (int(im.shape[1]*700/im.shape[0]), 700)); cv2.putText(im, n, (8, 28), 0, 0.9, (0, 255, 255), 2); tiles.append(im)
cv2.imwrite(out, np.hstack(tiles), [cv2.IMWRITE_JPEG_QUALITY, 90])
