"""Utilitários de imagem da vela (numpy puro): ruído periódico, normal a partir de altura, cor hex → sRGB 0..1."""
import numpy as np


def ruido(h, w, escala, semente, oitavas=4):
    """Ruído de valor fractal periódico (0..1), para rugosidade e desgaste sem costura."""
    rng = np.random.default_rng(semente)
    out = np.zeros((h, w))
    amp, tot = 1.0, 0.0
    for o in range(oitavas):
        gy, gx = max(2, int(escala * 2 ** o * h / w)), max(2, int(escala * 2 ** o))
        g = rng.random((gy, gx))
        yy = np.linspace(0, gy, h, endpoint=False)
        xx = np.linspace(0, gx, w, endpoint=False)
        y0, x0 = np.floor(yy).astype(int), np.floor(xx).astype(int)
        fy, fx = (yy - y0)[:, None], (xx - x0)[None, :]
        fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
        a = g[y0 % gy][:, x0 % gx]
        b = g[y0 % gy][:, (x0 + 1) % gx]
        c = g[(y0 + 1) % gy][:, x0 % gx]
        d = g[(y0 + 1) % gy][:, (x0 + 1) % gx]
        out += amp * ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy)
        tot += amp
        amp *= 0.5
    return out / tot


def normal_de_altura(hmap, forca):
    """Mapa normal tangente (OpenGL, Y+) de um campo de altura periódico."""
    dx = (np.roll(hmap, -1, 1) - np.roll(hmap, 1, 1)) * 0.5 * forca
    dy = (np.roll(hmap, -1, 0) - np.roll(hmap, 1, 0)) * 0.5 * forca
    n = np.dstack((-dx, -dy, np.ones_like(hmap)))
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


def lin(hexcor):
    """hex sRGB → tupla sRGB 0..1 (para pintar imagens, que ficam em sRGB)."""
    h = hexcor.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
