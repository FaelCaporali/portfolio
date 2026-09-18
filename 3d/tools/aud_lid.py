"""/data/venv-face/bin/python tools/aud_lid.py <foto> <render.png> [...]
Cobertura da íris pelas pálpebras (MediaPipe com íris): para cada olho, (topo da íris - margem superior no centro)/diâmetro da íris
e (margem inferior - fundo da íris)/diâmetro. Positivo = pálpebra cobre a íris. Foto x renders na mesma câmera."""
import sys, cv2, numpy as np, mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision
det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path='analise/face_landmarker.task'), num_faces=1))
def lms(p):
    im = cv2.imread(p)[..., :3]; h, w = im.shape[:2]
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(im, cv2.COLOR_BGR2RGB)))
    return np.array([[q.x*w, q.y*h] for q in r.face_landmarks[0]])
# D dele = imagem esquerda: pálpebras 159 (sup) 145 (inf), íris 468..472 (centro, dir, cima, esq, baixo); E: 386/374, íris 473..477
E = {'D': (159, 145, 468), 'E': (386, 374, 473)}
for p in sys.argv[1:]:
    P = lms(p); out = []
    for k, (up, lo, ic) in E.items():
        c = P[ic]; r = np.linalg.norm(P[ic+1] - P[ic+3])/2   # raio pela largura da íris
        cov_up = (P[up][1] - (c[1] - r))/(2*r); cov_lo = ((c[1] + r) - P[lo][1])/(2*r)
        out.append('%s: sup cobre %+.0f%%  inf cobre %+.0f%%  abertura/iris %.2f' % (k, 100*cov_up, 100*cov_lo, (P[lo][1]-P[up][1])/(2*r)))
    print(p.split('/')[-1][:24].ljust(24), ' | '.join(out))
