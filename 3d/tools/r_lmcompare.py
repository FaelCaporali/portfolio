"""$FACE_PYTHON tools/r_lmcompare.py <prefix_lm.json>
Detecta os pontos faciais na foto e em cada render (mesmo detector, mesma câmera), alinha por Procrustes de
similaridade nos pontos estáveis (olhos, raiz e base do nariz) e compara medidas normalizadas pela interocular.
Imprime, por medida, o valor da foto e o de cada malha, e o erro em porcentagem."""
import sys, json, numpy as np, cv2, mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision
A = 'analise'
d = json.load(open(sys.argv[1])); foto = d['foto']
opts = vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path=f'{A}/face_landmarker.task'), num_faces=1, running_mode=vision.RunningMode.IMAGE)
det = vision.FaceLandmarker.create_from_options(opts)
def lms(path):
    im = cv2.imread(path)
    if im is None: return None
    if im.shape[2] == 4: im = im[..., :3]
    h, w = im.shape[:2]
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(im, cv2.COLOR_BGR2RGB)))
    if not r.face_landmarks: return None
    return np.array([[q.x*w, q.y*h] for q in r.face_landmarks[0]])[:468]
P = lms(f'referencias/upload-02/{foto}.jpg')
STAB = [33, 133, 362, 263, 168, 6, 197, 195, 5, 4, 1, 234, 454]
def align(Q, P):
    A_, B_ = Q[STAB], P[STAB]
    ca, cb = A_.mean(0), B_.mean(0); A0, B0 = A_-ca, B_-cb
    U, S, Vt = np.linalg.svd(B0.T @ A0); R = U @ Vt
    s = S.sum()/(A0**2).sum()
    return (s*(Q-ca) @ R.T) + cb
MED = {
 'boca largura': (61, 291), 'labio sup espessura': (0, 13), 'labio inf espessura': (14, 17),
 'boca altura': (0, 17), 'nariz largura': (129, 358), 'nariz altura': (168, 2),
 'olho D abertura': (159, 145), 'olho E abertura': (386, 374), 'olho D largura': (33, 133), 'olho E largura': (362, 263),
 'sobrancelhas dist': (55, 285), 'rosto largura': (234, 454), 'rosto altura': (10, 152),
 'boca-queixo': (17, 152), 'nariz-boca': (2, 0),
}
def dist(Q, ab): return float(np.linalg.norm(Q[ab[0]] - Q[ab[1]]))
iod_p = dist(P, (33, 263))
rows = []
names = []
for r in d['renders']:
    Q = lms(r)
    names.append(r.split('/')[-1])
    if Q is None: rows.append(None); continue
    rows.append((align(Q, P), dist(Q, (33, 263))))
print("MEDIDA".ljust(22), "foto".rjust(7), *[n[:18].rjust(20) for n in names])
for k, ab in MED.items():
    vp = dist(P, ab)/iod_p*100
    line = k.ljust(22) + ("%7.1f" % vp)
    for r in rows:
        if r is None: line += "        (sem deteccao)"; continue
        Q, iod = r; vq = dist(Q, ab)/iod*100
        line += "  %8.1f (%+5.1f%%)" % (vq, 100*(vq-vp)/max(vp, 1e-6))
    print(line)
# erro geométrico por região depois do alinhamento (px normalizados pela interocular)
REG = {'boca': list(range(61, 88)) + [0, 13, 14, 17, 61, 291, 308, 78], 'olhos': [33,133,159,145,362,263,386,374,157,158,160,161,384,385,387,388],
       'nariz': [1, 2, 4, 5, 6, 19, 94, 97, 326, 129, 358, 168], 'oval': [10, 152, 234, 454, 172, 397, 132, 361, 58, 288]}
for r, n in zip(rows, names):
    if r is None: continue
    Q, _ = r; msg = []
    for k, ids in REG.items():
        e = np.linalg.norm(Q[ids] - P[ids], axis=1).mean()/iod_p*100
        msg.append("%s %.1f%%" % (k, e))
    print("ERRO MEDIO (%% da interocular) %s: %s" % (n, ", ".join(msg)))
