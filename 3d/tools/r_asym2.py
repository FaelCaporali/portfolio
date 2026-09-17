"""/data/venv-face/bin/python tools/r_asym2.py <imagem_ou_foto> [...]
Assimetria dos olhos por invariantes que não dependem da inclinação da cabeça na imagem: tudo é medido em relação ao eixo
do rosto (ponto 10 da testa -> ponto 152 do queixo). Mesmo detector para fotos e renders, então o viés do detector cancela.
Imprime por imagem e a média das fotos frontais (guinada pequena)."""
import sys, numpy as np, cv2, mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision
det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path='analise/face_landmarker.task'), num_faces=1, running_mode=vision.RunningMode.IMAGE))
def lm(f):
    im = cv2.imread(f)
    if im is None: return None
    im = im[..., :3]; h, w = im.shape[:2]; r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(im, cv2.COLOR_BGR2RGB)))
    return np.array([[q.x*w, q.y*h] for q in r.face_landmarks[0]]) if r.face_landmarks else None
def metrics(P):
    ax = P[152] - P[10]; ax /= np.linalg.norm(ax); hz = np.array([ax[1], -ax[0]])            # hz aponta para a direita da imagem (lado E dele)
    if hz[0] < 0: hz = -hz
    up = -ax; iod = abs((P[263] - P[33]) @ hz); c = lambda ids: P[ids].mean(0)
    cD, cE = c([33, 133]), c([362, 263]); ang = lambda v: np.degrees(np.arctan2(v @ up, v @ hz))
    return dict(yaw=((P[168]-P[234]) @ hz)/max((P[454]-P[168]) @ hz, 1e-6),
                linha_olhos=ang(cE - cD), altura_D_menos_E=100*((cD - cE) @ up)/iod,
                incl_D=ang(P[133] - P[33]), incl_E=-ang(P[362] - P[263]),                         # positivo = canto externo mais alto que o interno
                abert_D=100*np.linalg.norm(P[159]-P[145])/iod, abert_E=100*np.linalg.norm(P[386]-P[374])/iod,
                larg_D=100*np.linalg.norm(P[33]-P[133])/iod, larg_E=100*np.linalg.norm(P[362]-P[263])/iod,
                sobr_D=100*((P[105]-cD) @ up)/iod, sobr_E=100*((P[334]-cE) @ up)/iod,
                boca=ang(P[291] - P[61]), labio_sup=100*np.linalg.norm(P[0]-P[13])/iod, labio_inf=100*np.linalg.norm(P[14]-P[17])/iod)
rows = []; keys = None
for f in sys.argv[1:]:
    P = lm(f)
    if P is None: print("%-34s sem rosto" % f.split('/')[-1]); continue
    m = metrics(P); keys = keys or list(m); rows.append((f.split('/')[-1], m))
print("%-22s" % "imagem" + "".join("%11s" % k[:10] for k in keys))
for n, m in rows: print("%-22s" % n[:22] + "".join("%11.2f" % m[k] for k in keys))
fr = [m for n, m in rows if n.startswith('ref-') and 0.8 < m['yaw'] < 1.25]
if fr:
    print("%-22s" % ("MEDIA %d frontais" % len(fr)) + "".join("%11.2f" % np.mean([m[k] for m in fr]) for k in keys))
    print("%-22s" % "desvio" + "".join("%11.2f" % np.std([m[k] for m in fr]) for k in keys))
