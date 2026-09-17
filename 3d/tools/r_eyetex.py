"""/data/venv-face/bin/python tools/r_eyetex.py <out.png> [raio_iris_mm=7.2] [raio_globo_mm=13.6]
Textura do olho (equiretangular, polo norte = frente): esclera, íris com estrias e anel límbico, pupila.
Cor medida na foto ref-15; a íris fica centrada no eixo do olhar (para a frente)."""
import sys, numpy as np, cv2
out = sys.argv[1]; r_iris = float(sys.argv[2]) if len(sys.argv) > 2 else 7.2; R = float(sys.argv[3]) if len(sys.argv) > 3 else 13.6
W, H = 1024, 512
u = (np.arange(W) + 0.5)/W; v = (np.arange(H) + 0.5)/H
U, V = np.meshgrid(u, v)
lat = (1 - V)*180.0                     # 0 no polo norte (frente)
a_iris = np.degrees(np.arcsin(min(r_iris/R, 0.99)))
esclera = np.zeros((H, W, 3), np.float32) + np.array([0.80, 0.80, 0.83], np.float32)   # BGR
warm = np.clip((lat - 40)/60, 0, 1)[..., None]
esclera = esclera*(1 - 0.35*warm) + np.array([0.55, 0.58, 0.72], np.float32)*0.35*warm  # rosado longe da frente
iris_col = np.array([0.10, 0.14, 0.26], np.float32)      # castanho escuro (BGR)
rng = np.random.default_rng(3)
ang = np.arctan2(np.sin(np.radians(U*360)), np.cos(np.radians(U*360)))
striae = 1 + 0.18*np.sin(ang*60 + rng.normal(0, 0.4)) + 0.10*np.sin(ang*23)
t = np.clip(lat/a_iris, 0, 2)
iris = iris_col[None, None]*(0.65 + 0.5*t[..., None])*striae[..., None]
iris = iris*(1 - 0.45*np.clip((t - 0.75)/0.25, 0, 1)[..., None])                        # anel límbico escuro
img = np.where((lat < a_iris)[..., None], iris, esclera)
pup = lat < 0.42*a_iris
img[pup] = np.array([0.02, 0.02, 0.02], np.float32)
b = np.clip((lat - a_iris)/2.5, 0, 1)[..., None]                                        # borda suave da íris
img = img*(1 - b) + esclera*b*(lat >= a_iris)[..., None] + img*0
img = np.where((lat < a_iris - 1.5)[..., None], np.where(pup[..., None], np.array([0.02, 0.02, 0.02], np.float32), iris), img)
img = cv2.GaussianBlur(img, (0, 0), 1.2)
cv2.imwrite(out, np.clip(img*255, 0, 255).astype(np.uint8))
print("EYETEX", out, "iris angular %.1f graus" % a_iris)
