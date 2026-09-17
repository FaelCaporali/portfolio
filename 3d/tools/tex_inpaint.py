"""/data/venv-face/bin/python tools/tex_inpaint.py <tex_raw.png> <islands.png> <out.jpg>
Preenche os texels das ilhas UV que o bake não atingiu (magenta/alpha 0) por inpaint (Telea) a partir dos vizinhos."""
import sys, cv2, numpy as np
src, isl, out = sys.argv[1:4]
im = cv2.imread(src, cv2.IMREAD_UNCHANGED); il = cv2.imread(isl, cv2.IMREAD_GRAYSCALE)
rgb = im[..., :3]; a = im[..., 3] if im.shape[2] == 4 else np.full(il.shape, 255, np.uint8)
mag = (rgb[..., 0] < 40) & (rgb[..., 1] < 40) & (rgb[..., 2] > 200)   # BGR: magenta = B alto, G baixo, R alto
mag = (rgb[..., 0] > 200) & (rgb[..., 1] < 40) & (rgb[..., 2] > 200)
hole = ((a < 128) | mag) & (il > 128)
hole = cv2.dilate(hole.astype(np.uint8), np.ones((3, 3), np.uint8))
print("INPAINT texels nas ilhas: %d, furos: %d (%.2f%%)" % ((il > 128).sum(), hole.sum(), 100*hole.sum()/max(1,(il > 128).sum())))
res = cv2.inpaint(np.ascontiguousarray(rgb), hole, 5, cv2.INPAINT_TELEA)
# fora das ilhas: dilatar a cor das bordas (margem) para evitar sangria magenta no mipmap
outside = (il <= 128)
res[outside] = 0
cv2.imwrite(out, res, [cv2.IMWRITE_JPEG_QUALITY, 92]); print("INPAINT salvo", out)
