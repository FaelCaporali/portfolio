"""Texturas geradas da vida `vela` (numpy → WebP; tudo em sRGB para cor, linear para normal/ORM).

1. Boné (atlas 1024²): copa em (u, v) da grade (u = azimute, U 0,5 = frente) e aba (s, t) em cima; sarja tom sobre tom,
   pespontos duplos dos dois lados de cada costura dos gomos, ilhoses bordados nos gomos laterais, desbotado de sol no
   alto, linha de sal perto da faixa, tira traseira em fita (acento), 8 carreiras de pesponto da aba e a fita de
   acabamento na borda da aba (acento). Normal 512² com as costuras rebaixadas, os pespontos e os ilhoses.
2. Velas (atlas 1024 × 512): Laser à esquerda (c, h), Optimist à direita; Dacron creme com painéis em corte cruzado,
   bolsas das réguas, janela (Laser), reforços dos punhos, fita da valuma; sem número, sem marca.
3. Trança (256 × 128, repetível) para o cabo do lais e o cordão do apito: cor branca (tingida pela cor por vértice) +
   normal das pernas da trança em espinha de peixe.
"""
import math

import numpy as np

import prop_vela_base as B
import prop_vela_bone as BONE

AC = B.lin('#2e8fd6')             # acento (fita), levemente menos saturado que #2ea8ff para ser material real


def _uv_grade(h, w):
    v, u = np.mgrid[0:h, 0:w]
    return (u + 0.5) / w, (v + 0.5) / h


def _faixa(d, largura):
    return np.clip(1 - np.abs(d) / largura, 0, 1)


def bone(pasta, circ):
    """circ(v) → comprimento (m) do anel horizontal da copa na altura v da grade (0 faixa, 1 ápice)."""
    N = 1024
    U, V = _uv_grade(N, N)
    base = B.lin('#4f6176')                 # azul-marinho lavado (sarja desbotada de sol e sal)
    cor = np.ones((N, N, 3)) * base
    alt = np.zeros((N, N))
    rn = B.ruido(N, N, 6, 3)
    sarja = ((np.arange(N)[None, :] + np.arange(N)[:, None]) % 4 < 2).astype(float)
    cor *= (0.97 + 0.05 * rn)[..., None] * (0.985 + 0.02 * sarja)[..., None]
    alt += 0.15 * sarja
    # ---- copa: V 0,005..0,626 ↔ v 0..1
    copa = V < 0.63
    v = np.clip((V - 0.005) / (0.64 * 0.97), 0, 1)
    u = U * 2 * math.pi - math.pi
    circ_v = np.vectorize(circ)(np.linspace(0, 1, 64))
    C = np.interp(v, np.linspace(0, 1, 64), circ_v)
    sol = np.clip((v - 0.35) / 0.65, 0, 1) ** 1.5 * (0.7 + 0.3 * B.ruido(N, N, 3, 5))
    cor = cor * (1 - 0.22 * sol[..., None]) + 0.22 * sol[..., None] * B.lin('#8797a8')
    gomo = np.floor(((u + math.pi) % (2 * math.pi)) / (2 * math.pi) * 6 + 0.5) % 2       # desbote alternado
    cor *= (1 + 0.035 * (gomo - 0.5) * copa)[..., None]
    for c0 in BONE.COSTURAS:
        du = ((u - c0 + math.pi) % (2 * math.pi) - math.pi) * C / (2 * math.pi)       # metros ao longo do anel
        vala = _faixa(du, 0.0016) * copa
        alt -= 0.9 * vala
        cor *= (1 - 0.30 * vala)[..., None]
        for lado in (-1, 1):
            linha = _faixa(du - lado * 0.0030, 0.00045) * copa
            tracejo = (np.sin(v * 0.30 / 0.0028 * math.pi) > -0.3)
            p = linha * tracejo * (v < 0.97)
            cor = cor * (1 - 0.55 * p[..., None]) + 0.55 * p[..., None] * B.lin('#aeb8c2')
            alt -= 0.35 * p
    # Ilhoses bordados: um por gomo lateral, no centro do gomo, v ≈ 0,62.
    for c0 in (0.55, 1.59, -0.55, -1.59, 2.6, -2.6):
        du = ((u - c0 + math.pi) % (2 * math.pi) - math.pi) * C / (2 * math.pi)
        dv = (v - 0.62) * 0.11
        r = np.sqrt(du ** 2 + dv ** 2)
        anel = _faixa(r - 0.0021, 0.0008) * copa
        furo = (r < 0.0012) * copa
        cor = cor * (1 - 0.55 * anel[..., None]) + 0.55 * anel[..., None] * B.lin('#aeb8c2')
        cor *= (1 - 0.75 * furo)[..., None]
        alt += 0.6 * anel - 0.8 * furo
    # Linha de sal perto da faixa (irregular) e a faixa interna mais escura na borda.
    sal = _faixa(v - (0.10 + 0.03 * B.ruido(N, N, 5, 8)), 0.012) * copa
    cor = cor * (1 - 0.12 * sal[..., None]) + 0.12 * sal[..., None] * B.lin('#e3ded3')
    cor *= (1 - 0.25 * (v < 0.018) * copa)[..., None]
    # Tira traseira de fita (acento) sob o arco: u ≈ π, v < 0,085.
    tira = (np.abs((u - math.pi + math.pi) % (2 * math.pi) - math.pi) < BONE.ABERTURA[2] + 0.02) * (v < 0.085) * copa
    cor = np.where(tira[..., None] > 0, AC * (0.9 + 0.1 * rn[..., None]), cor)      # fita traseira (acento)
    # ---- aba: V 0,68..0,98 ↔ t 0..1, U 0,02..0,98 ↔ s −1..1
    aba = (V > 0.675) & (V < 0.985)
    s = np.clip((U - 0.02) / 0.96 * 2 - 1, -1, 1)
    t = np.clip((V - 0.68) / 0.30, 0, 1)
    comp = BONE.ABA_L * np.maximum(1e-3, 1 - np.abs(s) ** 2.0) ** 0.62          # o mesmo de prop_vela_bone.aba
    d_borda = (1 - t) * comp                                   # metros até a borda
    for k in range(8):
        p = _faixa(d_borda - (0.0045 + k * 0.0042), 0.00045) * aba * (d_borda < comp - 0.004)
        cor = cor * (1 - 0.50 * p[..., None]) + 0.50 * p[..., None] * B.lin('#aeb8c2')
        alt -= 0.4 * p
    fita = (d_borda < 0.0024) * aba
    cor = np.where(fita[..., None] > 0, B.lin('#cfd6dc') * 0.95, cor)      # viés claro na borda da aba
    gasto = _faixa(d_borda, 0.006) * aba
    cor *= (1 - 0.10 * gasto * B.ruido(N, N, 12, 9))[..., None]
    cor = np.clip(cor, 0, 0.93)
    img = B.imagem('vela_bone_cor', cor, pasta, qualidade=78)
    a = B.ruido(512, 512, 8, 1) * 0.0
    alt_s = alt.reshape(512, 2, 512, 2).mean((1, 3)) + a
    nrm = B.normal_de_altura(alt_s, 1.6)
    return img, B.imagem('vela_bone_normal', nrm, pasta, qualidade=88)


def velas(pasta):
    H, W = 512, 1024
    U, V = _uv_grade(H, W)
    cor = np.ones((H, W, 3)) * B.lin('#ebe6dc')
    rn = B.ruido(H, W, 10, 21)
    cor *= (0.975 + 0.04 * rn)[..., None]

    def lado(esq):
        c = np.clip((U - (0 if esq else 0.5)) / 0.5, 0, 1)
        m = (U < 0.5) if esq else (U >= 0.5)
        return c, V, m
    for esq in (True, False):
        c, h, m = lado(esq)
        n_pan = 6 if esq else 4
        for k in range(1, n_pan + 1):                          # costuras do corte cruzado (perpendiculares à valuma)
            hk = k / (n_pan + 1) + 0.06 * (1 - c) - 0.03
            p = _faixa(h - hk, 0.0028) * m
            cor *= (1 - 0.10 * p)[..., None]
            p2 = _faixa(h - hk - 0.004, 0.0012) * m
            cor *= (1 - 0.08 * p2)[..., None]
        cor *= (1 - 0.10 * (c > 0.985) * m)[..., None]         # fita da valuma
        cor *= (1 - 0.06 * (c < 0.025) * m)[..., None]          # gurutil
        for (cc, hh, r) in ((0, 0, 0.14), (1, 0, 0.14), (0, 1, 0.10)) if esq else ((0, 0, 0.12), (1, 0, 0.12),
                                                                                    (1, 1, 0.14), (0, 1, 0.10)):
            d = np.sqrt(((c - cc) * 1.0) ** 2 + ((h - hh) * 1.6) ** 2)
            cor *= (1 - 0.06 * (d < r) * m)[..., None]
            cor *= (1 - 0.08 * _faixa(d - r, 0.004) * m)[..., None]
        if esq:
            for hb in (0.30, 0.52, 0.74):                       # bolsas das réguas
                p = (np.abs(h - hb) < 0.009) * (c > 0.70) * m
                cor = cor * (1 - 0.35 * p[..., None]) + 0.35 * p[..., None] * B.lin('#f2efe8')
                cor *= (1 - 0.12 * _faixa(np.abs(h - hb) - 0.009, 0.002) * (c > 0.70) * m)[..., None]
            jan = (c > 0.16) & (c < 0.42) & (h > 0.20) & (h < 0.33) & m
            cor = np.where(jan[..., None], B.lin('#56626c') * (0.9 + 0.2 * rn[..., None]), cor)
            borda = ((np.abs(c - 0.16) < 0.006) | (np.abs(c - 0.42) < 0.006)) & (h > 0.195) & (h < 0.335)
            borda |= ((np.abs(h - 0.20) < 0.004) | (np.abs(h - 0.33) < 0.004)) & (c > 0.155) & (c < 0.425)
            cor = np.where((borda & m)[..., None], B.lin('#d8d3c8'), cor)
        else:
            for k in range(10):                                  # amarrações do gurutil no mastro
                d = np.sqrt((c - 0.018) ** 2 + ((h - (0.05 + k * 0.095)) * 0.5) ** 2)
                cor *= (1 - 0.45 * (d < 0.010) * m)[..., None]
    return B.imagem('vela_vela_cor', np.clip(cor, 0, 0.93), pasta, qualidade=82)


def tranca(pasta):
    """Trança de 16 pernas vista de lado: chevrons alternados em u (ao longo) × v (em volta)."""
    H, W = 128, 256
    U, V = _uv_grade(H, W)
    a = (U * 16 + V * 8) % 1.0
    b = (U * 16 - V * 8) % 1.0
    perna = np.where(((U * 16).astype(int) + (V * 8).astype(int)) % 2 == 0, a, b)
    alt = np.sin(perna * math.pi) ** 0.6
    cor = np.dstack([0.78 + 0.18 * alt] * 3)
    return (B.imagem('vela_tranca_cor', cor, pasta, qualidade=88),
            B.imagem('vela_tranca_normal', B.normal_de_altura(alt, 2.5), pasta, qualidade=90))
