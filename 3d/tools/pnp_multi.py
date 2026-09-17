"""/data/venv-face/bin/python tools/pnp_multi.py <lm3d.json> <foto1.jpg> [foto2.jpg ...]
Pose da câmera (PnP com varredura de focal) de cada foto de referência em relação à malha, usando os landmarks 3D
no referencial do modelo (lm3d) e os 2D de analise/landmarks.json (reescalados para a foto original).
Saída: analise/pnp/<foto>.json {f, rvec, tvec, w, h, err_px}."""
import json, sys, os, numpy as np, cv2
from PIL import Image
lm3 = json.load(open(sys.argv[1])); L = json.load(open('analise/landmarks.json'))
eye = {33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398}
for name in sys.argv[2:]:
    ent = L[name]; W, H = ent['size']; iw, ih = Image.open('referencias/upload-02/' + name).size
    P2 = np.array(ent['pts'])[:468, :2] * [iw / W, ih / H]
    ids = [i for i in range(468) if str(i) in lm3 and i not in eye]
    obj = np.array([lm3[str(i)] for i in ids], np.float64); img = np.array([P2[i] for i in ids], np.float64); best = None
    ex = Image.open('referencias/upload-02/' + name).getexif(); f35 = ex.get_ifd(0x8769).get(41989) if hasattr(ex, 'get_ifd') else None
    focals = [f35/36.0*max(iw, ih)] if f35 else np.linspace(0.6*max(iw, ih), 2.0*max(iw, ih), 57)   # focal do EXIF (35 mm eq.) ou varredura
    for f in focals:
        K = np.array([[f, 0, iw/2], [0, f, ih/2], [0, 0, 1]])
        ok, rvec, tvec, inl = cv2.solvePnPRansac(obj, img, K, None, reprojectionError=0.006*ih, flags=cv2.SOLVEPNP_ITERATIVE)
        if not ok or inl is None or len(inl) < 30: continue
        ok, rvec, tvec = cv2.solvePnP(obj[inl[:,0]], img[inl[:,0]], K, None, rvec, tvec, useExtrinsicGuess=True, flags=cv2.SOLVEPNP_ITERATIVE)
        proj, _ = cv2.projectPoints(obj, rvec, tvec, K, None); err = np.sqrt(((proj[:,0,:] - img)**2).sum(1)); med = float(np.median(err))
        if best is None or med < best[0]: best = (med, float(f), rvec.ravel().tolist(), tvec.ravel().tolist(), int(len(inl)))
    med, f, rvec, tvec, ninl = best
    print("PNP %s focal=%.0f px (%s) erro mediano=%.1f px (%.2f%% da altura) inliers=%d/%d" % (name, f, 'EXIF' if f35 else 'varredura', med, 100*med/ih, ninl, len(ids)))
    json.dump({'f': f, 'rvec': rvec, 'tvec': tvec, 'w': iw, 'h': ih, 'err_px': med}, open('analise/pnp/%s.json' % name.replace('.jpg', ''), 'w'))
