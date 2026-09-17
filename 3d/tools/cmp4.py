"""/data/venv-face/bin/python tools/cmp4.py <folha_base.jpg> <prefixo_closeups> <rotulo_novo> <out.jpg>
Folha foto | KIRI-05 cru | nova versão nos 4 ângulos (colunas rotuladas). As duas primeiras colunas vêm da folha base."""
import sys; from PIL import Image, ImageDraw
base_f, pref, label, out = sys.argv[1:5]
S = 450; W = Image.new('RGB', (3*S, 4*S+40), (60,60,60)); dr = ImageDraw.Draw(W)
for c, t in enumerate(['FOTO', 'KIRI-05 CRU', label]): dr.text((c*S+10, 12), t, fill=(255,255,255))
base = Image.open(base_f)
for r, v in enumerate(['front', 'q_left', 'q_right', 'side_right']):
    y = 40 + r*S; W.paste(base.crop((0, y, 2*S, y+S)), (0, y))
    W.paste(Image.open(f'{pref}_{v}.png').convert('RGB').resize((S, S)), (2*S, y))
W.save(out, quality=85); print("CMP4", out)
