"""python3 tools/clay_sheet.py <sheet.json>  (chamado pelo clay_views.py: monta a grade)"""
import sys, json, os
from PIL import Image, ImageDraw
d = json.load(open(sys.argv[1])); W = 420; nb, nv = len(d['blends']), len(d['views'])
sheet = Image.new('RGB', (W*nv, W*nb + 30), (40, 40, 40)); dr = ImageDraw.Draw(sheet)
dr.text((6, 8), d['label'] + '  |  ' + '  '.join(f"L{i+1}={os.path.basename(b)}" for i, b in enumerate(d['blends'])) + '  |  ' + ' / '.join(d['views']), fill=(255, 255, 255))
for bi, vi, f in d['files']: sheet.paste(Image.open(f).convert('RGB'), (vi*W, 30 + bi*W))
sheet.save(d['out'], quality=90); print('CLAY', d['out'])
