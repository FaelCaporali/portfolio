"""Normal map das mãos do `uber` assado de uma ESCULTURA procedural de alta frequência (altura em metros por texel,
calculada na posição de repouso), sobre a malha média que já tem nós, tendões e metacarpos:

- poros e microrrelevo: passa-alta da luminância da mesma amostra da bochecha do S13 (o ladrilho de prop_uber_pele)
  + ruído fino;
- rugas transversais no dorso das juntas médias e distais (3 dobras cada) e dobras em arco sobre os nós (MCP);
- pregas palmares nas juntas e na base dos dedos;
- sulco da cutícula em volta da unha.
Tangente = +u, bitangente = +v da UV (a convenção do glTF/MikkTSpace; o three.js deriva o mesmo quadro da UV).
"""
import math

import numpy as np

import prop_uber_mao_relevo as RL
from prop_vela_img import ruido

AMP_PORO, AMP_RUGA, AMP_PREGA = 0.000045, 0.000075, 0.00011


def _passa_alta(tile):
    lum = tile @ np.array((0.2126, 0.7152, 0.0722))
    k = np.hanning(15)
    k /= k.sum()
    b = lum.copy()
    for ax in (0, 1):
        b = sum(np.roll(b, i - 7, ax) * k[i] for i in range(15))
    return (lum - b) / max(1e-6, np.std(lum - b))


def _tri(hp, P, N, dens):
    t = hp.shape[0]
    out = np.zeros(len(P))
    ws = np.zeros(len(P))
    for ax in range(3):
        a, b = [k for k in range(3) if k != ax]
        w = np.abs(N[:, ax]) ** 4
        out += hp[(P[:, a] * dens).astype(int) % t, (P[:, b] * dens).astype(int) % t] * w
        ws += w
    return out / np.maximum(ws, 1e-9)


def altura(d, tile, P, N, dens):
    """Altura (m) por ponto de repouso P (normal de repouso N) da mão `d`."""
    mao = d['mao']
    s = '.' + mao.lado
    _, _, _, n = mao.quadro()
    dors = np.clip(-(N @ n), 0, 1)
    palm = np.clip(N @ n, 0, 1)
    fino = ruido(256, 256, 24, 5 + (mao.lado == 'R'))
    fino = (fino - fino.mean()) / fino.std()
    Pp = P + (0.37 if mao.lado == 'R' else 0.0)              # poros sem repetir entre as duas mãos
    h = AMP_PORO * (0.8 * _tri(_passa_alta(tile), Pp, N, dens) + 0.5 * _tri(fino, Pp, N, dens * 1.7))
    for dd in range(1, 6):
        for k in (1, 2, 3):
            b = 'finger%d-%d' % (dd, k) + s
            c, tl = mao.cab[b]
            ax = (tl - c) / np.linalg.norm(tl - c)
            q = P - c
            al = q @ ax
            lat2 = np.maximum((q * q).sum(1) - al ** 2, 0)
            if k > 1 or dd == 1:                                  # rugas do dorso nas juntas (3 dobras)
                env = np.exp(-(al / 0.0024) ** 2) * np.exp(-lat2 / 0.0062 ** 2) * dors
                h -= AMP_RUGA * env * np.clip(np.cos(al / 0.00085 * math.pi), 0, 1) ** 6
            if k == 1 and dd > 1:                                 # arcos sobre o nó (MCP)
                r = np.sqrt((q * q).sum(1))
                env = np.exp(-((r - 0.0075) / 0.003) ** 2) * dors
                h -= 0.7 * AMP_RUGA * env * np.clip(np.cos(r / 0.0011 * math.pi), 0, 1) ** 6
            # prega palmar da junta (na cabeça do osso, lado da palma)
            env = np.exp(-(al / 0.0006) ** 2) * np.exp(-lat2 / 0.0075 ** 2) * palm
            h -= AMP_PREGA * env
    # dorso: tendões extensores, veias (com meandro) e rugas do punho (ADENDO 3/4)
    w = mao.cab['wrist' + s][0]
    ax = w - mao.cab['lowerarm02' + s][0]
    ax /= np.linalg.norm(ax)
    t = (P - w) @ ax
    _, df, lat, _ = mao.quadro()
    mcp = {k: mao.cab['finger%d-1' % k + s][0] for k in (2, 3, 4, 5)}
    for k, fase in ((2, 0.3), (3, 1.9), (4, 3.1), (5, 4.4)):
        a, b = w + (mcp[k] - w) * 0.12, mcp[k] - (mcp[k] - w) * 0.08
        ab = b - a
        u = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
        dl = np.linalg.norm(P - (a + np.outer(u, ab)), axis=1)
        h += 0.00014 * np.exp(-(dl / 0.0017) ** 2) * np.sin(np.pi * u) ** 0.8 * dors
        if k < 5:                                              # veia entre os tendões k e k+1
            meio = (mcp[k] + mcp[k + 1]) / 2
            a2, b2 = w + (meio - w) * 0.05, meio - (meio - w) * 0.18
            ab2 = b2 - a2
            u2 = np.clip(((P - a2) @ ab2) / (ab2 @ ab2), 0, 1)
            c2 = a2 + np.outer(u2, ab2) + np.outer(0.0028 * np.sin(u2 * 3.2 + fase), lat)
            dv = np.linalg.norm(P - c2, axis=1)
            h += 0.00022 * np.exp(-(dv / 0.0012) ** 2) * np.sin(np.pi * u2) ** 0.6 * dors
    for t0, amp in ((0.004, 1.0), (0.010, 0.8), (0.017, 0.5)):  # pregas do punho (palma) e rugas (dorso)
        h -= AMP_PREGA * amp * np.exp(-((t - t0) / 0.0005) ** 2) * (palm + 0.5 * dors)
    for f in d['unhas'].values():
        dentro, t, borda, pm = RL.campo_unha(P, f)
        h -= 0.0001 * np.exp(-((borda + 0.0003) / 0.00035) ** 2) * (pm > -0.003)
    return h


def mapa(H, Pimg, msk):
    """Normal tangente (0..1) da altura H (res, res) com o tamanho de texel medido na posição de repouso."""
    nx = np.zeros(H.shape)
    ny = np.zeros(H.shape)
    for ax, out in ((1, nx), (0, ny)):
        hp, hm = np.roll(H, -1, ax), np.roll(H, 1, ax)
        pp, pm = np.roll(Pimg, -1, ax), np.roll(Pimg, 1, ax)
        ok = msk & np.roll(msk, -1, ax) & np.roll(msk, 1, ax)
        dist = np.linalg.norm(pp - pm, axis=2)
        g = np.where(ok & (dist > 1e-7), (hp - hm) / np.maximum(dist, 1e-7), 0.0)
        out[:] = np.clip(-g, -2.5, 2.5)
    n = np.dstack([nx, ny, np.ones(H.shape)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5
