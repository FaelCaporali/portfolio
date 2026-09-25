"""Folha de contato de uma sequência do `captura_prop.mjs sequencia` (quadros rotulados pelo t desde a montagem).
Uso: python3 3d/tools/props/folha_seq.py <pasta> <prefixo> <saida.png> [t1 t2 ...] [--rotulo=t:texto ...]
  [--recorte=x,y,w,h] (recorte ampliado de cada quadro, em px do quadro)
  <prefixo> é o começo do nome dos quadros (ex.: `anim-seq-` para anim-seq-0.25s.png). Sem tempos: todos os quadros.
  Largura fixa de 1568 px (4 colunas), dentro do limite de leitura da folha."""
import glob
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont

W, COLS = 1568, 4


def main(argv):
    corte = next((tuple(map(int, a[len('--recorte='):].split(','))) for a in argv if a.startswith('--recorte=')), None)
    argv = [a for a in argv if not a.startswith('--recorte=')]
    pos = [a for a in argv if not a.startswith('--rotulo=')]
    rotulos = dict(a[len('--rotulo='):].split(':', 1) for a in argv if a.startswith('--rotulo='))
    pasta, prefixo, saida, tempos = pos[0], pos[1], pos[2], pos[3:]
    if not tempos:
        achados = glob.glob(os.path.join(pasta, f'{prefixo}*s.png'))
        tempos = sorted({re.search(r'(\d+\.\d+)s\.png$', f).group(1) for f in achados}, key=float)
    try:
        fonte = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
    except OSError:
        fonte = ImageFont.load_default()
    cel = W // COLS
    quadros = []
    for t in tempos:
        im = Image.open(os.path.join(pasta, f'{prefixo}{t}s.png')).convert('RGB')
        if corte:  # recorte ampliado (x, y, largura, altura em px do quadro)
            x, y, w, h = corte
            im = im.crop((x, y, x + w, y + h))
        im = im.resize((cel, round(im.height * cel / im.width)))
        d = ImageDraw.Draw(im)
        d.rectangle([0, 0, cel, 26], fill=(0, 0, 0))
        d.text((6, 3), f't {t.replace(".", ",")} s  {rotulos.get(t, "")}', fill=(255, 255, 255), font=fonte)
        quadros.append(im)
    h = quadros[0].height
    linhas = (len(quadros) + COLS - 1) // COLS
    folha = Image.new('RGB', (W, linhas * h), (24, 24, 24))
    for i, im in enumerate(quadros):
        folha.paste(im, ((i % COLS) * cel, (i // COLS) * h))
    folha.save(saida)
    print(saida, folha.size, len(quadros), 'quadros')


if __name__ == '__main__':
    main(sys.argv[1:])
