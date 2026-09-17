"""Prova cruzada do contorno das pálpebras: pontos do detector na FOTO, lançados no scan pela câmera PnP da foto,
contra os mesmos pontos detectados no render ortográfico do scan (tools/r_eyecontour.py).
  /data/venv-face/bin/python tools/r_eyecross.py detect <foto>            -> analise/gate/olhos_foto_<foto>.json
  blender -b --python tools/r_eyecross.py -- cast <in.blend> <foto> <prefix>"""
import sys, json, os
R = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]; L = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]
if 'detect' in sys.argv:
    import cv2, mediapipe as mp
    from mediapipe.tasks import python as mpp
    from mediapipe.tasks.python import vision
    foto = sys.argv[sys.argv.index('detect')+1]
    det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path='analise/face_landmarker.task'), num_faces=1, running_mode=vision.RunningMode.IMAGE))
    im = cv2.imread(f'referencias/upload-02/{foto}.jpg'); h, w = im.shape[:2]
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(im, cv2.COLOR_BGR2RGB)))
    P = [[q.x*w, q.y*h] for q in r.face_landmarks[0]]; json.dump(dict(w=w, h=h, P=P), open(f'analise/gate/olhos_foto_{foto}.json', 'w')); print("FOTO", w, h, len(P)); sys.exit()
import bpy, math, numpy as np
from mathutils import Vector
a = sys.argv[sys.argv.index("--")+1:]; src, foto, pre = a[1:4]
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(src)); o = bpy.data.objects['Busto']; ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
p = json.load(open(f'analise/pnp/{foto}.json')); D = json.load(open(f'analise/gate/olhos_foto_{foto}.json')); P = D['P']
sx, sy = p['w']/D['w'], p['h']/D['h']
rv = np.array(p['rvec']); th = np.linalg.norm(rv); k = rv/th; K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
Rm = np.eye(3) + math.sin(th)*K + (1-math.cos(th))*(K @ K); t = np.array(p['tvec']); C = -Rm.T @ t
cx, cy = p.get('cx', p['w']/2), p.get('cy', p['h']/2)
def cast(u, v):
    d = Rm.T @ np.array([(u*sx - cx)/p['f'], (v*sy - cy)/p['f'], 1.0]); d /= np.linalg.norm(d)
    ok, loc, n, fi = ev.ray_cast(Vector(C.tolist()), Vector(d.tolist())); return np.array(loc) if ok else np.full(3, np.nan)
O = json.load(open(pre + '_eyes3d.json'))
for s, ids in (('D', R), ('E', L)):
    A = np.array([cast(*P[i]) for i in ids])*1000; B = np.array(O[s])*1000; e = A - B
    print("CRUZ %s  erro medio %.1f mm  max %.1f mm | vies x %+.1f z %+.1f | foto: largura %.1f abertura %.1f | scan: largura %.1f abertura %.1f" % (
        s, np.linalg.norm(e[:, [0, 2]], axis=1).mean(), np.linalg.norm(e[:, [0, 2]], axis=1).max(), e[:, 0].mean(), e[:, 2].mean(),
        np.linalg.norm(A[0]-A[8]), np.linalg.norm(A[12]-A[4]), np.linalg.norm(B[0]-B[8]), np.linalg.norm(B[12]-B[4])))
