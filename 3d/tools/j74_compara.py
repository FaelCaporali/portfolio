"""J74: compara antes × depois nos mesmos pixels. Por tela: px CSS que mudaram (diferença > 24 na soma RGB), a caixa da
mudança e quanto dela cai FORA das zonas do elemento (a cabeça, com piscada e respiração, fica de fora da conta).
Grava 3d/captura/j74/diff-<vida>-<tela>.png (o que mudou em magenta sobre o depois esmaecido).
Uso: python3 3d/tools/j74_compara.py"""
import glob
import json
import os

from PIL import Image, ImageChops

D = '3d/captura/j74/'


def main():
    ref = json.load(open(D + 'referencias.json')) if os.path.exists(D + 'referencias.json') else {}
    for a in sorted(glob.glob(D + '*-antes.png')):
        nome = os.path.basename(a)[: -len('-antes.png')]
        if nome.startswith('folha'):
            continue
        b = D + nome + '-depois.png'
        if not os.path.exists(b):
            continue
        A = Image.open(a).convert('RGB')
        B = Image.open(b).convert('RGB')
        if A.size != B.size:
            print(f'{nome:22s} tamanhos diferentes {A.size} {B.size}')
            continue
        w = int(nome.split('-')[1].split('x')[0])
        s = A.size[0] / w
        dif = ImageChops.difference(A, B).convert('L').point(lambda v: 255 if v > 24 else 0)
        hist = dif.histogram()
        n = hist[255] / (s * s)
        caixa = dif.getbbox()
        # Fora da cabeça (referências medidas pelo adereço, se houver), com 16 px de folga.
        cab = (ref.get(nome) or {}).get('ref', {}) or {}
        fora = n
        if cab.get('cabeca') and caixa:
            c = cab['cabeca']
            m = Image.new('L', A.size, 255)
            m.paste(0, tuple(round(v * s) for v in (c['x0'] - 16, c['y0'] - 16, c['x1'] + 16, c['y1'] + 16)))
            fora = ImageChops.multiply(dif, m).histogram()[255] / (s * s)
        cx = tuple(round(v / s) for v in caixa) if caixa else None
        print(f'{nome:22s} mudou {n:7.0f} px CSS  fora da cabeça {fora:7.0f}  caixa {cx}')
        if caixa:
            base = Image.blend(B, Image.new('RGB', B.size, (0, 0, 0)), 0.6)
            base.paste((255, 0, 255), mask=dif)
            base.save(D + f'diff-{nome}.png')


main()
