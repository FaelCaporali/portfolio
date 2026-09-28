"""Material da prancheta da vida `devops` (receita única forma + material, como o FullStack).

`arq_rigido`: cor = atlas × cor por vértice 'Col'; ORM de regiões (G rugosidade com ruído, B metal). Atlas 1024 × 512:
metade esquerda = folheado de madeira clara (maple) do tampo, mapeado UMA vez no tampo inteiro (sem repetição); metade
direita = graduações do escalímetro (duas faixas), alumínio escovado da régua e células de apoio.
`arq_papel`: a folha da planta, azul-blueprint liso, sem textura (o site desenha a planta por canvas na UV 0–1).
"""
import os
import subprocess

import bpy
import numpy as np

import prop_financeiro_v6 as v6
import prop_vela_base as B
import tempfile

TMP = tempfile.gettempdir()     # respeita o TMPDIR
AZUL = '#1d4a85'                     # azul-blueprint (cianotipia), base da folha
# Células do atlas (u0, v0, u1, v1) e margem interna (fração da célula: ≥ 4 px no ORM de 256 × 128).
CEL = {'madeira': (0.0, 0.0, 0.5, 1.0), 'escala1': (0.5, 0.875, 1.0, 1.0), 'escala2': (0.5, 0.75, 1.0, 0.875),
       'aluminio': (0.5, 0.5, 0.625, 0.75), 'aco': (0.625, 0.5, 0.75, 0.75), 'plastico': (0.75, 0.5, 0.875, 0.75),
       'borracha': (0.875, 0.5, 1.0, 0.75), 'fita': (0.5, 0.25, 0.625, 0.5), 'grafite': (0.625, 0.25, 0.75, 0.5),
       'borda': (0.75, 0.25, 0.875, 0.5), 'branco': (0.875, 0.25, 1.0, 0.5), 'regua': (0.5, 0.0, 1.0, 0.25)}
MARGEM = {'madeira': 0.012, 'escala1': 0.02, 'escala2': 0.02, 'regua': 0.03}
# (rugosidade, variação, metal)
ORM = {'madeira': (0.56, 0.10, 0), 'escala1': (0.46, 0.04, 0), 'escala2': (0.46, 0.04, 0), 'aluminio': (0.36, 0.06, 1),
       'aco': (0.30, 0.06, 1), 'plastico': (0.50, 0.06, 0), 'borracha': (0.86, 0.05, 0), 'fita': (0.90, 0.05, 0),
       'grafite': (0.42, 0.05, 0), 'borda': (0.64, 0.08, 0), 'branco': (0.52, 0.05, 0), 'regua': (0.34, 0.07, 1)}
DIG = {'0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
       '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001001001',
       '8': '111101111101111', '9': '111101111001111', ':': '000010000010000'}


def ilha(reg):
    u0, v0, u1, v1 = CEL[reg]
    m = MARGEM.get(reg, 0.12)
    du, dv = (u1 - u0) * m, (v1 - v0) * m
    if reg in ('escala1', 'escala2', 'regua'):
        du = (u1 - u0) * 0.01
    return (u0 + du, v0 + dv, u1 - du, v1 - dv)


def uv_cel(bm, faces, reg, f):
    """UV na célula `reg` (com margem): f(co) → (s, t) em 0..1."""
    cam = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
    u0, v0, u1, v1 = ilha(reg)
    for fc in faces:
        for lp in fc.loops:
            s, t = f(lp.vert.co)
            lp[cam].uv = (u0 + (u1 - u0) * min(max(s, 0), 1), v0 + (v1 - v0) * min(max(t, 0), 1))
    return faces


def uv_reg(bm, faces, reg, escala=40.0):
    """Projeção de caixa dentro da célula (ruído de rugosidade sem costura)."""
    B.uv_caixa(bm, faces, escala, ilha(reg))
    return faces


# ------------------------------------------------------------------------------------------------------ imagens
def imagem(nome, rgb, pasta, qualidade=90):
    """numpy (h, w, 3) em sRGB, linha 0 = v 0 → WebP em `pasta` → imagem do Blender (bytes embutidos como estão)."""
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


def _px(reg, h, w):
    u0, v0, u1, v1 = CEL[reg]
    return int(v0 * h), int(v1 * h), int(u0 * w), int(u1 * w)


def madeira(h, w):
    """Folheado de maple: veios ao longo de u (largura do tampo), anéis ondulados, fibras finas e manchas suaves."""
    y, x = np.mgrid[0:h, 0:w] / float(w)
    torcao = B.ruido(h, w, 3, 71) - 0.5
    aneis = np.sin(2 * np.pi * (y * 13.0 + 0.55 * torcao + 0.08 * np.sin(2 * np.pi * x * 1.3)))
    tardio = np.clip(aneis, 0, 1) ** 6
    fibra = B.ruido(h, max(8, w // 24), 6, 72, oitavas=3)
    fibra = np.repeat(fibra, int(np.ceil(w / fibra.shape[1])), axis=1)[:, :w]
    mancha = B.ruido(h, w, 2, 73)
    claro, escuro = B.lin('#e2cca6'), B.lin('#c29c6c')
    t = np.clip(0.18 + 0.45 * tardio + 0.22 * (fibra - 0.5) + 0.25 * (mancha - 0.5), 0, 1)[..., None]
    return claro * (1 - t) + escuro * t


def escala(img, reg, rotulo, passo_num):
    """Graduação de um escalímetro de 150 mm: traço por mm, médio a 5, longo a 10; números a cada `passo_num` mm."""
    y0, y1, x0, x1 = _px(reg, *img.shape[:2])
    img[y0:y1, x0:x1] = B.lin('#f3f2ec')
    u0, _, u1, _ = ilha(reg)
    larg = img.shape[1]
    alt = y1 - y0
    for mm in range(0, 151):
        px = int(round((u0 + (u1 - u0) * (mm / 150.0)) * larg))
        comp = alt * (0.42 if mm % 10 == 0 else 0.28 if mm % 5 == 0 else 0.16)
        img[y0 + 3:y0 + 3 + int(comp), px:px + 1] = B.lin('#1a1a1a')
        if mm % passo_num == 0 and 0 < mm < 150:
            _texto(img, str(mm // passo_num if passo_num == 10 else mm // 10), px, y0 + int(alt * 0.50), 2)
    _texto(img, rotulo, int((u0 + 0.004) * larg) + 6, y0 + int(alt * 0.72), 2)


def _texto(img, s, cx, y, k):
    """Dígitos 3 × 5 (escala k), centrados em cx, base em y (v cresce para cima: a linha 0 do glifo fica em cima)."""
    w = (4 * len(s) - 1) * k
    x = cx - w // 2
    for ch in s:
        g = DIG.get(ch)
        if g:
            for r in range(5):
                for c in range(3):
                    if g[r * 3 + c] == '1':
                        img[y + (4 - r) * k:y + (5 - r) * k, x + c * k:x + (c + 1) * k] = B.lin('#1a1a1a')
        x += 4 * k


def atlas_cor():
    h, w = 512, 1024
    img = np.ones((h, w, 3))
    y0, y1, x0, x1 = _px('madeira', h, w)
    img[y0:y1, x0:x1] = madeira(y1 - y0, x1 - x0)
    for reg in ('aluminio', 'aco', 'plastico', 'borracha', 'grafite', 'branco'):
        a, b, c, d = _px(reg, h, w)
        img[a:b, c:d] = (0.965 + 0.035 * B.ruido(b - a, d - c, 4, 80 + len(reg)))[..., None]
    a, b, c, d = _px('fita', h, w)                                    # crepe: rugas finas transversais
    crepe = B.ruido(b - a, max(4, (d - c) // 16), 5, 91)
    crepe = np.repeat(crepe, int(np.ceil((d - c) / crepe.shape[1])), axis=1)[:, :d - c]
    img[a:b, c:d] = (0.93 + 0.07 * crepe)[..., None]
    a, b, c, d = _px('borda', h, w)                                   # borda do compensado: lâminas finas
    lam = 0.5 + 0.5 * np.sin(np.linspace(0, 2 * np.pi * 9, b - a))[:, None] * np.ones((1, d - c))
    img[a:b, c:d] = B.lin('#e6d3b3') * (0.9 + 0.1 * lam)[..., None]
    a, b, c, d = _px('regua', h, w)                                   # alumínio escovado ao longo de u
    esc = B.ruido(b - a, max(4, (d - c) // 32), 8, 95)
    esc = np.repeat(esc, int(np.ceil((d - c) / esc.shape[1])), axis=1)[:, :d - c]
    img[a:b, c:d] = (0.90 + 0.10 * esc)[..., None]
    escala(img, 'escala1', '1:100', 10)
    escala(img, 'escala2', '1:50', 20)
    return img


def atlas_orm():
    h, w = 128, 256
    img = np.ones((h, w, 3))
    for k, (reg, (base, var, metal)) in enumerate(ORM.items()):
        a, b, c, d = _px(reg, h, w)
        r = B.ruido(b - a, d - c, 4, 40 + k)
        img[a:b, c:d, 1] = np.clip(base + var * (r - 0.5) * 2, 0.05, 1)
        img[a:b, c:d, 2] = metal
    return img


def materiais(pasta):
    rig = B.material('arq_rigido', 1.0, 1.0, cor_base=imagem('arq_rigido_cor', atlas_cor(), pasta, 88),
                     orm=imagem('arq_rigido_orm', atlas_orm(), pasta, 92))
    papel = B.material('arq_papel', 0.0, 0.9, vcor=False)
    b = next(n for n in papel.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = v6.srgb(AZUL)
    return rig, papel
