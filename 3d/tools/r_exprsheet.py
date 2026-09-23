"""$FACE_PYTHON tools/r_exprsheet.py <out_prefix> <folha.jpg>
Monta a folha do portão de expressões: por chave, frente e 3/4, com o veredito medido no rótulo."""
import sys, json, cv2, numpy as np
pre, outf = sys.argv[1:3]; g = json.load(open(pre + '_gate.json'))
def cell(tag, label, okk):
    ims = [cv2.imread(f"{pre}_{tag}_{v}.png") for v in ('f', 'q')]
    im = np.hstack(ims); col = (60, 160, 60) if okk else (40, 40, 220)
    cv2.rectangle(im, (0, 0), (im.shape[1]-1, im.shape[0]-1), col, 6)
    cv2.rectangle(im, (0, 0), (im.shape[1], 34), col, -1)
    cv2.putText(im, label, (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (255, 255, 255), 2); return im
cells = [cell('neutro', 'NEUTRO', True)] + [cell(k, "%s | >3x %d" % (k, v['n3']), v['passa']) for k, v in sorted(g.items(), key=lambda kv: (not kv[1]['passa'], kv[0]))]
cols = 4; rows = []
while len(cells) % cols: cells.append(np.zeros_like(cells[0]))
for i in range(0, len(cells), cols): rows.append(np.hstack(cells[i:i+cols]))
sheet = np.vstack(rows); sheet = cv2.resize(sheet, None, fx=0.6, fy=0.6, interpolation=cv2.INTER_AREA)
cv2.imwrite(outf, sheet, [cv2.IMWRITE_JPEG_QUALITY, 88]); print("FOLHA", outf, sheet.shape)
