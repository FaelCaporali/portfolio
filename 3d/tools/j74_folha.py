"""Folha de contato J74: as 8 telas de uma vida (rótulo antes|depois), cada uma reduzida à mesma altura, com rótulo.
Uso: python3 3d/tools/j74_folha.py <vida> <rotulo> [largura_max=1568]"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

DIR = Path('3d/captura/j74')
TELAS = ['320x568', '360x780', '390x844', '800x360', '768x1024', '1280x800', '1440x900', '1920x1080']


def main():
    vida, rotulo = sys.argv[1], sys.argv[2]
    larg = int(sys.argv[3]) if len(sys.argv) > 3 else 1568
    ims = []
    for t in TELAS:
        p = DIR / f'{vida}-{t}-{rotulo}.png'
        if p.exists():
            ims.append((t, Image.open(p).convert('RGB')))
    alt = 420
    fila, filas, x = [], [], 0
    for t, im in ims:
        w = round(im.width * alt / im.height)
        im = im.resize((w, alt))
        if x + w > larg and fila:
            filas.append(fila)
            fila, x = [], 0
        fila.append((t, im))
        x += w + 6
    if fila:
        filas.append(fila)
    folha = Image.new('RGB', (larg, len(filas) * (alt + 22)), (20, 20, 20))
    d = ImageDraw.Draw(folha)
    for i, f in enumerate(filas):
        x = 0
        for t, im in f:
            folha.paste(im, (x, i * (alt + 22) + 20))
            d.text((x + 4, i * (alt + 22) + 4), f'{vida} {t} {rotulo}', fill=(255, 220, 90))
            x += im.width + 6
    folha.save(DIR / f'folha-{vida}-{rotulo}.png')


main()
