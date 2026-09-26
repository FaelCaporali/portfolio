"""Pegada dos dedos das mãos do `uber` (prop_uber_pega): palma a `folga` do tubo, dedos fechando em volta dele
(juntas acopladas, travando no contato) e polegar fechando por dentro do aro."""
import math

import numpy as np

import prop_uber_mao as M

# limites de flexão (MCP, PIP, DIP) crescendo do indicador ao mínimo, como na mão fechada de verdade (ADENDO 4)
LIMITES = {2: (80, 95, 70), 3: (88, 100, 75), 4: (95, 106, 80), 5: (102, 112, 86)}


def _dist_cil(V, P, a, r):
    d = V - P
    return np.linalg.norm(d - np.outer(d @ a, a), axis=1) - r


def agarrar(mao, r, folga=0.001, phi=18.0, recuo=0.35, limites=(95, 105, 80), polegar=(0, 0, 0), onde=None,
            extra=0.0):
    """Dedos envolvem o cilindro (raio r) com folga medida. Devolve (P, a): ponto e direção do eixo, no repouso.

    phi: obliquidade do eixo na palma (graus; o lado do indicador mais distal, como numa pegada de força);
    recuo: o eixo passa a `recuo` × comprimento da falange proximal para trás da linha dos nós (prega palmar distal).
    polegar: (oposição em torno dos dedos, flexão da base, abdução) em graus, antes do ajuste por contato.
    onde(P, a, n): devolve a função de distância (pontos do repouso → m) usada no contato dos dedos (ex.: o toro do
    aro levado ao repouso); sem ela, o cilindro reto."""
    s = '.' + mao.lado
    w, df, lat, n = mao.quadro()
    for d, alvo in M.ADUCAO.items():                        # dedos juntos (o repouso do MPFB é aberto)
        b = 'finger%d-1' % d + s
        v = mao.cab[b][1] - mao.cab[b][0]
        v3 = mao.cab['finger3-1' + s][1] - mao.cab['finger3-1' + s][0]
        v, v3 = v - n * (v @ n), v3 - n * (v3 @ n)
        ang = math.atan2(np.cross(v3, v) @ n, v3 @ v)
        mao.girar(b, n, -ang * (1 - alvo))
    f = math.radians(phi)
    a = lat * math.cos(f) + df * math.sin(f)
    a /= np.linalg.norm(a)
    mcp = np.mean([mao.cab['finger%d-1' % d + s][0] for d in (2, 3, 4, 5)], 0)
    prox = np.linalg.norm(mao.cab['finger3-1' + s][1] - mao.cab['finger3-1' + s][0])
    base = mao.cab['finger3-1' + s][0] - df * recuo * prox
    base = base - a * (a @ (base - mcp))
    dedo = sum(mao.W[:, mao.idx['finger%d-%d' % (d, k) + s]] for d in range(1, 6) for k in (1, 2, 3))
    palma = mao.posada()[dedo < 0.3]
    lo, hi = 0.0, 0.12
    for _ in range(40):                                   # palma a `folga` do cilindro
        m = (lo + hi) / 2
        if _dist_cil(palma, base + n * m, a, r).min() > folga + extra:
            hi = m
        else:
            lo = m
    P = base + n * hi
    dist = onde(P, a, n) if onde else (lambda X: _dist_cil(X, P, a, r))
    mao.curva = {d: _fechar(mao, d, s, n, dist, folga, LIMITES[d]) for d in (2, 3, 4, 5)}
    op, fl, ab = polegar                                  # pré-pose do polegar (graus), depois contato
    b1 = 'finger1-1' + s
    sg = 1 if mao.lado == 'L' else -1
    mao.girar(b1, df, sg * math.radians(op))
    mao.girar(b1, a, math.radians(fl))
    mao.girar(b1, n, sg * math.radians(ab))
    for k, lim in ((1, 40), (2, 60), (3, 70)):
        _aproximar(mao, 'finger1-%d' % k + s, P, a, dist, folga, lim)
    return P, a


def _fechar(mao, d, s, n, dist, folga, limites, razao=(1.0, 0.55, 0.3)):
    """Pegada FECHADA de um dedo, como a mão de verdade fecha: as três juntas flexionam juntas (MCP : PIP : DIP =
    razao) até um segmento encostar no aro (folga); as juntas até ele travam e as de depois continuam fechando em volta
    do tubo. Eixo de flexão = direção do osso × normal da palma (repouso)."""
    bs = ['finger%d-%d%s' % (d, k, s) for k in (1, 2, 3)]
    eixos = [np.cross(mao.cab[b][1] - mao.cab[b][0], n) for b in bs]
    segs = []
    for b in bs:                                          # corpo da falange (sem a dobra da junta, que o LBS amassa)
        h, tl = mao.cab[b]
        f = ((mao.V - h) @ (tl - h)) / ((tl - h) @ (tl - h))
        segs.append((mao.W[:, mao.idx[b]] > 0.5) & (f > 0.3))
    lim = [math.radians(x) for x in limites]
    ang = [0.0, 0.0, 0.0]
    passo, j0 = math.radians(1.0), 0
    while j0 < 3:
        mov = []
        for j in range(j0, 3):
            dj = passo * razao[j]
            if ang[j] + dj <= lim[j]:
                mao.girar(bs[j], eixos[j], dj)
                ang[j] += dj
                mov.append((j, dj))
        if not mov:
            break
        sel = np.any(segs[j0:], axis=0)
        P = mao.posada(sel)
        toque = next((k for k in range(j0, 3) if dist(P[segs[k]]).min() < folga), None)
        if toque is not None:
            for j, dj in mov:
                mao.girar(bs[j], eixos[j], -dj)
                ang[j] -= dj
            j0 = toque + 1
    return [round(math.degrees(a), 1) for a in ang]


def _aproximar(mao, b, P, a, dist, folga, lim):
    """Gira `b` (e o que vem depois na cadeia) na direção do eixo do cilindro até encostar com `folga`; se começa
    dentro, afasta até sair. Eixo = direção do osso × direção ao eixo do cilindro (fixo no início)."""
    nome, lado = b.rsplit('.', 1)
    d, k = nome[len('finger'):].split('-')
    seg = sum(mao.W[:, mao.idx['finger%s-%d.%s' % (d, j, lado)]] for j in range(int(k), 4)) > 0.5
    h, tl = mao.ponto(b, 0), mao.ponto(b, 1)
    q = P + a * ((tl - P) @ a)
    u = np.cross(tl - h, q - tl)
    if np.linalg.norm(u) < 1e-9:
        return 0
    passo, total = math.radians(1.0), 0.0

    def dmin():
        return dist(mao.posada(seg)[seg]).min()
    if dmin() < folga:                                    # dentro: afasta
        while dmin() < folga and total < math.radians(lim):
            mao.girar_mundo(b, u, -passo)
            total += passo
        return -math.degrees(total)
    while total < math.radians(lim):
        mao.girar_mundo(b, u, passo)
        if dmin() < folga:
            mao.girar_mundo(b, u, -passo)
            break
        total += passo
    return math.degrees(total)
