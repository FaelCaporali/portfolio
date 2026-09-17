"""/data/venv-face/bin/python tools/tex_ops.py <tex_in.png> <pos4096.npy> <ops.json> <tex_out.png>
Edição da textura do KIRI no espaço 3D (o atlas é fragmentado, então nada de blur em UV): cada texel tem sua
posição 3D (bake de posição). Operações (lista em JSON, em ordem):
  {"op":"mirror","c":[x,y,z]mm,"r":mm}                copia a cor do ponto espelhado (x -> -x) com decaimento
  {"op":"smooth","sel":"beard"|"skin"|"all","sigma":mm,"k":0..1, ...}  média 3D (grade de voxels gaussiana)
  {"op":"flatten","sigma":mm,"k":0..1}               tira sombra assada da pele: L *= (alvo/L_baixa)^k
Seleções: beard = escuro (L<dark) com z<zmax e y<0.07; skin = não escuro, fora de olhos/sobrancelhas/boca."""
import sys, json, numpy as np, cv2
from scipy.ndimage import gaussian_filter
from scipy.spatial import cKDTree
tin, pin, opsf, tout = sys.argv[1:5]
T = cv2.imread(tin, cv2.IMREAD_COLOR); S = T.shape[0]; f = 4096 // S
P = np.load(pin, mmap_mode='r'); P = np.asarray(P[f//2::f, f//2::f]).astype(np.float64)
valid = np.abs(P).sum(2) > 0; yy, xx = np.nonzero(valid); X = P[yy, xx]; print("texels", len(X))
LM = json.load(open('analise/lm3d_base.json')); lm = lambda i: np.array(LM[str(i)])
def wsph(c, r):
    d = np.linalg.norm(X - np.array(c)/1000, axis=1)/(r/1000); return np.where(d < 1, (1-np.clip(d, 0, 1)**2)**2, 0)
def lab(): return cv2.cvtColor(T, cv2.COLOR_BGR2LAB)[yy, xx].astype(np.float64)
def put(Lab):
    img = cv2.cvtColor(T, cv2.COLOR_BGR2LAB); img[yy, xx] = np.clip(Lab, 0, 255).astype(np.uint8); T[:] = cv2.cvtColor(img, cv2.COLOR_LAB2BGR)
def field(vals, wts, sigma_mm, vox=0.0015):
    lo = X.min(0); ijk = ((X - lo)/vox).astype(int); sh = ijk.max(0) + 1
    num = np.zeros(tuple(sh) + (vals.shape[1],)); den = np.zeros(tuple(sh))
    np.add.at(den, tuple(ijk.T), wts)
    for c in range(vals.shape[1]):
        g = np.zeros(tuple(sh)); np.add.at(g, tuple(ijk.T), vals[:, c]*wts); num[..., c] = gaussian_filter(g, sigma_mm/1000/vox)
    den = gaussian_filter(den, sigma_mm/1000/vox); return num[tuple(ijk.T)] / np.maximum(den[tuple(ijk.T)], 1e-9)[:, None]
def sel(name, Lab, o):
    dark = Lab[:, 0] < o.get('dark', 70)
    if name == 'beard': return dark & (X[:, 2] < o.get('zmax', 0.125)) & (X[:, 1] < 0.07)
    if name == 'all': return np.ones(len(X), bool)
    ex = np.zeros(len(X), bool)
    for i, r in ((468, 16), (473, 16), (13, 20), (105, 16), (334, 16)):
        if str(i) in LM: ex |= np.linalg.norm(X - lm(i), axis=1) < r/1000
    return ~dark & ~ex & (X[:, 2] > 0.03) & (Lab[:, 0] > o.get('skin_L', 0)) & (X[:, 2] < o.get('skin_zmax', 9)) & (X[:, 1] < o.get('skin_ymax', 9))
kd = cKDTree(X)
for o in json.load(open(opsf)):
    Lab = lab()
    if o['op'] == 'mirror':
        w = wsph(o['c'], o['r']); m = w > 0; q = X[m]*[-1, 1, 1]; _, j = kd.query(q)
        Lab[m] = Lab[m]*(1-w[m, None]) + Lab[j]*w[m, None]; print("mirror", o['c'], int(m.sum()))
    elif o['op'] == 'smooth':
        m = sel(o['sel'], Lab, o); F = field(Lab, m.astype(float), o['sigma']); k = o.get('k', 1.0)
        Lab[m] = Lab[m]*(1-k) + F[m]*k; print("smooth", o['sel'], int(m.sum()))
    elif o['op'] == 'flatten':
        m = sel('skin', Lab, o); low = field(Lab[:, :1], m.astype(float), o['sigma'])[:, 0]; tgt = np.median(Lab[m, 0])
        g = np.clip((tgt/np.maximum(low, 1))**o.get('k', 0.7), o.get('gmin', 0.85), o.get('gmax', 1.15)); Lab[m, 0] = Lab[m, 0]*g[m]
        if o.get('chroma', 0):
            lowc = field(Lab[:, 1:], m.astype(float), o['sigma']); tc = np.median(Lab[m, 1:], 0)
            Lab[m, 1:] += (tc - lowc[m])*o['chroma']
        print("flatten", int(m.sum()), "alvo L", tgt)
    put(Lab)
cv2.imwrite(tout, T); print("TEX", tout)
