"""/data/venv-face/bin/python tools/aud_iris.py <img> [...]   Fração VISÍVEL da íris por pixel: disco escuro em volta do centro da íris
(MediaPipe só para achar o centro); altura visível / largura do disco. Foto e renders na mesma câmera. 1,00 = íris inteira à mostra."""
import sys, cv2, numpy as np, mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision
det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path='analise/face_landmarker.task'), num_faces=1))
for p in sys.argv[1:]:
    im = cv2.imread(p)[..., :3]; h, w = im.shape[:2]
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(im, cv2.COLOR_BGR2RGB)))
    P = np.array([[q.x*w, q.y*h] for q in r.face_landmarks[0]]); g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY); out = []
    for k, ic in (('D', 468), ('E', 473)):
        cx, cy = P[ic].astype(int); rr = int(np.linalg.norm(P[ic+1] - P[ic+3]))   # ~diâmetro
        win = g[cy-rr:cy+rr, cx-rr:cx+rr]; thr = np.percentile(win, 12)               # 12% mais escuros = íris/pupila
        m = (win < thr).astype(np.uint8); n, lab, st, _ = cv2.connectedComponentsWithStats(m)
        i = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]); x, y, ww, hh = st[i, :4]
        out.append('%s: visível %.2f (alt %d / larg %d px) topo cortado %+d px' % (k, hh/ww, hh, ww, (cy - y) - ww//2 if False else ww - hh))
    print(p.split('/')[-1][:24].ljust(24), ' | '.join(out))
