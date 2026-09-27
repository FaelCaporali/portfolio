"""E1 `qa_bug`: besouro no nível do busto (casco vermelho laqueado partido ao meio, pronoto e cabeça pretos, olhos
compostos, 2 antenas segmentadas com clava, 6 patas articuladas saindo do TÓRAX, asas membranosas com nervuras sob
os élitros). Vista de cima = o ícone clássico de bug. Também gera os espécimes da caixa (mesma anatomia, variações).

Espaço local do bug (glb): frente +Z, dorso +Y, +X = esquerda do bug; construído com a base ventral em y = 0 e depois
levado ao CENTRO DE MASSA (COM). Medidas em m do scan (comprimento cabeça→ponta dos élitros ≈ 0,035).
Estados: base = POUSO (patas abertas apoiadas, asas dobradas sob os élitros fechados); chave de forma `voo` nas
patas (encolhidas) e nas asas (abertas). Élitros abrem por rotação no pivô (articulação), feita pelo site.
"""
import math

import numpy as np

import prop_qa_util as U

BASE = dict(ax=0.0104, az=0.0125, H=0.0095, zc=-0.004, zf=0.0045, laca='#b3141f', borda='#5a0a10',
            sutura='#16080a', preto='#0d0d10', olho='#2c2318', abd='#1a1314', antena=1.0, clava=1.0,
            mandibula=1.0, focinho=0.0, pron=(0.0079, 0.0043, 0.0042), cab=(0.0045, 0.0030, 0.0036), pata=1.0)
COM = np.array((0.0, 0.0030, -0.0020))
TORAX_Z = (-0.0055, 0.0117)                     # pro + meso + metatórax (sob o pronoto e a base dos élitros)
RAIZ = ((0.0030, 0.0004, 0.0086), (0.0034, -0.0008, 0.0030), (0.0040, -0.0010, -0.0022))
ANG = {'pouso': (48, -4, -40), 'voo': (-25, -62, -78)}
COMP = ((0.0062, 0.0066, 0.0046), (0.0060, 0.0064, 0.0046), (0.0068, 0.0076, 0.0050))
ELITRO_ABERTO = {'esq': (15.0, 40.0), 'dir': (15.0, -40.0)}    # voo: (X, Z) graus no quadro do pivô, R = Rz · Rx


def _sm(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def dome(p, x, z):
    rho2 = (np.asarray(x) / p['ax']) ** 2 + ((np.asarray(z) - p['zc']) / p['az']) ** 2
    return p['H'] * np.clip(1 - rho2 ** 1.1, 0, 1) ** 0.5


def pivo_elitro(s):
    return np.array((s * 0.0016, 0.0062, 0.0040)) - COM


def raiz_asa(s):
    return np.array((s * 0.0022, 0.0050, 0.0010)) - COM


def _normais(T, s):
    di = np.gradient(T, axis=0)
    dj = np.gradient(T, axis=1)
    n = np.cross(dj, di)
    if (n[..., 1].mean() * 1.0) < 0:
        n = -n
    return n / np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-12)


def _casca(m, T, Bt, uv, cor_t, cor_b, cel):
    Vt, _ = m.grade(T, uv, cor_t, cel=cel)
    Vb, _ = m.grade(Bt, uv, cor_b, cel=cel)
    ni, nj = len(Vt), len(Vt[0])
    borda = ([(0, j) for j in range(nj)] + [(i, nj - 1) for i in range(1, ni)] +
             [(ni - 1, j) for j in range(nj - 2, -1, -1)] + [(i, 0) for i in range(ni - 2, 0, -1)])
    c = U.celula_uv(cel, (0.5, 0.5))
    for a, b in zip(borda, borda[1:] + borda[:1]):
        m.face([Vt[a[0]][a[1]], Vt[b[0]][b[1]], Vb[b[0]][b[1]], Vb[a[0]][a[1]]], [c] * 4,
               U.lin(cor_b if isinstance(cor_b, str) else cor_b[a[0]][a[1]]))


def elitro(m, p, s, ni=18):
    """Casca de 0,45 mm: sutura escura em x ≈ 0, borda lateral dobrando para baixo (epipleura)."""
    th0 = math.acos((p['zf'] - p['zc']) / p['az'])
    vs = np.array([0, 0.035, 0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.9, 1.0])
    xs = 0.00022
    T, uv, cor = [], [], []
    for i, t in enumerate(np.linspace(th0, math.pi - 0.07, ni)):
        z = p['zc'] + p['az'] * math.cos(t)
        xe = max(p['ax'] * math.sin(t), xs + 0.0003)
        u = i / (ni - 1)
        row, ru, rc = [], [], []
        cai = 0.0024 * _sm(0.55, 1.0, u) ** 1.5          # declive da ponta: desce sobre o fim do abdome
        for v in vs:
            x = xs + (xe - xs) * v
            row.append((s * x, float(dome(p, x * 0.9995, z)) + 0.0002 - cai, z))
            ru.append((u, v))
            k = min(1.0, 0.85 * v ** 3 + 0.45 * u ** 5)
            rc.append(U.lin(p['sutura']) if v < 0.05 else U.mistura(p['laca'], p['borda'], k))
        row.append((s * (xe - 0.00035), -0.0005 - cai, z))
        ru.append((u, 1.0))
        rc.append(U.lin(p['borda']))
        T.append(row)
        uv.append(ru)
        cor.append(rc)
    T = np.array(T)
    Bt = T - _normais(T, s) * 0.00045
    under = np.array([[U.mistura(p['borda'], '#000000', 0.4)] * T.shape[1]] * T.shape[0])
    _casca(m, T, Bt, np.array(uv), np.array(cor), under, 'laca')


def corpo(m, p, res=1.0):
    nu, nv = max(6, int(10 * res)), max(8, int(14 * res))
    px, py, pz = p['pron']

    def pron(P):
        t = (P[:, 2] / pz + 1) / 2                                   # 0 atrás → 1 frente
        P[:, 0] *= 1 - 0.20 * t
        P[:, 1] = np.where(P[:, 1] < 0, P[:, 1] * 0.45, P[:, 1] * (1 - 0.12 * t))
        return P
    m.elipsoide((0, 0.0030, 0.0075), (px, py, pz), nu, nv, ex=2.6, ey=2.3, forma=pron, cel='quitina', cor=p['preto'])
    cx, cy, cz = p['cab']
    f = p['focinho']

    def cab(P):
        P[:, 2] += np.clip(P[:, 2], 0, None) * f * 1.6                # gorgulho: rostro
        P[:, 0] *= 1 - 0.5 * f * np.clip(P[:, 2] / cz, 0, None)
        return P
    m.elipsoide((0, 0.0024, 0.0122), (cx, cy, cz), max(6, int(8 * res)), nv, ex=2.2, forma=cab, cel='quitina',
                cor=p['preto'])
    for s in (1, -1):
        m.elipsoide((s * 0.84 * cx, 0.0027, 0.0128), (0.0013, 0.0016, 0.0017), max(4, int(6 * res)),
                    max(6, int(10 * res)), cel='olho', cor=p['olho'])
    tor = lambda P: P                                               # noqa: E731
    m.elipsoide((0, 0.0004, 0.0032), (0.0056, 0.0028, 0.0058), nu // 2 + 1, nv * 3 // 4, forma=tor,
                cel='quitina', cor=p['preto'])

    def abd_cor(P):
        banda = ((P[..., 2] + 0.02) / 0.0031) % 1.0 < 0.14
        c = np.where((banda & (P[..., 1] < 0.0004))[..., None], np.array(U.lin('#070606')),
                     np.array(U.lin(p['abd'])))
        return c
    m.elipsoide((0, 0.0003, -0.0050), (0.0090, 0.0034, 0.0108), nu * 3 // 4, nv * 3 // 4, cel='quitina',
                cor=abd_cor)
    y = float(dome(p, 0.0, 0.0036)) + 0.00015                        # escutelo: triângulo entre os élitros
    V = [m.verts([q])[0] for q in ((0.0012, y, 0.0040), (-0.0012, y, 0.0040), (0.0, y - 0.0001, 0.0019),
                                   (0.0012, y - 0.0007, 0.0040), (-0.0012, y - 0.0007, 0.0040),
                                   (0.0, y - 0.0008, 0.0019))]
    c = U.celula_uv('quitina', (0.5, 0.5))
    for f_ in ((0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)):
        m.face([V[i] for i in f_], [c] * len(f_), U.lin(p['preto']))
    for s in (1, -1):                                                # antenas e mandíbulas
        _antena(m, p, s, res)
        a = p['mandibula']
        pts = [(s * 0.0013, 0.0013, 0.0150), (s * 0.0016 * a, 0.0011, 0.0150 + 0.0012 * a),
               (s * 0.0008 * a, 0.0010, 0.0152 + 0.0022 * a), (s * 0.00015, 0.0010, 0.0150 + 0.0026 * a)]
        pts = [(x, y_, z + f * cz * 1.6) for x, y_, z in pts]
        m.tubo(pts, [0.00045 * min(a, 1.6), 0.0004 * min(a, 1.6), 0.0003, 0.00012], seg=max(4, int(5 * res)),
               cel='quitina', cor=p['preto'])


def _catmull(C, n):
    C = np.asarray(C, float)
    C = np.vstack([2 * C[0] - C[1], C, 2 * C[-1] - C[-2]])
    out = []
    for k in range(1, len(C) - 2):
        for t in np.linspace(0, 1, n, endpoint=False):
            p0, p1, p2, p3 = C[k - 1:k + 3]
            out.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
                              (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
    out.append(C[-2])
    return np.array(out)


def _antena(m, p, s, res):
    """11 artículos contados no raio (contrição entre eles), os 3 últimos em clava."""
    a = p['antena']
    C = [(0.0028, 0.0034, 0.0148), (0.0045, 0.0046, 0.0185), (0.0075, 0.0055, 0.0225), (0.0105, 0.0058, 0.0255),
         (0.0125, 0.0056, 0.0272)]
    b = np.array(C[0])
    C = [b + (np.array(q) - b) * np.array((a ** 0.8, 1.0, a)) for q in C]
    C = [(s * q[0], q[1], q[2] + p['focinho'] * p['cab'][2] * 1.2) for q in C]
    pts = _catmull(C, max(4, int(7 * res)))
    n = len(pts)
    t = np.linspace(0, 1, n)
    seg = np.minimum((t * 11).astype(int), 10)
    fr = t * 11 - seg
    base = np.where(seg >= 8, 0.00030 + 0.00022 * p['clava'], 0.00030 - 0.00006 * t)
    r = base * (0.62 + 0.38 * np.sin(np.pi * np.clip(fr, 0.05, 0.95)) ** 0.6)
    r[-1] = 0.00012
    m.tubo(pts, r, seg=max(4, int(5 * res)), cel='pata', cor=p['preto'])


def perna(p, s, k, estado):
    """Polilinha (glb) e raios de uma pata: coxa, fêmur (fuso), tíbia (alarga para a ponta), tarso de 4 artículos
    e garra. k = 0 anterior, 1 média, 2 posterior."""
    L = np.array(COMP[k]) * p['pata']
    r0 = np.array(RAIZ[k]) * (s, 1, 1)
    a = math.radians(ANG[estado][k])
    lat, up, fw = np.array((s, 0, 0.0)), np.array((0, 1, 0.0)), np.array((0, 0, 1.0))
    hd = lat * math.cos(a) + fw * math.sin(a)
    c = r0 + hd * 0.0010 + up * -0.0004
    if estado == 'pouso':
        df = U.unit(hd * math.cos(math.radians(22)) + up * math.sin(math.radians(22)))
        dt = U.unit(hd * math.cos(math.radians(-62)) + up * math.sin(math.radians(-62)))
        g = math.radians(12 if k == 0 else (-8 if k == 2 else 0))
        hd2 = U.unit(hd * math.cos(g) + np.cross(up, hd) * math.sin(g) * s * -1)
        da = U.unit(hd2 * math.cos(math.radians(-14)) + up * math.sin(math.radians(-14)))
    else:
        df = U.unit(hd * math.cos(math.radians(-32)) + up * math.sin(math.radians(-32)))
        dt = U.unit(-hd * 0.95 + up * -0.18 - fw * 0.22)
        da = U.unit(-fw + up * -0.12 + lat * 0.15)
    kn = c + df * L[0]
    an = kn + dt * L[1]
    ta = an + da * L[2]
    pts, rs = [r0, c], [0.00085, 0.0009]
    for t in np.linspace(0.08, 0.92, 6):
        pts.append(c + (kn - c) * t)
        rs.append(0.00060 + 0.00032 * math.sin(math.pi * t))
    for t in np.linspace(0.06, 0.94, 6):
        pts.append(kn + (an - kn) * t)
        rs.append(0.00042 + 0.00016 * t)
    for t, r in zip(np.linspace(0.05, 1.0, 7), (0.00040, 0.00030, 0.00037, 0.00027, 0.00033, 0.00024, 0.00010)):
        pts.append(an + (ta - an) * t)
        rs.append(r)
    return np.array(pts), np.array(rs) * p['pata'] ** 0.5


def patas(m, p, estado, res=1.0):
    for s in (1, -1):
        for k in range(3):
            pts, rs = perna(p, s, k, estado)
            m.tubo(pts, rs, seg=max(4, int(5 * res)), cel='pata', cor=p['preto'])


def asa(p, s, estado, ni=10, nj=4):
    """Grade (ni × nj) da asa posterior: u = envergadura, v = corda."""
    R = np.array((s * 0.0022, 0.0050, 0.0010))
    P = np.zeros((ni, nj, 3))
    for i, t in enumerate(np.linspace(0, 1, ni)):
        for j, w in enumerate(np.linspace(0, 1, nj)):
            if estado == 'voo':
                S = U.unit((s * 1.0, 0.10, -0.32))
                Cd = U.unit(np.array((0, 0, -1.0)) - S * (-S[2]))
                c = 0.0035 + 0.0080 * math.sin(math.pi * t ** 0.9) ** 0.7 - 0.0023 * t
                q = R + S * (t * 0.029) + Cd * (0.0008 * math.sin(math.pi * t) + c * w)
                q[1] += 0.0012 * t + 0.0004 * math.sin(math.pi * w)
            else:
                q = R + np.array((s * (0.0004 + 0.0040 * w + 0.0008 * math.sin(math.pi * t)), 0,
                                  -(0.0006 + 0.0135 * t + 0.0020 * w)))
                q[1] = 0.62 * float(dome(p, q[0], q[2]))
            P[i, j] = q
    uv = np.array([[(t, w) for w in np.linspace(0, 1, nj)] for t in np.linspace(0, 1, ni)])
    return P, uv


def especime(m, p, M, res=0.5):
    """Espécime alfinetado (élitros fechados, patas abertas em pouso) na malha `m`, levado pela matriz M (glb)."""
    m.xf = np.asarray(M) @ _T(-COM)
    corpo(m, p, res)
    for s in (1, -1):
        elitro(m, p, s, ni=max(8, int(18 * res)))
    patas(m, p, 'pouso', res)
    m.xf = np.eye(4)


def _T(v):
    M = np.eye(4)
    M[:3, 3] = v
    return M
