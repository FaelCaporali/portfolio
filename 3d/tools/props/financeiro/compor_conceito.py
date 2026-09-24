"""Folhas das miniaturas de conceito sobre a captura real do site, no tamanho real (diretor de arte, E1 da v7).

Uso: /data/venv-face/bin/python 3d/tools/props/financeiro/compor_conceito.py <pasta> [opcoes]
  <pasta>  : a mesma de conceito.py (tem base-<tela>.png, sil/, notan/)
  [opcoes] : ex.: M1,M2,...; a v6 entra sempre à esquerda (máscara da E0 em v7/ferramental).

Grava em <pasta>/folhas/: `site-<tela>.png` (silhuetas em cinza claro chapado sobre o site, 1 px de tela = 1 px),
`branco-<tela>.png` (preto sobre branco, busto cinza) e `notan-<tela>.png` (3 valores sobre o site).
"""

import os
import sys

import cv2
import numpy as np

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
V6 = os.path.join(RAIZ, '3d/captura/props/financeiro/v7/ferramental')
# Recorte (px CSS) que cobre cabeça + zona da peça; multiplicado pela densidade da captura.
RECORTES = {'1440x900': ((780, 60, 1440, 720), 1), '1024x768': ((540, 90, 1024, 590), 1),
            '360x740': ((0, 40, 360, 350), 2)}
TOM = 200  # cinza claro chapado da silhueta sobre o fundo escuro do site


def rotulo(img, texto):
    out = img.copy()
    cv2.rectangle(out, (0, 0), (out.shape[1], 26), (20, 20, 20), -1)
    cv2.putText(out, texto, (6, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (235, 235, 235), 1, cv2.LINE_AA)
    return out


def mascara_opcao(pasta, op, tela):
    s = cv2.imread(os.path.join(pasta, 'sil', f'{op}-{tela}.png'))
    return s.max(axis=2) < 40


def mascara_v6(tela, k):
    s = cv2.imread(os.path.join(V6, f'v6-{tela}-silhueta.png'))
    m = s.max(axis=2) < 40
    return cv2.resize(m.astype(np.uint8), None, fx=k, fy=k, interpolation=cv2.INTER_NEAREST) > 0


def notan(base, pasta, op, tela):
    n = cv2.imread(os.path.join(pasta, 'notan', f'{op}-{tela}.png'), cv2.IMREAD_UNCHANGED)
    rgb, a = n[..., :3], n[..., 3] > 0
    chave = (rgb[..., 0] > 200) & (rgb[..., 1] < 60) & (rgb[..., 2] > 200)
    m = a & ~chave
    out = base.copy()
    out[m] = rgb[m]
    return out


def folha(pasta, tela, opcoes):
    (x0, y0, x1, y1), k = RECORTES[tela]
    base = cv2.imread(os.path.join(pasta, f'base-{tela}.png'))
    corte = (slice(y0 * k, y1 * k), slice(x0 * k, x1 * k))
    site, branco, nt = [], [], []
    for op in ['v6', *opcoes]:
        m = mascara_v6(tela, k) if op == 'v6' else mascara_opcao(pasta, op, tela)
        a = base.copy()
        a[m] = TOM
        site.append(rotulo(a[corte], op))
        b = np.full_like(base, 255)
        if op != 'v6':
            s = cv2.imread(os.path.join(pasta, 'sil', f'{op}-{tela}.png'))
            b = s
        else:
            b[m] = 0
        branco.append(rotulo(b[corte], op))
        if op != 'v6':
            nt.append(rotulo(notan(base, pasta, op, tela)[corte], op))
    dest = os.path.join(pasta, 'folhas')
    os.makedirs(dest, exist_ok=True)
    cv2.imwrite(os.path.join(dest, f'site-{tela}.png'), np.hstack(site))
    cv2.imwrite(os.path.join(dest, f'branco-{tela}.png'), np.hstack(branco))
    cv2.imwrite(os.path.join(dest, f'notan-{tela}.png'), np.hstack(nt))


def comparacao(pasta, tela, op):
    """ESTUDIO §5: anterior em cima (v6 real no site), nova embaixo (notan da opção sobre o site), mesmos pixels."""
    (x0, y0, x1, y1), k = RECORTES[tela]
    corte = (slice(y0 * k, y1 * k), slice(x0 * k, x1 * k))
    v6 = cv2.imread(os.path.join(RAIZ, '3d/captura/props/financeiro', f'v6-{tela}.png'))
    base = cv2.imread(os.path.join(pasta, f'base-{tela}.png'))
    cima, baixo = rotulo(v6[corte], 'v6 (site)'), rotulo(notan(base, pasta, op, tela)[corte], f'{op} (notan)')
    cv2.imwrite(os.path.join(pasta, f'comparacao-v6-{op}-{tela}.png'), np.vstack([cima, baixo]))


def main():
    pasta = os.path.join(RAIZ, sys.argv[1])
    opcoes = sys.argv[2].split(',') if len(sys.argv) > 2 else ['M1', 'M2', 'M3', 'M4', 'M5', 'M6']
    comparar = next((a.split('=', 1)[1] for a in sys.argv[3:] if a.startswith('--comparar=')), None)
    for tela in RECORTES:
        folha(pasta, tela, opcoes)
        if comparar:
            comparacao(pasta, tela, comparar)


main()
