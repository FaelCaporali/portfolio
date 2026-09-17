"""/data/venv-face/bin/python tools/r_eyeseg.py <prefix>
Refina o contorno da abertura palpebral pela TEXTURA do render ortográfico: dentro de uma janela em torno dos pontos do
detector, modela a cor da pele (anel externo, espaço Lab) e marca como abertura o que se afasta dela (esclera, íris,
linha dos cílios). Fica a componente que contém o centro da íris; contorno suavizado e reamostrado em 40 pontos.
Grava <prefix>_seg2d.json e <prefix>_seg.jpg (detector em verde, contorno refinado em amarelo)."""
import sys, json, numpy as np, cv2
pre = sys.argv[1]; K = float(sys.argv[2]) if len(sys.argv) > 2 else 2.6
im = cv2.imread(pre + '_front.png')[..., :3]; P = np.array(json.load(open(pre + '_lm2d.json')))
R = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]; L = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]
lab = cv2.cvtColor(cv2.GaussianBlur(im, (0, 0), 2), cv2.COLOR_BGR2LAB).astype(np.float32)
out = {}; vis = im.copy()
for nm, ids, ic in (('D', R, 468), ('E', L, 473)):
    C = P[ids]; x0, y0 = (C.min(0) - [70, 90]).astype(int); x1, y1 = (C.max(0) + [70, 90]).astype(int)
    poly = np.zeros(im.shape[:2], np.uint8); cv2.fillPoly(poly, [C.astype(np.int32)], 255)
    near = cv2.dilate(poly, np.ones((61, 61), np.uint8)); far = cv2.dilate(poly, np.ones((141, 141), np.uint8))
    ring = (far > 0) & (near == 0); ring[:int(C[:, 1].min()) - 40] = False            # anel de pele, sem a sobrancelha
    mu = lab[ring].mean(0); sd = lab[ring].std(0) + 1e-3
    d = np.sqrt((((lab - mu)/sd)**2).sum(2))
    m = ((d > K) & (near > 0)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)); m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    n, cc = cv2.connectedComponents(m); lab_id = cc[int(P[ic][1]), int(P[ic][0])]
    if lab_id == 0: print("FALHA", nm); continue
    m = (cc == lab_id).astype(np.uint8); m = cv2.GaussianBlur(m*255, (0, 0), 4) > 127
    cs, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); c = max(cs, key=cv2.contourArea)[:, 0, :].astype(np.float32)
    s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(c, axis=0), axis=1))]; t = np.linspace(0, s[-1], 41)[:-1]
    q = np.c_[np.interp(t, s, c[:, 0]), np.interp(t, s, c[:, 1])]; out[nm] = q.tolist()
    cv2.polylines(vis, [C.astype(np.int32)], True, (0, 255, 0), 1); cv2.polylines(vis, [q.astype(np.int32)], True, (0, 255, 255), 2)
    mmpp = 0.26/2400*1000
    print("SEG %s largura %.1f mm altura %.1f mm area %.0f mm2 (detector: %.1f x %.1f)" % (nm, np.ptp(q[:, 0])*mmpp, np.ptp(q[:, 1])*mmpp, cv2.contourArea(q.astype(np.float32))*mmpp**2, np.ptp(C[:, 0])*mmpp, np.ptp(C[:, 1])*mmpp))
json.dump(out, open(pre + '_seg2d.json', 'w'))
A = P[R + L]; x0, y0 = (A.min(0) - [90, 130]).astype(int); x1, y1 = (A.max(0) + [90, 130]).astype(int)
cv2.imwrite(pre + '_seg.jpg', cv2.resize(vis[y0:y1, x0:x1], None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC))
