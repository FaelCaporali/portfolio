"""Arco do headset (vida `techlead`): lâmina de aço escovado que nasce dentro dos dois deslizadores (trecho aparente
com as marcas gravadas do ajuste), almofada de couro sintético por baixo no topo (costura nas duas bordas, pontas
afinadas que entram no aço). A altura do ápice é resolvida pela folga medida da almofada ao cabelo do S13.

Quadro da varredura (G.quadros com ref = +Z do glb): N = +Z (largura da lâmina), B = T × Z = para dentro da cabeça.
"""
import math

import numpy as np

import prop_techlead_encaixe as E
import prop_techlead_geo as G
import prop_techlead_material as MT

LARG = G.R(18.0)                        # largura da lâmina
ESP = G.R(1.8)                          # espessura da lâmina
DENTRO = G.R(10.0)                      # quanto a lâmina entra no deslizador
APARENTE = G.R(16.0)                    # trecho com as marcas do ajuste, acima do deslizador
ALM_COMP = G.R(150.0)                   # comprimento da almofada
ALM_LARG = G.R(24.0)
ALM_ESP = G.R(8.0)


def _secao_almofada(n_lado=3, n_face=4):
    """Seção da almofada (a em N = largura, b em B = para dentro), começando na face do aço; zonas por índice:
    [(j0, j1, célula)] — costura nas duas quinas de dentro."""
    hw, e0 = ALM_LARG / 2, ESP / 2 - G.R(0.3)
    pts = []
    for f in np.linspace(-math.pi, math.pi, 4 * (n_lado + n_face) + 1)[:-1]:
        c, s = math.cos(f), math.sin(f)
        a = hw * np.sign(c) * abs(c) ** (2 / 3.4)
        b = e0 + ALM_ESP / 2 + ALM_ESP / 2 * np.sign(s) * abs(s) ** (2 / 2.6)
        pts.append((a, b, f))
    return pts


def _faixas(M, P, zonas, uv):
    """P[i][j] com a seção fechada (a coluna 0 repetida no fim); zonas = [(j0, j1, célula)] cobrindo 0..nj."""
    P = np.concatenate([P, P[:, :1]], 1)
    for j0, j1, cel in zonas:
        M.grade(P[:, j0:j1 + 1], MT.ilha(cel), uv=uv(cel, j0, j1, P.shape[1] - 1) if uv else None)


def linha(enc, conchas, relatorio):
    """Linha de centro da lâmina (do fundo do deslizador D ao fundo do E), com o ápice resolvido pela folga."""
    S = {s: conchas[s]['S'] for s in (-1, 1)}
    U = {s: conchas[s]['U'] for s in (-1, 1)}

    def folga(pts):
        Q = G.quadros(pts, (0, 0, 1))
        s = G.comprimento(pts)
        meio = s[-1] / 2
        dmin = 9.0
        for p, (t, n, b), sk in zip(pts, Q, s):
            if abs(sk - meio) > ALM_COMP / 2 - G.R(12):
                continue
            for a in (-ALM_LARG * 0.35, 0.0, ALM_LARG * 0.35):
                dmin = min(dmin, enc.perto(p + n * a + b * (ESP / 2 + ALM_ESP))[2])
        return dmin

    pts, ya, rel = enc.arco(S, U, folga_fn=folga)
    relatorio['arco_apice_y'] = round(ya, 4)
    relatorio['arco_iteracoes_y_folga_mm'] = rel
    ini = [S[-1] - U[-1] * DENTRO * k for k in (1.0, 0.5)]
    fim = [S[1] - U[1] * DENTRO * k for k in (0.5, 1.0)]
    return np.concatenate([ini, pts, fim])


def construir(enc, conchas, materiais, relatorio):
    pts = G.reamostrar(linha(enc, conchas, relatorio), 97)
    s = G.comprimento(pts)
    L = s[-1]
    Q = G.quadros(pts, (0, 0, 1))
    M = G.Malha()
    sec = G.sec_ret(LARG, ESP, G.R(0.7), 2)
    P = np.array([[p + n * a + b * c for a, c in sec] for p, (t, n, b) in zip(pts, Q)])
    lim = DENTRO + APARENTE
    i0 = int(np.searchsorted(s, lim))
    i1 = int(np.searchsorted(s, L - lim))
    for a, b, cel in ((0, i0, 'escala'), (i0, i1, 'aco'), (i1, len(pts) - 1, 'escala')):
        u0, v0, u1, v1 = MT.ilha(cel)
        sa, sb = s[a], s[b]
        inv = cel == 'escala' and a > 0

        def uv(x, y, u0=u0, v0=v0, u1=u1, v1=v1, sa=sa, sb=sb, inv=inv):
            return (u0 + (u1 - u0) * ((1 - x) if inv else x), v0 + (v1 - v0) * y)
        Pz = np.concatenate([P[a:b + 1], P[a:b + 1, :1]], 1)
        M.grade(Pz, MT.ilha(cel), uv=uv)
    uc = MT.ilha('aco')
    M.leque(P[0][::-1], pts[0], (uc[0], uc[1]))
    M.leque(P[-1], pts[-1], (uc[0], uc[1]))
    # almofada: índices do trecho central
    meio = L / 2
    k0 = int(np.searchsorted(s, meio - ALM_COMP / 2))
    k1 = int(np.searchsorted(s, meio + ALM_COMP / 2))
    seca = _secao_almofada()
    nk = k1 - k0
    A = []
    for k in range(k0, k1 + 1):
        x = (k - k0) / nk
        e = min(1.0, min(x, 1 - x) / 0.07)
        e = 0.35 + 0.65 * e * e * (3 - 2 * e)
        p, (t, n, b) = pts[k], Q[k]
        A.append([p + n * a * (0.75 + 0.25 * e) + b * (ESP / 2 + (c - ESP / 2) * e) for a, c, f in seca])
    A = np.array(A)
    nj = len(seca)
    fs = np.array([f for a, c, f in seca])
    j_a = int(np.argmin(np.abs(fs - math.radians(26))))            # costura na quina de dentro (lado +Z)
    j_b = int(np.argmin(np.abs(fs - math.radians(46))))
    j_c = int(np.argmin(np.abs(fs - math.radians(134))))           # e na do lado −Z
    j_d = int(np.argmin(np.abs(fs - math.radians(154))))
    zonas = [(0, j_a, 'couro_arco'), (j_a, j_b, 'costura_arco'), (j_b, j_c, 'couro_arco'),
             (j_c, j_d, 'costura_arco'), (j_d, nj, 'couro_arco')]
    _faixas(M, A, zonas, None)
    uc = MT.ilha('couro_arco')
    M.leque(A[0][::-1], A[0].mean(0), (uc[0], uc[1]))
    M.leque(A[-1], A[-1].mean(0), (uc[0], uc[1]))
    apice = pts[int(np.argmax(pts[:, 1]))]
    ob = M.objeto('tl_arco', [materiais[0]], origem=apice)
    relatorio['arco_comprimento_m'] = round(L, 4)
    relatorio['almofada_arco_comp_m'] = round(float(s[k1] - s[k0]), 4)
    return ob, {'apice': apice, 'pts': pts, 'folga_alvo_mm': E.FOLGA_ARCO * 1000}
