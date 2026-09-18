"""python3 tools/npc01_vsfotos.py <tmpdir> — NPC ao lado das fotos ref-15 (frente), ref-12 (perfil D), ref-11 (3/4 D), rosto recortado no mesmo enquadramento."""
import sys; from PIL import Image
T = sys.argv[1]; R = 'referencias/upload-02/'
def crop(path, box):
    im = Image.open(path).convert('RGB'); w, h = im.size; return im.crop((int(w * box[0]), int(h * box[1]), int(w * box[2]), int(h * box[3])))
pairs = [('ref-15 frente', crop(R + 'ref-15.jpg', (0.10, 0.12, 0.78, 0.80)), 'NPC frente', Image.open(T + '/v_front.png')),
         ('ref-12 perfil D', crop(R + 'ref-12.jpg', (0.05, 0.10, 0.85, 0.85)), 'NPC perfil D', Image.open(T + '/v_profileR.png')),
         ('ref-11 3/4 D', crop(R + 'ref-11.jpg', (0.10, 0.10, 0.85, 0.85)), 'NPC 3/4 D', Image.open(T + '/v_q34R.png'))]
h = 560; cells = []
for a, ia, b, ib in pairs:
    for lab, im in ((a, ia), (b, ib)): cells.append((lab, im.convert('RGB').resize((int(im.width * h / im.height), h))))
from PIL import ImageDraw, ImageFont
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
W = sum(c.width for _, c in cells); sheet = Image.new('RGB', (W, h + 26), (30, 30, 30)); d = ImageDraw.Draw(sheet); x = 0
for lab, im in cells: sheet.paste(im, (x, 26)); d.text((x + 6, 5), lab, fill=(240, 240, 240), font=font); x += im.width
sheet.save('analise/clay/npc01_vs_fotos.jpg', quality=88); print('folha analise/clay/npc01_vs_fotos.jpg', sheet.size)
