"""Compara duas silhuetas nos mesmos pixels (site × Blender): IoU, distância entre contornos e imagem de sobreposição.

Uso: /data/venv-face/bin/python 3d/tools/props/compara_mascaras.py <pasta> <prefixo do site> [telas...]
Lê <pasta>/<prefixo>-<tela>-busto.png (máscara do site) e <pasta>/camera/blender-<tela>-busto.png; grava
<pasta>/camera/sobreposicao-<tela>.png (preto = os dois, vermelho = só o site, azul = só o Blender) e
<pasta>/camera/contorno-<tela>.png (contorno do Blender em verde sobre a captura do site) e imprime as medidas.
Critério da prova: IoU ≥ 0,99 e 99% do contorno a ≤ 1,5 px. A distância máxima é só informativa: pixel isolado de
regra de rasterização (three.js × Workbench) na borda vira ilha de contorno de 1 px e infla o máximo (visto na 360×740).
"""

import json
import os
import sys

import cv2
import numpy as np

pasta, prefixo = sys.argv[1], sys.argv[2]
telas = sys.argv[3:] or ['1440x900', '1024x768', '360x740']
res = {}
for tela in telas:
    site = cv2.imread(os.path.join(pasta, f'{prefixo}-{tela}-busto.png'), cv2.IMREAD_GRAYSCALE) < 128
    bl = cv2.imread(os.path.join(pasta, 'camera', f'blender-{tela}-busto.png'), cv2.IMREAD_GRAYSCALE) < 128
    if site.shape != bl.shape:
        raise SystemExit(f'{tela}: tamanhos diferentes {site.shape} × {bl.shape}')
    inter = np.logical_and(site, bl).sum()
    uniao = np.logical_or(site, bl).sum()
    borda = lambda m: cv2.Canny(m.astype(np.uint8) * 255, 50, 150) > 0  # noqa: E731
    bs, bb = borda(site), borda(bl)
    dist_site = cv2.distanceTransform((~bs).astype(np.uint8), cv2.DIST_L2, 5)
    dist_bl = cv2.distanceTransform((~bb).astype(np.uint8), cv2.DIST_L2, 5)
    d = np.concatenate([dist_site[bb], dist_bl[bs]])
    res[tela] = {
        'iou': round(float(inter / uniao), 4),
        'pxSoSite': int(np.logical_and(site, ~bl).sum()),
        'pxSoBlender': int(np.logical_and(bl, ~site).sum()),
        'contornoMedioPx': round(float(d.mean()), 2),
        'contornoP99Px': round(float(np.percentile(d, 99)), 2),
        'contornoMaxPx': round(float(d.max()), 2),
    }
    img = np.full(site.shape + (3,), 255, np.uint8)
    img[np.logical_and(site, bl)] = (0, 0, 0)
    img[np.logical_and(site, ~bl)] = (0, 0, 255)
    img[np.logical_and(bl, ~site)] = (255, 0, 0)
    cv2.imwrite(os.path.join(pasta, 'camera', f'sobreposicao-{tela}.png'), img)
    cap = cv2.imread(os.path.join(pasta, f'{prefixo}-{tela}-captura.png'))
    if cap is not None:
        cap = cv2.resize(cap, (site.shape[1], site.shape[0]), interpolation=cv2.INTER_AREA)
        cap[bb] = (0, 255, 0)
        cv2.imwrite(os.path.join(pasta, 'camera', f'contorno-{tela}.png'), cap)
    ok = res[tela]['iou'] >= 0.99 and res[tela]['contornoP99Px'] <= 1.5
    res[tela]['prova'] = 'PASSA' if ok else 'REPROVA'
print(json.dumps(res, indent=2, ensure_ascii=False))
with open(os.path.join(pasta, 'camera', 'prova-camera.json'), 'w', encoding='utf-8') as f:
    json.dump(res, f, indent=2, ensure_ascii=False)
