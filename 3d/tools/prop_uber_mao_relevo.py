"""Relevo anatômico das mãos do `uber` (formas secundárias e terciárias), no repouso, antes da pose:

- nós dos dedos: cabeças dos metacarpos (MCP) salientes no dorso e nós menores nas juntas médias (PIP);
- tendões extensores discretos do punho a cada MCP;
- leito da unha rebaixado e sulco da cutícula (a placa da unha é malha própria, prop_uber_unha.py).
O quadro de cada unha (centro, eixo, normal, extensão) sai do grupo `fingernails` do MPFB e serve também à textura
(lúnula, borda livre, cutícula) em prop_uber_pele.py. Unidades: metros no espaço do glb (mão já na escala do rosto).
"""
import numpy as np


def normais(me, V):
    """Normais por vértice (média das faces, ponderada pela área) da malha `me` com posições V."""
    N = np.zeros_like(V)
    for p in me.polygons:
        ids = list(p.vertices)
        P = V[ids]
        n = np.zeros(3)
        for i in range(len(ids)):                          # Newell
            a, b = P[i], P[(i + 1) % len(ids)]
            n += np.cross(a, b)
        N[ids] += n
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
    return N


def _sm(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def unhas(mao, N):
    """Quadro de cada unha: dict dedo → (centro, u eixo p/ a ponta, v lateral, m normal, u0, u1, meia largura)."""
    s = '.' + mao.lado
    out = {}
    for d in range(1, 6):
        k = mao.idx['finger%d-3' % d + s]
        sel = (mao.unha > 0.45) & (mao.W[:, k] > 0.3)
        if sel.sum() < 4:
            continue
        c = mao.V[sel].mean(0)
        h, t = mao.cab['finger%d-3' % d + s]
        u = (t - h) / np.linalg.norm(t - h)
        m = N[sel].mean(0)
        m -= u * (m @ u)
        m /= np.linalg.norm(m)
        v = np.cross(m, u)
        q = mao.V[sel] - c
        pu, pv = q @ u, q @ v
        out[d] = dict(c=c, u=u, v=v, m=m, u0=float(pu.min()), u1=float(pu.max()) * 1.05,
                      w=float(np.abs(pv).max()) * 0.92)
    return out


def campo_unha(Q, f):
    """Para pontos Q (repouso): (dentro 0..1 com borda suave, posição ao longo 0 cutícula → 1 ponta, distância à borda
    em m, altura sobre o plano da unha)."""
    q = Q - f['c']
    pu, pv, pm = q @ f['u'], q @ f['v'], q @ f['m']
    L = f['u1'] - f['u0']
    t = (pu - f['u0']) / L
    # contorno: retângulo com a ponta proximal arredondada (cutícula em arco)
    arco = f['w'] * (1 - np.sqrt(np.clip(1 - (pv / f['w']) ** 2, 0, 1)))
    d_lat = f['w'] - np.abs(pv)
    d_prox = pu - (f['u0'] + arco * 0.9)
    d_dist = f['u1'] + 0.0008 - pu
    borda = np.minimum(np.minimum(d_lat, d_prox), d_dist)
    frente = pm > -0.004
    dentro = _sm(-0.00025, 0.00025, borda) * frente
    return dentro, np.clip(t, 0, 1), borda * frente + (-1) * (~frente), pm


def aplicar(mao):
    """Desloca mao.V ao longo da normal (repouso). Devolve (normais, unhas) para a textura."""
    s = '.' + mao.lado
    N = normais(mao.malha, mao.V)
    w, df, lat, n = mao.quadro()
    dorso = -n
    h = np.zeros(len(mao.V))
    V = mao.V
    for d in (2, 3, 4, 5):
        mcp = mao.cab['finger%d-1' % d + s][0]
        pip = mao.cab['finger%d-2' % d + s][0]
        for c, amp, sig in ((mcp, 0.0014, 0.0075), (pip, 0.0007, 0.0050)):
            r2 = ((V - c) ** 2).sum(1)
            cosd = np.clip(((V - c) @ dorso) / np.sqrt(r2 + 1e-12), 0, 1)
            h += amp * np.exp(-r2 / sig ** 2) * cosd ** 1.5
        a, b = w + (mcp - w) * 0.18, mcp - (mcp - w) * 0.06   # tendão extensor
        ab = b - a
        t = np.clip(((V - a) @ ab) / (ab @ ab), 0, 1)
        dl = np.linalg.norm(V - (a + np.outer(t, ab)), axis=1)
        dors = np.clip(N @ dorso, 0, 1)
        h += 0.00032 * np.exp(-(dl / 0.0021) ** 2) * np.sin(np.pi * t) ** 0.7 * dors
    U = unhas(mao, N)
    for f in U.values():
        dentro, t, borda, pm = campo_unha(V, f)
        viz = np.linalg.norm(V - f['c'], axis=1) < (f['u1'] - f['u0']) * 1.4
        sulco = np.exp(-((borda + 0.0006) / 0.00045) ** 2) * (borda < 0) * viz * (pm > -0.003)
        h += (-0.00018 * dentro - 0.00020 * sulco) * viz        # leito rebaixado: a placa é malha própria
    mao.V = V + N * h[:, None]
    return normais(mao.malha, mao.V), U
