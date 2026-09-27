"""Texturas e materiais da vida `qa`: UM atlas 4 × 4 para tudo que é duro (bug, espécimes, lupa, caixa), cor por
vértice × detalhe do atlas, ORM por célula (G rugosidade, B metal) e normal por célula; asa membranosa com nervuras
(RGBA); vidro. Células e UV: prop_qa_util.CELULAS. Linhas das imagens = v de baixo para cima.

Cada célula carrega o microdetalhe que a geometria não paga: pontuações em fileiras nos élitros (estrias pontuadas
de besouro), facetas do olho composto, escovado do latão, veio da nogueira, grânulo da cortiça, fibras do papel e as
linhas ilegíveis das etiquetas (sem palavra, de propósito).
"""
import math

import numpy as np

import prop_financeiro_v6 as v6
import prop_qa_util as U
import prop_vela_base as B
from prop_vela_img import lin as srgb01, normal_de_altura, ruido

N = 128                                               # lado da célula no atlas de 512
ORM = {'laca': (0.13, 0), 'quitina': (0.22, 0), 'olho': (0.16, 0), 'pata': (0.34, 0), 'latao': (0.30, 1),
       'madeira': (0.48, 0), 'cortica': (0.90, 0), 'papel': (0.84, 0), 'etiqueta_a': (0.84, 0),
       'etiqueta_b': (0.84, 0), 'etiqueta_c': (0.84, 0), 'aco': (0.22, 1), 'especime': (0.30, 0),
       'verniz': (0.36, 0), 'liso': (0.50, 0), 'nylon': (0.28, 0)}


def _gauss_pontos(pts, raio, n=N):
    yy, xx = np.mgrid[0:n, 0:n]
    h = np.zeros((n, n))
    for y, x in pts:
        for dy in (-n, 0, n):                          # periódico
            for dx in (-n, 0, n):
                h += np.exp(-((yy - y - dy) ** 2 + (xx - x - dx) ** 2) / (2 * raio ** 2))
    return np.clip(h, 0, 1)


def _linhas_texto(rng, x0, y0, w, h, linhas=5):
    """Máscara de 'texto' ilegível: palavras de 3–11 px em linhas de 3 px com entrelinha de 4 px (1 = tinta); a 1ª
    linha (nome) um pouco mais escura, as outras (local, data, coletor) mais leves."""
    m = np.zeros((h, w))
    for k in range(linhas):
        y = h - 9 - k * 7                              # de cima para baixo
        x = 6 + (0 if k == 0 else int(rng.integers(0, 4)))
        fim = w - 6 - int(rng.integers(0, w // 3)) * (k > 0)
        while x < fim and y > 2:
            pal = int(rng.integers(3, 12))
            m[y:y + 3, x:min(x + pal, fim)] = (0.9 if k == 0 else 0.6) * (0.8 + 0.2 * rng.random())
            x += pal + int(rng.integers(2, 4))
    return m


def celula(nome, rng):
    """(albedo cinza/RGB (N, N, 3), rugosidade (N, N), altura (N, N)) de uma célula."""
    n = N
    ru = ruido(n, n, 8, int(rng.integers(1, 1 << 30)))
    alb = np.ones((n, n, 3))
    alt = np.zeros((n, n))
    rug0, _ = ORM[nome]
    rug = np.full((n, n), rug0) + 0.04 * (ru - 0.5)
    if nome in ('laca', 'especime'):                   # estrias pontuadas: 9 fileiras ao longo de u (comprimento)
        pts = [((k + 0.5) * n / 9, x + rng.normal(0, 0.6)) for k in range(9) for x in np.arange(0, n, 6.0)]
        p = _gauss_pontos(pts, 0.85)
        alt = -p * 0.5 - 0.10 * ru
        alb *= (1 - 0.05 * p - 0.05 * (ru - 0.5))[..., None]
    elif nome in ('quitina', 'pata', 'nylon'):
        pts = [tuple(rng.random(2) * n) for _ in range(220)]
        p = _gauss_pontos(pts, 0.8)
        alt = -0.5 * p - 0.2 * ru
        alb *= (0.94 + 0.06 * ru)[..., None]
    elif nome == 'olho':                               # facetas hexagonais
        pts = [(r * 7.0, c * 8.0 + (4.0 if r % 2 else 0.0)) for r in range(19) for c in range(16)]
        p = _gauss_pontos(pts, 2.2)
        alt = p
        alb *= (0.80 + 0.20 * p)[..., None]
    elif nome in ('latao', 'aco'):                     # escovado ao longo de u
        linhas = np.convolve(rng.normal(0, 1, n * 3), np.ones(3) / 3, 'same')[n:2 * n]
        alt = 0.35 * linhas[:, None] * np.ones((1, n)) + 0.1 * ru
        alb *= (0.93 + 0.05 * np.tanh(linhas)[:, None] + 0.03 * ru)[..., None]
        rug += 0.05 * np.tanh(linhas)[:, None]
    elif nome in ('madeira', 'verniz'):                # veio ao longo de v (cabo: v = eixo; régua: v = comprimento)
        v = np.linspace(0, 1, n, endpoint=False)[:, None]
        u = np.linspace(0, 1, n, endpoint=False)[None, :]
        g = np.sin(2 * math.pi * (u * 7 + 0.35 * ru + 0.08 * np.sin(2 * math.pi * v)))
        poros = _gauss_pontos([tuple(rng.random(2) * n) for _ in range(160)], 0.7)
        alb *= (0.70 + 0.30 * (0.5 + 0.5 * g) ** 1.6 - 0.12 * poros)[..., None]
        alt = 0.25 * g - 0.4 * poros
        rug += 0.05 * g * (nome == 'madeira')
    elif nome == 'cortica':                            # grânulos e poros
        fino = ruido(n, n, 24, int(rng.integers(1, 1 << 30)))
        poros = _gauss_pontos([tuple(rng.random(2) * n) for _ in range(90)], 1.2)
        alb *= (0.70 + 0.30 * fino - 0.30 * poros)[..., None]
        alt = 0.8 * fino - 0.9 * poros
    elif nome == 'papel' or nome.startswith('etiqueta'):
        fib = ruido(n, n, 30, int(rng.integers(1, 1 << 30)))
        alb *= (0.95 + 0.05 * fib)[..., None]
        alt = 0.08 * fib
        if nome.startswith('etiqueta'):                # duas etiquetas por célula (metade de cima e de baixo)
            tinta = np.zeros((n, n))
            tinta[n // 2:, :] = _linhas_texto(rng, 0, 0, n, n // 2)
            if nome != 'etiqueta_c':                   # etiqueta_c de baixo = a da vaga livre, em branco
                tinta[:n // 2, :] = _linhas_texto(rng, 0, 0, n, n // 2)
            alb *= (1 - 0.72 * tinta)[..., None]
    else:
        alt = 0.05 * ru
    return alb, np.clip(rug, 0.04, 1), alt


def atlas(pasta, semente=85):
    """Albedo 512², ORM 256², normal 512² → imagens do Blender."""
    rng = np.random.default_rng(semente)
    alb = np.ones((4 * N, 4 * N, 3))
    rug = np.ones((4 * N, 4 * N))
    met = np.zeros((4 * N, 4 * N))
    alt = np.zeros((4 * N, 4 * N))
    forca = {'laca': 0.7, 'olho': 2.0, 'cortica': 1.6, 'madeira': 1.0, 'latao': 0.6, 'aco': 0.5, 'quitina': 0.8,
             'pata': 0.6, 'especime': 0.5, 'nylon': 0.4}
    for nome, (c, r) in U.CELULAS.items():
        a, g, h = celula(nome, rng)
        sl = (slice(r * N, (r + 1) * N), slice(c * N, (c + 1) * N))
        alb[sl] = a
        rug[sl] = g
        met[sl] = ORM[nome][1]
        alt[sl] = h * forca.get(nome, 0.4)
    orm = np.dstack([np.ones_like(rug), rug, met])[::2, ::2]
    nrm = normal_de_altura(alt, 1.0)
    return (U.imagem('qa_atlas_cor', alb, pasta, 88), U.imagem('qa_atlas_orm', orm, pasta, 92),
            U.imagem('qa_atlas_normal', nrm, pasta, 80))


def _traco(img, pts, esp, cor, alfa):
    """Polilinha (u, v em 0..1) pintada com espessura em px sobre img RGBA (h, w, 4)."""
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    pts = np.array(pts, float) * (w, h)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        d = np.array((x1 - x0, y1 - y0))
        t = np.clip(((xx - x0) * d[0] + (yy - y0) * d[1]) / max(d @ d, 1e-9), 0, 1)
        dist = np.hypot(xx - x0 - t * d[0], yy - y0 - t * d[1])
        m = np.clip(esp / 2 + 0.5 - dist, 0, 1)
        img[..., :3] = img[..., :3] * (1 - m[..., None]) + np.array(cor) * m[..., None]
        img[..., 3] = np.maximum(img[..., 3], m * alfa)


def textura_asa(pasta):
    """Asa posterior de besouro (u = envergadura raiz → ponta, v = corda bordo de ataque 0 → fuga 1): membrana
    fumê translúcida e nervuras marrons (costa, subcosta, rádio, média, cúbito, anais) com o pterostigma."""
    h, w = 128, 256
    img = np.zeros((h, w, 4))
    ru = ruido(h, w, 6, 7)
    img[..., :3] = srgb01('#b8a78c') * (0.92 + 0.08 * ru[..., None])
    img[..., 3] = 0.30 + 0.06 * ru
    esc = srgb01('#3a2a1c')
    _traco(img, [(0.0, 0.03), (0.5, 0.02), (0.85, 0.05), (1.0, 0.16)], 4.0, esc, 0.95)            # costa
    _traco(img, [(0.0, 0.10), (0.45, 0.09), (0.62, 0.10)], 2.6, esc, 0.9)                          # subcosta/rádio
    _traco(img, [(0.0, 0.20), (0.3, 0.26), (0.62, 0.30), (0.95, 0.55)], 2.2, esc, 0.85)             # média
    _traco(img, [(0.0, 0.34), (0.25, 0.46), (0.55, 0.62), (0.80, 0.86)], 2.0, esc, 0.85)            # cúbito
    _traco(img, [(0.0, 0.52), (0.18, 0.70), (0.38, 0.95)], 1.8, esc, 0.8)                          # anal 1
    _traco(img, [(0.0, 0.66), (0.12, 0.85), (0.22, 1.0)], 1.6, esc, 0.8)                           # anal 2
    _traco(img, [(0.62, 0.10), (0.62, 0.30)], 1.6, esc, 0.8)                                       # transversa
    _traco(img, [(0.48, 0.06), (0.66, 0.06)], 7.0, srgb01('#5b3d25'), 0.9)                       # pterostigma
    return U.imagem('qa_asa', img, pasta, 90)


def textura_lente(pasta, perfil):
    """Vidro da lente por v (comprimento do perfil do torno): faces quase invisíveis (alfa 0,03), subindo um pouco
    perto da borda (a espessura que o olho percebe) e a borda retificada fosca e clara (alfa 0,55)."""
    pr = np.array(perfil)
    L = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pr, axis=0), axis=1))]
    L /= L[-1]
    v = (np.arange(128) + 0.5) / 128
    r = np.interp(v, L, pr[:, 0])
    borda = r >= 0.0336
    a = 0.03 + 0.09 * np.clip((r - 0.026) / 0.0076, 0, 1) ** 2
    a = np.where(borda, 0.55, a)
    img = np.ones((128, 8, 4))
    img[..., :3] = np.where(borda[:, None, None], srgb01('#dfe6e4'), srgb01('#f4fbfc'))
    img[..., 3] = a[:, None]
    return U.imagem('qa_lente', img, pasta, 95)


def textura_vidro_caixa(pasta):
    """Vidro da caixa quase invisível (alfa 0,025) com UM reflexo em faixa diagonal no canto de cima à esquerda."""
    n = 64
    v, u = np.mgrid[0:n, 0:n] / (n - 1)
    d = u + (1 - v)
    faixa = np.exp(-((d - 0.26) / 0.05) ** 2) * 0.20 + np.exp(-((d - 0.40) / 0.018) ** 2) * 0.12
    img = np.ones((n, n, 4))
    img[..., 3] = 0.025 + faixa
    return U.imagem('qa_vidro_caixa', img, pasta, 95)


def materiais(pasta):
    import prop_qa_lupa as LP
    cor, orm, nrm = atlas(pasta)
    rigido = B.material('qa_rigido', 0.0, 0.5, cor_base=cor, orm=orm, normal=nrm, vcor=True)
    asa = B.material('qa_asa', 0.0, 0.42, cor_base=textura_asa(pasta), alfa=True, vcor=False, double=True)
    lente = B.material('qa_lente', 0.0, 0.02, cor_base=textura_lente(pasta, LP.perfil_lente()), alfa=True,
                       vcor=False)
    caixa = B.material('qa_vidro_caixa', 0.0, 0.02, cor_base=textura_vidro_caixa(pasta), alfa=True, vcor=False)
    return {'rigido': rigido, 'asa': asa, 'lente': lente, 'vidro_caixa': caixa}
