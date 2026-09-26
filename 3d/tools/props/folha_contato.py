"""Folha de contato genérica do pacote de evidência: quadros rotulados em grade de 4 colunas, 1568 px de largura.
Uso: python3 3d/tools/props/folha_contato.py <saida.png> "<imagem>|<rótulo>[|x,y,w,h]" ...
  O recorte opcional é em px da imagem. Linha que começa com "#" vira faixa de título (ex.: "#V8 aula: sequência").
  Imagem ausente vira um quadro cinza com "não obtido" (a falta aparece na folha, não some)."""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

W, COLS, GAP = 1568, 4, 6
TILE = (W - GAP * (COLS + 1)) // COLS


def fonte(tam):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/TTF/DejaVuSans.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, tam)
    return ImageFont.load_default()


def quadro(spec):
    partes = spec.split('|')
    caminho, rotulo = partes[0], partes[1] if len(partes) > 1 else os.path.basename(partes[0])
    if os.path.exists(caminho):
        im = Image.open(caminho).convert('RGB')
        if len(partes) > 2 and partes[2]:
            x, y, w, h = map(int, partes[2].split(','))
            im = im.crop((x, y, x + w, y + h))
    else:
        im = Image.new('RGB', (TILE, TILE * 2 // 3), (60, 60, 60))
        rotulo += ' (não obtido)'
    im = im.resize((TILE, max(1, round(im.height * TILE / im.width))), Image.LANCZOS)
    return im, rotulo


def main(argv):
    saida, specs = argv[0], argv[1:]
    linhas, atual = [], []
    for s in specs:
        if s.startswith('#'):
            if atual:
                linhas.append(('q', atual))
                atual = []
            linhas.append(('t', s[1:]))
            continue
        atual.append(quadro(s))
        if len(atual) == COLS:
            linhas.append(('q', atual))
            atual = []
    if atual:
        linhas.append(('q', atual))
    f, ft = fonte(15), fonte(19)
    alturas = [30 if k == 't' else max(im.height for im, _ in v) + 24 + GAP for k, v in linhas]
    folha = Image.new('RGB', (W, sum(alturas) + GAP), (250, 250, 248))
    d = ImageDraw.Draw(folha)
    y = GAP
    for (k, v), h in zip(linhas, alturas):
        if k == 't':
            d.rectangle((0, y, W, y + 26), fill=(30, 34, 44))
            d.text((10, y + 3), v, fill=(255, 255, 255), font=ft)
        else:
            for i, (im, rot) in enumerate(v):
                x = GAP + i * (TILE + GAP)
                folha.paste(im, (x, y))
                d.text((x + 2, y + im.height + 3), rot, fill=(20, 20, 20), font=f)
        y += h
    folha.save(saida)
    print(f'folha {folha.width}x{folha.height} → {saida}')


if __name__ == '__main__':
    main(sys.argv[1:])
