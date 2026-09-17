"""/data/venv-face/bin/python tools/sil_maps.py  -> analise/photo_masks/<foto>_sd.npy
Distância assinada (px, ds=4; >0 fora da pessoa) da máscara da foto aberta (sem fios soltos). Entrada do sil_fit."""
import numpy as np, cv2
for name in ['ref-11', 'ref-12', 'ref-14', 'ref-15']:
    m = (cv2.imread(f'analise/photo_masks/{name}.png', 0) > 127).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    sd = cv2.distanceTransform(1-m, cv2.DIST_L2, 5) - cv2.distanceTransform(m, cv2.DIST_L2, 5)
    np.save(f'analise/photo_masks/{name}_sd.npy', sd.astype(np.float32)); print(name, sd.shape)
