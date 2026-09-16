"""Remove o fundo de quadros de captura (pessoa girando com câmera parada).
Uso: /data/venv-face/bin/python tools/mask_person.py <pasta_in> <pasta_out> [cinza=128]
Grava JPG com o fundo pintado de cinza uniforme (sem features para o Meshroom) e
uma máscara PNG 8 bits em <pasta_out>/masks/ (255 = pessoa) para uso opcional.
Modelo isnet-general-use: melhor para cabelo do que u2net."""
import sys, os, glob
import numpy as np
from PIL import Image
from rembg import remove, new_session

src, dst = sys.argv[1], sys.argv[2]
gray = int(sys.argv[3]) if len(sys.argv) > 3 else 128
os.makedirs(os.path.join(dst, "masks"), exist_ok=True)
session = new_session("isnet-general-use")
files = sorted(glob.glob(os.path.join(src, "*.jpg")))
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB")
    rgba = remove(im, session=session, alpha_matting=False, post_process_mask=True)
    a = np.asarray(rgba)[..., 3]
    m = (a > 127).astype(np.uint8)
    rgb = np.asarray(im)
    out = rgb * m[..., None] + np.full_like(rgb, gray) * (1 - m[..., None])
    name = os.path.basename(f)
    Image.fromarray(out.astype(np.uint8)).save(os.path.join(dst, name), quality=95)
    Image.fromarray(m * 255).save(os.path.join(dst, "masks", name[:-4] + ".png"))
    if i % 20 == 0:
        print(f"{i+1}/{len(files)} {name} pessoa={m.mean():.2f}", flush=True)
print("FIM", len(files))
