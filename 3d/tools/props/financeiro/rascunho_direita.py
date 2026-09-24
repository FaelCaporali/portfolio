"""Rascunho (PIL) do conteúdo impresso da fita e do boleto do lado direito, SÓ para julgar leitura e escala nas provas
da modelagem. O conteúdo definitivo é canvas desenhado no site (TD), com o mesmo layout de UV.

Uso: python3 3d/tools/props/financeiro/rascunho_direita.py <pasta> [L]  →  <pasta>/fita.jpg e <pasta>/boleto.jpg
Fita: u na largura, v = 0 na fenda (base da imagem), v = 1 na ponta da espiral; L = comprimento da malha em metros
(impresso pela receita como 'FITA comprimento L'). A fita inteira leva as 4 contas das colunas A–D do painel da v6, a mais
nova (coluna D, 1.947 T em vermelho) junto da fenda. Boleto: face inteira, 0,105 × 0,070 m; os ~4 % de cima ficam presos
sob o pé da calculadora.
"""
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFont

MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
MONO_B = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
SANS_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def fonte(caminho, tam):
    try:
        return ImageFont.truetype(caminho, tam)
    except OSError:
        return ImageFont.load_default(size=tam)


MONOS = ('/usr/share/fonts/truetype/ubuntu/UbuntuMono-B.ttf', '/usr/share/fonts/truetype/liberation2/LiberationMono-Bold.ttf',
         MONO_B)
CONTAS = ((('412', '318', '276', '278'), '1.284'), (('438', '296', '251', '187'), '1.172'),
          (('455', '362', '318', '428'), '1.563'), (('521', '447', '389', '590'), '1.947'))   # colunas A–D do painel


def linhas_fita():
    """Linhas da fenda (v = 0) para a ponta: a conta mais nova saiu por último; em cada conta o total fica embaixo."""
    tinta, vermelho, out = (58, 36, 92), (178, 34, 38), []
    for parcelas, total in reversed(CONTAS):
        out += [(total + ' T', vermelho), ('- - - -', tinta)] + [(p + ' +', tinta) for p in reversed(parcelas)]
        out.append(('', tinta))
    return out[:-1]


def mono_pesada(w, passo):
    """A mono pesada de maior dígito que cabe: '1.947 T' em 86 % da largura e dígito ≤ 72 % do passo."""
    melhor = (0, None)
    for arq in (a for a in MONOS if os.path.exists(a)):
        for tam in range(90, 8, -1):
            f = ImageFont.truetype(arq, tam)
            b = f.getbbox('0')
            if f.getlength('1.947 T') <= 0.86 * w and b[3] - b[1] <= 0.72 * passo:
                melhor = max(melhor, (b[3] - b[1], f), key=lambda m: m[0])
                break
    return melhor


def fita(saida, comp):
    h = 1024
    w, pxm = max(64, round(h * 0.030 / comp)), h / comp
    im = Image.new('RGB', (w, h), (244, 241, 234))
    dr = ImageDraw.Draw(im)
    linhas = linhas_fita()
    base = 0.0035 * pxm                  # a última linha acabou de sair da fenda
    passo = (h - base - 0.002 * pxm) / (len(linhas) - 0.2)
    dig, f = mono_pesada(w, passo)
    for k, (txt, c) in enumerate(linhas):
        dr.text((w - 0.05 * w, h - base - k * passo), txt, font=f, fill=c, anchor='rs')
    im.save(saida, quality=90)
    print('RASCUNHO fita %dx%d, %d linhas, passo %.1f mm, dígito %.1f mm (%s)' % (
        w, h, len(linhas), passo / pxm * 1000, dig / pxm * 1000, os.path.basename(f.path)))


def boleto(saida):
    w, h = 768, 512                       # ~7300 px/m
    im = Image.new('RGB', (w, h), (243, 243, 239))
    dr = ImageDraw.Draw(im)
    preto, cinza, linha = (26, 26, 28), (128, 128, 128), (70, 70, 72)
    m = 22
    # Faixa superior: banco fictício e linha digitável fictícia.
    dr.text((m, 16), '000-0', font=fonte(SANS_B, 40), fill=preto)
    dr.line((m + 128, 12, m + 128, 64), fill=linha, width=4)
    dr.text((m + 144, 28), '00000.00000 00000.000000 00000.000000 0 00000000194700', font=fonte(MONO_B, 16),
            fill=preto)
    dr.line((m, 70, w - m, 70), fill=linha, width=4)
    # Campos: beneficiário e valor do documento em destaque; os demais em cinza.
    col = int(w * 0.76)                   # a fita passa na frente de u 0,47–0,75: conteúdo essencial à esquerda
    dr.text((m, 80), 'Beneficiário', font=fonte(SANS, 15), fill=cinza)
    dr.text((m, 96), 'IMMERSUS', font=fonte(SANS_B, 34), fill=preto)
    dr.text((m + 196, 110), 'ENSINO DE IDIOMAS', font=fonte(SANS_B, 13), fill=preto)
    dr.text((m, 138), 'Valor do documento', font=fonte(SANS, 15), fill=cinza)
    dr.text((m, 156), 'R$ 1.947,00', font=fonte(SANS_B, 44), fill=preto)
    dr.line((col, 76, col, 330), fill=linha, width=2)
    for k, rot in enumerate(('Nosso número', 'Carteira', 'Espécie', 'Quantidade', 'Desconto', 'Cobrado')):
        y = 80 + k * 42
        dr.text((col + 12, y), rot, font=fonte(SANS, 13), fill=cinza)
        dr.line((col + 12, y + 36, w - m, y + 36), fill=(170, 170, 170), width=1)
    for k, rot in enumerate(('Instruções', 'Pagador')):
        y = 226 + k * 50
        dr.line((m, y - 4, int(w * 0.45), y - 4), fill=(170, 170, 170), width=1)
        dr.text((m, y), rot, font=fonte(SANS, 14), fill=cinza)
        dr.rectangle((m, y + 24, m + 180 + 60 * k, y + 32), fill=(205, 205, 205))
    dr.line((m, 336, w - m, 336), fill=linha, width=3)
    dr.text((m, 342), 'Ficha de compensação', font=fonte(SANS, 13), fill=cinza)
    # Código de barras (intercalado 2 de 5 fictício): o que lê "boleto" a distância.
    rnd = random.Random(1947)
    x, y0, y1 = m, 372, 468
    while x < int(w * 0.45):
        for barra in (True, False):
            larg = rnd.choice((3, 3, 8))
            if barra:
                dr.rectangle((x, y0, x + larg - 1, y1), fill=preto)
            x += larg
    im.save(saida, quality=88)


if __name__ == '__main__':
    pasta = sys.argv[1]
    os.makedirs(pasta, exist_ok=True)
    fita(os.path.join(pasta, 'fita.jpg'), float(sys.argv[2]) if len(sys.argv) > 2 else 0.25)
    boleto(os.path.join(pasta, 'boleto.jpg'))
    print('RASCUNHO', pasta)
