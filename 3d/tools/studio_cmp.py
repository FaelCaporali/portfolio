"""/data/venv-face/bin/python tools/studio_cmp.py <dir_a> <tag_a> <dir_b> <tag_b> <out.jpg>
Folha de estúdio em duas linhas (anterior em cima, nova embaixo), 4 vistas."""
import sys; from PIL import Image, ImageDraw
da, ta, db, tb, out = sys.argv[1:6]; names = ['front','q_left','q_right','side_right']; h = 500; rows = []
for d, t in ((da, ta), (db, tb)):
    ims = [Image.open(f'{d}/{t}_{n}.png').convert('RGB') for n in names]; rows.append([im.resize((int(im.width*h/im.height), h)) for im in ims])
w = sum(im.width for im in rows[0]); W = Image.new('RGB', (w, 2*h+60), (40,40,40)); dr = ImageDraw.Draw(W)
for r, (row, t) in enumerate(zip(rows, (ta, tb))):
    dr.text((10, r*(h+30)+8), t, fill=(255,255,255)); x = 0
    for im in row: W.paste(im, (x, r*(h+30)+30)); x += im.width
W.save(out, quality=85); print("STUDIO", out)
