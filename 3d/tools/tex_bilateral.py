"""venv: python tools/tex_bilateral.py <in.jpg> <out.jpg> [d=9] — bilateral só nas regiões escuras (cabelo/barba)."""
import sys, cv2, numpy as np
im = cv2.imread(sys.argv[1]); d = int(sys.argv[3]) if len(sys.argv) > 3 else 9
f = cv2.bilateralFilter(im, d, 45, 7)
m = (im.mean(2) < 0.30*255).astype(np.float32); m = cv2.GaussianBlur(m, (0, 0), 6)[..., None]
cv2.imwrite(sys.argv[2], (f*m + im*(1-m)).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 95]); print("TEX ok", im.shape)
