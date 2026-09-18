"""python3 tools/npc01_sheet.py <out.jpg> <cols> <legenda|caminho.png> ... — monta folha de contato com legendas."""
import sys; from PIL import Image, ImageDraw, ImageFont
out, cols = sys.argv[1], int(sys.argv[2]); items = sys.argv[3:]
cells = []
for it in items:
    lab, path = it.split('|') if '|' in it else ('', it)
    try: im = Image.open(path).convert('RGB')
    except Exception: im = Image.new('RGB', (400, 400), (60, 60, 60))
    cells.append((lab, im))
h = 520; cells = [(l, im.resize((int(im.width * h / im.height), h))) for l, im in cells]
cw = max(im.width for _, im in cells); rows = (len(cells) + cols - 1) // cols
sheet = Image.new('RGB', (cw * cols, (h + 26) * rows), (30, 30, 30)); d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
except Exception: font = ImageFont.load_default()
for i, (l, im) in enumerate(cells):
    x, y = (i % cols) * cw, (i // cols) * (h + 26); sheet.paste(im, (x + (cw - im.width) // 2, y + 26)); d.text((x + 6, y + 5), l, fill=(240, 240, 240), font=font)
sheet.save(out, quality=88); print('folha', out, sheet.size)
