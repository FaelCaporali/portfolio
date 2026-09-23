"""$FACE_PYTHON tools/aud_sheets.py
Folhas foto|S10|S11|S12 pela câmera PnP de cada foto (mesmos pixels), inteira e recortes por região
(olhos, nariz, boca, orelha) definidos pelos landmarks MediaPipe da FOTO. Saída ' + AUD + '/cmp_<foto>_<regiao>.jpg"""
import json, os, cv2, numpy as np, mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision
AUD = os.environ.get('AUD_O', 'analise/aud')
det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path='analise/face_landmarker.task'), num_faces=1))
def lms(im):
    h, w = im.shape[:2]; r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(im, cv2.COLOR_BGR2RGB)))
    return np.array([[q.x*w, q.y*h] for q in r.face_landmarks[0]])[:468] if r.face_landmarks else None
REG = {'olhoD': [33, 133, 159, 145, 46, 55], 'olhoE': [362, 263, 386, 374, 276, 285], 'nariz': [6, 2, 129, 358, 94, 331], 'boca': [61, 291, 0, 17, 164, 200],
       'orelhaD': [234, 227, 93, 132], 'orelhaE': [454, 447, 323, 361]}
for foto in ('ref-15', 'ref-11', 'ref-14', 'ref-12'):
    d = json.load(open(f'{AUD}/lm_{foto}_lm.json')); P = cv2.imread(f'referencias/upload-02/{foto}.jpg')
    R = [cv2.imread(f) for f in d['renders']]; NM = [f.split('busto-')[-1].replace('.png','').upper() for f in d['renders']]; L = lms(P)
    def row(crop, lbl, hgt):
        ims = []
        for im, nm in zip([P] + R, ['foto'] + NM):
            c = crop(im); c = cv2.resize(c, (int(c.shape[1]*hgt/c.shape[0]), hgt), interpolation=cv2.INTER_AREA)
            cv2.putText(c, nm + ' ' + lbl, (8, 28), 0, 0.9, (0, 0, 255), 2); ims.append(c)
        return np.concatenate(ims, 1)
    if L is None: print('sem landmarks', foto); continue
    x0, y0 = L.min(0); x1, y1 = L.max(0); m = 0.25*(y1-y0)
    box = lambda a, b, c, d: (lambda im: im[max(0, int(b)):int(d), max(0, int(a)):int(c)])
    cv2.imwrite(f'{AUD}/cmp_{foto}_rosto.jpg', row(box(x0-m, y0-1.2*m, x1+m, y1+0.6*m), foto, 900), [cv2.IMWRITE_JPEG_QUALITY, 88])
    for k, ids in REG.items():
        q = L[ids]; a, b = q.min(0); c, d_ = q.max(0); w = max(c-a, d_-b); mm = 0.6*w
        if k.startswith('orelha'): mm = 1.2*w; a -= (mm if k == 'orelhaD' else 0); c += (mm if k == 'orelhaE' else 0)
        cv2.imwrite(f'{AUD}/cmp_{foto}_{k}.jpg', row(box(a-mm, b-mm, c+mm, d_+mm), k, 500), [cv2.IMWRITE_JPEG_QUALITY, 88])
    print('ok', foto)
