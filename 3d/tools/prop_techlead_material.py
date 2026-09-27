"""Materiais do headset da vida `techlead` (receita única forma + material).

`tl_headset`: um atlas para a peça inteira (1 chamada por nó): cor 1024², normal 512² (grão do couro, costura, poros
da espuma, trama do tecido, escovado do aço, micro textura do plástico fosco) e ORM 256² (G rugosidade, B metal).
`tl_led`: difusor do anel de LED da concha do microfone, emissão no acento da vida (#b388ff); o site anima a força.
"""
import os
import subprocess

import bpy
import numpy as np

import prop_financeiro_v6 as v6
import prop_vela_base as B

TMP = '/home/fael/.claude/jobs/510c5105/tmp'
N = 1024
# células (u0, v0, u1, v1) do atlas
CEL = {'plastico': (0.0, 0.0, 0.25, 0.25), 'acetinado': (0.25, 0.0, 0.5, 0.25), 'aco': (0.5, 0.0, 0.75, 0.25),
       'escala': (0.75, 0.0, 1.0, 0.25), 'couro': (0.0, 0.25, 0.5, 0.5), 'costura': (0.5, 0.25, 1.0, 0.375),
       'costura_arco': (0.5, 0.375, 1.0, 0.5), 'espuma': (0.0, 0.5, 0.25, 0.75), 'tecido': (0.25, 0.5, 0.5, 0.75),
       'borracha': (0.5, 0.5, 0.75, 0.75), 'pino': (0.75, 0.5, 1.0, 0.75), 'couro_arco': (0.0, 0.75, 1.0, 1.0)}
COR = {'plastico': '#1d1e21', 'acetinado': '#25272b', 'aco': '#b4b8bd', 'escala': '#b4b8bd', 'couro': '#18181b',
       'costura': '#18181b', 'costura_arco': '#18181b', 'espuma': '#151517', 'tecido': '#101113',
       'borracha': '#1b1c1e', 'pino': '#2e3035', 'couro_arco': '#18181b'}
ORM = {'plastico': (0.64, 0.05, 0), 'acetinado': (0.44, 0.04, 0), 'aco': (0.30, 0.08, 1), 'escala': (0.32, 0.06, 1),
       'couro': (0.50, 0.08, 0), 'costura': (0.56, 0.06, 0), 'costura_arco': (0.56, 0.06, 0),
       'espuma': (0.96, 0.03, 0), 'tecido': (0.90, 0.04, 0), 'borracha': (0.74, 0.05, 0), 'pino': (0.38, 0.05, 1),
       'couro_arco': (0.50, 0.08, 0)}
LINHA = '#505157'                         # linha da costura (grafite, um tom acima do couro)
PONTOS_COSTURA = 72                       # pontos por volta da almofada (≈ 2,6 mm reais cada)
ACENTO = '#b388ff'


def ilha(reg, px=5):
    """Célula com margem de `px` pixels do atlas de 1024 (≥ 4 px pedidos)."""
    u0, v0, u1, v1 = CEL[reg]
    m = px / N
    return (u0 + m, v0 + m, u1 - m, v1 - m)


def _px(reg, n):
    u0, v0, u1, v1 = CEL[reg]
    return int(v0 * n), int(v1 * n), int(u0 * n), int(u1 * n)


def imagem(nome, rgb, pasta, qualidade=90):
    """numpy (h, w, 3) sRGB 0..1, linha 0 = v 0 → WebP em `pasta` → imagem do Blender (bytes embutidos)."""
    os.makedirs(pasta, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)
    arq = os.path.join(pasta, nome + '.webp')
    a = (np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)
    tmp = os.path.join(TMP, nome + '.npy')
    np.save(tmp, np.ascontiguousarray(a[::-1]))
    cod = ("import numpy as n,sys;from PIL import Image;a=n.load(sys.argv[1]);"
           "Image.fromarray(a,'RGB').save(sys.argv[2],'WEBP',quality=int(sys.argv[3]),method=6)")
    subprocess.run(['python3', '-c', cod, tmp, arq, str(qualidade)], check=True)
    img = bpy.data.images.load(arq, check_existing=False)
    img.name = nome
    return img


def _esticado(h, w, fx, semente, oitavas=3):
    """Ruído alongado ao longo de u (escovado, veio): poucas colunas repetidas em w."""
    r = B.ruido(h, max(4, w // fx), 6, semente, oitavas)
    return np.repeat(r, int(np.ceil(w / r.shape[1])), axis=1)[:, :w]


def alturas_e_cor():
    """Campo de altura (0..1) e cor (sRGB) do atlas inteiro."""
    alt = np.full((N, N), 0.5)
    cor = np.zeros((N, N, 3))
    for reg, hexa in COR.items():
        a, b, c, d = _px(reg, N)
        h, w = b - a, d - c
        base = B.lin(hexa)
        r = B.ruido(h, w, 24, 11 + len(reg))
        k = 1.0 + 0.05 * (r - 0.5)
        hh = 0.5 + 0.05 * (r - 0.5)
        if reg in ('aco', 'escala'):
            e = _esticado(h, w, 96, 31)
            k = 0.93 + 0.12 * e
            hh = 0.5 + 0.25 * (e - 0.5)
        elif reg.startswith('couro') or reg.startswith('costura'):
            g = B.ruido(h, w, 90, 41, 2)
            grao = np.clip((g - 0.5) * 3, -1, 1)
            k = 1.0 + 0.10 * grao
            hh = 0.5 + 0.35 * grao
        elif reg == 'espuma':
            g = B.ruido(h, w, 70, 51, 2)
            poro = g < 0.36
            k = np.where(poro, 0.55, 1.0 + 0.06 * (g - 0.5))
            hh = np.where(poro, 0.1, 0.55 + 0.2 * g)
        elif reg == 'tecido':
            y, x = np.mgrid[0:h, 0:w]
            t = np.sin(x * 2 * np.pi / 6) * np.sin(y * 2 * np.pi / 6)
            k = 1.0 + 0.10 * t
            hh = 0.5 + 0.35 * t
        cor[a:b, c:d] = base * np.asarray(k)[..., None]
        alt[a:b, c:d] = hh
    for reg in ('costura', 'costura_arco'):                       # linha: pontos ao longo de u, sulco no meio de v
        a, b, c, d = _px(reg, N)
        h, w = b - a, d - c
        y, x = np.mgrid[0:h, 0:w]
        vv = np.abs(y / h - 0.5)
        sulco = np.clip(1 - vv / 0.08, 0, 1)
        passo = w / PONTOS_COSTURA
        fase = (x % passo) / passo
        ponto = (vv < 0.07) & (fase > 0.12) & (fase < 0.78)
        alt[a:b, c:d] -= 0.35 * sulco
        alt[a:b, c:d] = np.where(ponto, 0.62, alt[a:b, c:d])
        cor[a:b, c:d] = np.where(ponto[..., None], B.lin(LINHA), cor[a:b, c:d] * (1 - 0.25 * sulco[..., None]))
    a, b, c, d = _px('escala', N)                                  # marcas gravadas do ajuste (a cada 1,5 mm reais)
    h, w = b - a, d - c
    x = np.arange(w)
    marca = (x % 16) < 2
    longa = (x % 80) < 2
    for j in range(h):
        t = j / h
        on = (marca & (t > 0.62)) | (longa & (t > 0.40))
        cor[a + j, c:d][on] *= 0.35
        alt[a + j, c:d][on] -= 0.3
    return alt, cor


def atlas_orm():
    n = 256
    img = np.ones((n, n, 3))
    for k, (reg, (base, var, metal)) in enumerate(ORM.items()):
        a, b, c, d = _px(reg, n)
        r = B.ruido(b - a, d - c, 6, 60 + k)
        if reg in ('aco', 'escala'):
            r = _esticado(b - a, d - c, 24, 61 + k)
        img[a:b, c:d, 1] = np.clip(base + var * (r - 0.5) * 2, 0.05, 1)
        img[a:b, c:d, 2] = metal
    return img


def materiais(pasta):
    alt, cor = alturas_e_cor()
    alt = alt.reshape(N // 2, 2, N // 2, 2).mean((1, 3))            # normal em 512² (o grão lê no close)
    nrm = B.normal_de_altura(alt, 2.0)
    m = B.material('tl_headset', 0.0, 1.0, cor_base=imagem('tl_cor', cor, pasta, 86),
                   orm=imagem('tl_orm', atlas_orm(), pasta, 92), normal=imagem('tl_normal', nrm, pasta, 80),
                   vcor=False, forca_normal=1.0)
    led = bpy.data.materials.new('tl_led')
    led.use_nodes = True
    b = next(n for n in led.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = v6.srgb('#e8e0ff')
    b.inputs['Roughness'].default_value = 0.35
    b.inputs['Emission Color'].default_value = v6.srgb(ACENTO)
    b.inputs['Emission Strength'].default_value = 1.0
    return m, led
