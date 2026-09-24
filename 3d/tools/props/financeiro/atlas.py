"""Atlas do painel (lookdev; ESTUDIO NUCLEO §2, retorno dos dailies 24/09, volta r1 do lookdev).

Cabeçalho, letras A/B/C, barra de fórmula (`Sub AtingirMeta()`), filetes e preenchimentos da grade 3×4 (R2/R3/R4)
NÃO são malha: são pintados aqui numa textura só, aplicada à face da frente do painel (UV limpa, sem espelho,
`forma.py`). Gera DUAS imagens juntas, sempre em par: a de COR (`atlas_painel.png`, base do vidro fosco) e a
MÁSCARA DE TRANSMISSÃO (`..._transmissao.png`, branco = vidro nu que transmite, preto = impresso opaco — cabeçalho,
letras, fórmula, filetes, células preenchidas, moldura da célula ativa; `aparencia.py` liga essa máscara em
Transmission Weight do material único do painel, KHR_materials_transmission/transmissionTexture no glb). Roda puro
(PIL), sem Blender: `python3 atlas.py [saida.png]`.
"""

import math
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
# Proporção do painel (FICHA R1): 0,078 × 0,100 m.
W, H = 820, 1050
# Retorno dos dailies r2→r3 (24/09): a r2 escureceu o atlas mas o site ainda multiplicava por ~1,4–2 e SOMAVA um
# brilho de ~+50 (especular/env do painel, ENV['vidro'] alto demais aplicado também ao impresso via coat/specular
# sem máscara fina) — célula cheia 212, cabeçalho 112/181/137, texto ~86, fundo da barra 233 (área mais clara da
# peça). aparencia.py agora baixa ENV['vidro'] e mascara specular/roughness do impresso; estes valores de base são
# os pontos de partida CALCULADOS pelo orquestrador para os alvos da r3 (célula 140–165, fundo da barra 120–160,
# texto ≤ 60 com contraste ≥ 60, cabeçalho 50–70/105–125/75–90, vidro nu 70–110).
FUNDO = '#8a8c88'  # base do vidro fosco E fundo da barra de fórmula (aparencia.py, variante 'fosco')
# Medido em r3-1440x900.png (PIL, ENV['vidro'] já em 0,5): cabeçalho ficou 30/79/50 (abaixo do alvo — a captura
# mostrou quase nenhum acréscimo do site sobre o atlas cru neste tom escuro); célula cheia 129/125/119 (perto do
# alvo, um pouco abaixo — o site acrescenta ali ~1,17× por ser mais clara). Ajuste proporcional único (regra do
# NUCLEO §2): VERDE dividido pelo ganho observado (~1,02/1,07/1,02) para bater ~60/115/82; TINTA multiplicada por
# ~1,21 para bater ~150 (meio do alvo 140–165).
VERDE = '#3b6c50'  # cabeçalho verde do Excel, dessaturado (alvo: 50–70/105–125/75–90; FICHA R2)
IMPRESSAO = '#141414'  # gravação escura sobre o fosco claro (alvo: ≤ 60, contraste ≥ 60; FICHA R4) — já dentro na r3
TINTA = '#82817e'  # preenchimento claro das células (alvo: 140–165, abaixo da pele; FICHA R3)
MARCA = '#141414'  # valor escrito na célula preenchida (alvo: ≤ 60) — já dentro na r3
FILETE = '#5d5c57'
ATIVA = '#3fae6e'  # moldura verde de Excel da célula ativa (mais viva que o cabeçalho, para destacar; mantida da r2)

HEADER_H = round(H * 0.11)  # 11% (dailies r1): abre espaço para a fórmula ≥ 4,5 mm sem estourar a grade
FORMULA_H = round(H * 0.135)  # faixa da barra de fórmula (glifo ajustado dentro dela, ver _fonte_formula)
GRID_TOP = HEADER_H + FORMULA_H
GRID_BOT = H - round(H * 0.03)
MARGEM = round(W * 0.035)
COLS, ROWS = 3, 4
LETRAS = ('A', 'B', 'C')
# Série CRESCENTE em ordem de leitura (linha a linha), subindo até a meta; a célula ativa (12ª) fica por último
# (dailies r1, ponto 4). 11 preenchidas + 1 ativa = 12 células (3 × 4).
VALORES = (12, 15, 19, 24, 28, 33, 39, 46, 54, 63, 74)
PREENCHIDAS = len(VALORES)

# R4 (defeito do daily r3: "Sub AtingirMet" cortado no 1440). Escala medida (SITE.md): painel de 100 mm ≈ 210 px
# no 1440 → 1 mm ≈ 2,1 px na tela; o atlas cobre os mesmos 100 mm em H px → H/100 px de atlas por mm.
CAMINHO_MONO_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
CAMINHO_MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
CAMINHO_SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FORMULA_TEXTO = 'Sub AtingirMeta()'
PX_POR_MM_1440 = 2.1
CAP_MIN_PX_1440 = 9  # requisito: altura de maiúscula ≥ 9 px no 1440
ATLAS_PX_POR_MM = H / 100
CAP_MIN_ATLAS_PX = CAP_MIN_PX_1440 / PX_POR_MM_1440 * ATLAS_PX_POR_MM


# TEXTURAS DERIVADAS PRONTAS PARA O glTF (retorno do daily r4 do lookdev, 24/09): o exportador do Blender NÃO leva
# nó de conta (Math) para o glb — a r4 ligou máscara→conta→Alpha e o glb saiu com baseColorTexture = RGB do atlas +
# ALFA = máscara CRUA (impresso preto = alfa 0: painel sem impressão). Tudo o que varia por região no painel sai
# daqui já calculado, e `aparencia.py` liga cada imagem DIRETO no Principled (Color→Base Color, Alpha→Alpha,
# ORM G→Roughness, especular→Specular IOR Level, máscara→Coat Weight), sem conta no caminho.
ALPHA_NU = 0.55  # vidro nu em BLEND (0,5–0,6, daily r3→r4); impresso opaco (1,0)
VIDRO_RUG = 0.40  # FICHA R1: vidro nu 0,35–0,45
IMPRESSO_SPEC, IMPRESSO_RUG = 0.2, 0.6  # daily r2→r3: a tinta não brilha como o vidro em volta
NU_SPEC = 0.5  # Specular IOR Level neutro do Principled (F0 do IOR)
# Verso/cantos/chanfro caem todos na UV constante (0,5; 0,012) de `forma.py:_painel` (a margem de baixo do atlas):
# a faixa de baixo do atlas é pintada com a BORDA DE VIDRO (cor, rugosidade polida que pega a luz-chave, opaca).
BORDA_COR, BORDA_RUG = '#9fb3aa', 0.1
BORDA_FAIXA_PX = 14  # linhas de baixo do atlas (cobre o ponto v = 0,012 até o mip 2 sem sangrar da grade)


def _hex(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def derivadas(cor_png, masc_png=None):
    """A partir do par (cor, máscara) grava `<raiz>_rgba.png` (RGB do atlas intacto + alfa certo), `<raiz>_orm.png`
    (R oclusão 1, G rugosidade, B metálico 0) e `<raiz>_spec.png` (RGB = Specular IOR Level do Blender;
    A = specular do glTF, nível/0,5)."""
    from PIL import Image
    raiz, ext = os.path.splitext(cor_png)
    masc_png = masc_png or f'{raiz}_transmissao{ext}'
    cor = Image.open(cor_png).convert('RGB')
    m = Image.open(masc_png).convert('L')  # branco = vidro nu, preto = impresso
    lerp = lambda a, b: m.point(lambda v: round(255 * (a + (b - a) * v / 255)))  # noqa: E731
    alfa = lerp(1.0, ALPHA_NU)
    rug = lerp(IMPRESSO_RUG, VIDRO_RUG)
    spec = lerp(IMPRESSO_SPEC, NU_SPEC)
    faixa = (0, H - BORDA_FAIXA_PX, W, H)
    cor = cor.copy()
    cor.paste(_hex(BORDA_COR), faixa)
    alfa.paste(255, faixa)
    rug.paste(round(255 * BORDA_RUG), faixa)
    spec.paste(round(255 * NU_SPEC), faixa)
    # glTF KHR_materials_specular lê o ALFA de specularTexture (fator 1 = nível 0,5 do Blender); o Blender lê a Cor.
    spec_gltf = spec.point(lambda v: min(255, round(v * 0.5 / NU_SPEC * 2)))
    spec = Image.merge('RGBA', (spec, spec, spec, spec_gltf))
    rgba = Image.merge('RGBA', (*cor.split(), alfa))
    orm = Image.merge('RGB', (Image.new('L', cor.size, 255), rug, Image.new('L', cor.size, 0)))
    saidas = (f'{raiz}_rgba.png', f'{raiz}_orm.png', f'{raiz}_spec.png')
    for img, cam in zip((rgba, orm, spec), saidas):
        img.save(cam)
    return saidas


def fracao_linha_ativa():
    """Fração da altura do painel (do topo) até o centro da célula ATIVA da grade — `forma.py` alinha aí o início
    da linha de tendência (R5), para a linha nascer no mesmo estado que o atlas mostra (R3)."""
    r = PREENCHIDAS // COLS
    y0 = GRID_TOP + r * (GRID_BOT - GRID_TOP) / ROWS
    y1 = y0 + (GRID_BOT - GRID_TOP) / ROWS
    return (y0 + y1) / 2 / H


def _fonte_formula(d, texto, largura_disp, tam_max, tam_min=20):
    """Maior fonte mono-bold que faz `texto` caber em `largura_disp` px (mede com textbbox; R4: nunca corta).
    Devolve (fonte, bbox_texto, altura_maiuscula_px)."""
    from PIL import ImageFont

    for tam in range(tam_max, tam_min - 1, -1):
        f = ImageFont.truetype(CAMINHO_MONO_BOLD, tam)
        bbox = d.textbbox((0, 0), texto, font=f)
        if bbox[2] - bbox[0] <= largura_disp:
            break
    else:
        f = ImageFont.truetype(CAMINHO_MONO_BOLD, tam_min)
        bbox = d.textbbox((0, 0), texto, font=f)
    cap = d.textbbox((0, 0), 'M', font=f)
    return f, bbox, cap[3] - cap[1]


# Cabeçalho de LINHAS (dailies r4 do lookdev, ponto 2 — execução de R2, não mudança): coluna estreita à esquerda da
# grade com 1 2 3 4, no MESMO verde do cabeçalho de colunas; o canto superior esquerdo (acima dela, na faixa do
# cabeçalho) fica vazio, como no Excel. A barra de fórmula continua na largura toda (a fórmula não encolhe).
ROWHDR_W = round(W * 0.09)
GRID_X0, GRID_X1 = ROWHDR_W, W - MARGEM
VERDE_FILETE = '#2c5540'  # separadores entre rótulos do cabeçalho (canto | A | B | C e 1/2/3/4), mais escuro que VERDE
LETRA_COR = '#eef3ef'
LAYOUT_JSON = os.path.join(AQUI, 'atlas_layout.json')


def _uv(x0, y0, x1, y1):
    """Retângulo em px do atlas (origem em cima à esquerda) → [u0, v0, u1, v1] do glTF (origem embaixo à esquerda,
    v = 1 − y/H); (u0, v0) é o canto inferior esquerdo."""
    return [round(x0 / W, 5), round(1 - y1 / H, 5), round(x1 / W, 5), round(1 - y0 / H, 5)]


def construir(saida=None, preenchidas=None, vazio=False, layout=None):
    """Gera o PNG de cor e, ao lado, a máscara (mesmo nome + `_transmissao`: branco = vidro nu, preto = impresso);
    só depende de Pillow (python3 do sistema, NUNCA de dentro do Blender).

    `vazio=True` (dailies r4, ponto 3): o estado INICIAL coerente para o técnico cruzar por célula com o cheio —
    sem preenchimento, sem texto da fórmula nem cursor, sem números, sem moldura ativa; cabeçalhos, "fx" e filetes
    idênticos. `layout` = caminho do JSON com os retângulos em UV (só no atlas cheio)."""
    from PIL import Image, ImageDraw, ImageFont

    n_cheias = 0 if vazio else (PREENCHIDAS if preenchidas is None else preenchidas)

    def _fonte(caminho, tam):
        return ImageFont.truetype(caminho, tam)

    img = Image.new('RGB', (W, H), FUNDO)
    d = ImageDraw.Draw(img)
    msk = Image.new('L', (W, H), 255)
    d2 = ImageDraw.Draw(msk)
    gw, gh = GRID_X1 - GRID_X0, GRID_BOT - GRID_TOP
    cw, ch = gw / COLS, gh / ROWS

    # Cabeçalho de colunas (R2): faixa verde na largura toda, canto vazio, A B C centradas sobre as colunas da grade.
    d.rectangle((0, 0, W, HEADER_H), fill=VERDE)
    d2.rectangle((0, 0, W, HEADER_H), fill=0)
    for i in range(COLS + 1):
        x = round(GRID_X0 + cw * i)
        d.line((x, 0, x, HEADER_H), fill=VERDE_FILETE, width=3)
    fh = _fonte(CAMINHO_MONO_BOLD, round(HEADER_H * 0.5))
    for i, letra in enumerate(LETRAS):
        cx = GRID_X0 + cw * (i + 0.5)
        bbox = d.textbbox((0, 0), letra, font=fh)
        d.text((cx - (bbox[2] - bbox[0]) / 2, HEADER_H / 2 - (bbox[3] - bbox[1]) / 2 - bbox[1]), letra,
               font=fh, fill=LETRA_COR)

    # Cabeçalho de linhas (R2): coluna estreita à esquerda da grade, 1 2 3 4, mesmo verde e mesma fonte.
    d.rectangle((0, GRID_TOP, GRID_X0, GRID_BOT), fill=VERDE)
    d2.rectangle((0, GRID_TOP, GRID_X0, GRID_BOT), fill=0)
    fr = _fonte(CAMINHO_MONO_BOLD, round(min(ch * 0.36, HEADER_H * 0.5)))
    for r in range(ROWS):
        y0 = GRID_TOP + r * ch
        if r:
            d.line((0, round(y0), GRID_X0, round(y0)), fill=VERDE_FILETE, width=3)
        num = str(r + 1)
        bbox = d.textbbox((0, 0), num, font=fr)
        d.text((GRID_X0 / 2 - (bbox[2] - bbox[0]) / 2 - bbox[0], y0 + ch / 2 - (bbox[3] - bbox[1]) / 2 - bbox[1]),
               num, font=fr, fill=LETRA_COR)

    # Barra de fórmula (R4): "fx" + Sub AtingirMeta() + cursor; tamanho ajustado para CABER na largura útil.
    fb_y = HEADER_H
    d.rectangle((0, fb_y, W, fb_y + FORMULA_H), fill=FUNDO)
    d2.rectangle((0, fb_y, W, fb_y + FORMULA_H), fill=0)
    FX_CINZA = '#3a3a38'
    ff_lbl = _fonte(CAMINHO_SANS, round(FORMULA_H * 0.26))
    ty = fb_y + FORMULA_H / 2
    d.text((MARGEM, ty), 'fx', font=ff_lbl, fill=FX_CINZA, anchor='lm')
    lbl_w = d.textbbox((0, 0), 'fx   ', font=ff_lbl)[2]
    CURSOR_W, CURSOR_GAP = 5, 6
    largura_disp = (W - MARGEM) - (MARGEM + lbl_w) - CURSOR_GAP - CURSOR_W
    ff_code, bbox_code, cap_px = _fonte_formula(d, FORMULA_TEXTO, largura_disp, tam_max=round(FORMULA_H * 0.62))
    cap_px_1440 = cap_px / ATLAS_PX_POR_MM * PX_POR_MM_1440
    if cap_px < CAP_MIN_ATLAS_PX:
        print(f'ATLAS AVISO: maiúscula da fórmula em {cap_px_1440:.1f} px no 1440 (< {CAP_MIN_PX_1440})')
    tx = MARGEM + lbl_w
    cursor_x = tx + (bbox_code[2] - bbox_code[0]) + CURSOR_GAP
    cursor = (cursor_x, fb_y + FORMULA_H * 0.18, cursor_x + CURSOR_W, fb_y + FORMULA_H * 0.82)
    if not vazio:
        d.text((tx, ty), FORMULA_TEXTO, font=ff_code, fill=IMPRESSAO, anchor='lm')
        d.rectangle(cursor, fill=IMPRESSAO)
    tb = d.textbbox((tx, ty), FORMULA_TEXTO, font=ff_code, anchor='lm')
    caracteres = []
    for i, c in enumerate(FORMULA_TEXTO):
        a = tx + d.textlength(FORMULA_TEXTO[:i], font=ff_code)
        b = tx + d.textlength(FORMULA_TEXTO[:i + 1], font=ff_code)
        caracteres.append({'i': i, 'c': c, 'u0': round(a / W, 5), 'u1': round(b / W, 5)})

    # Grade 3×4 (R3) à direita do cabeçalho de linhas: filetes, preenchimento em ordem de leitura, célula ativa.
    ff_num = _fonte(CAMINHO_MONO, round(ch * 0.32))
    celulas, ativa_lay = [], None
    idx = 0
    for r in range(ROWS):
        for c in range(COLS):
            x0, y0 = GRID_X0 + c * cw, GRID_TOP + r * ch
            x1, y1 = x0 + cw, y0 + ch
            pad = min(cw, ch) * 0.08
            ativa = idx == PREENCHIDAS
            if idx < n_cheias:
                d.rectangle((x0 + pad, y0 + pad, x1 - pad, y1 - pad), fill=TINTA)
                d2.rectangle((x0 + pad, y0 + pad, x1 - pad, y1 - pad), fill=0)
                d.text(((x0 + x1) / 2, (y0 + y1) / 2), str(VALORES[idx]), font=ff_num, fill=MARCA, anchor='mm')
            d.rectangle((x0, y0, x1, y1), outline=FILETE, width=2)
            d2.rectangle((x0, y0, x1, y1), outline=0, width=2)
            alca = min(cw, ch) * 0.09
            if ativa and not vazio:
                d.rectangle((x0 + 2, y0 + 2, x1 - 2, y1 - 2), outline=ATIVA, width=5)
                d2.rectangle((x0 + 2, y0 + 2, x1 - 2, y1 - 2), outline=0, width=5)
                d.rectangle((x1 - alca, y1 - alca, x1, y1), fill=ATIVA)
                d2.rectangle((x1 - alca, y1 - alca, x1, y1), fill=0)
            cel = {'indice': idx, 'ref': f'{LETRAS[c]}{r + 1}', 'linha': r, 'coluna': c, 'rect': _uv(x0, y0, x1, y1),
                   'preenchimento_rect': _uv(x0 + pad, y0 + pad, x1 - pad, y1 - pad),
                   'valor': VALORES[idx] if idx < PREENCHIDAS else None, 'ativa_final': ativa}
            celulas.append(cel)
            if ativa:
                ativa_lay = {**cel, 'moldura_px_atlas': 5, 'alca_rect': _uv(x1 - alca, y1 - alca, x1, y1)}
            idx += 1

    saida = saida or os.path.join(AQUI, 'atlas_painel.png')
    img.save(saida)
    raiz, ext = os.path.splitext(saida)
    msk.save(f'{raiz}_transmissao{ext}')
    if layout:
        import json
        dados = {
            'convencao': 'rect = [u0, v0, u1, v1] em UV do glTF (0–1; origem embaixo à esquerda: u = x/W, v = 1 − y/H); '
                         '(u0, v0) = canto inferior esquerdo. A face da frente do painel mapeia o atlas 1:1 (forma.py).',
            'atlas': {'largura_px': W, 'altura_px': H, 'cheio': 'atlas_painel_rgba.png',
                      'vazio': 'atlas_painel_vazio_rgba.png',
                      'nota': 'mesma UV e mesmo layout; o vazio só perde preenchimento, números, texto da fórmula, '
                              'cursor e moldura ativa — cruzar por retângulo (célula, caractere) do vazio para o cheio'},
            'celulas_ordem_leitura': celulas,
            'barra_formula': {'rect': _uv(0, fb_y, W, fb_y + FORMULA_H), 'texto': FORMULA_TEXTO,
                              'texto_rect': _uv(tx, tb[1], tb[2], tb[3]), 'caracteres': caracteres,
                              'cursor_rect': _uv(*cursor),
                              'maiuscula_px_1440': round(cap_px_1440, 1)},
            'celula_ativa_final': ativa_lay,
            'cabecalho_colunas_rect': _uv(0, 0, W, HEADER_H),
            'cabecalho_linhas_rect': _uv(0, GRID_TOP, GRID_X0, GRID_BOT),
            'borda_vidro_uv': [0.5, 0.012],
        }
        with open(layout, 'w', encoding='utf-8') as f:
            json.dump(dados, f, ensure_ascii=False, indent=1)
    return saida


if __name__ == '__main__':
    saida = sys.argv[1] if len(sys.argv) > 1 else None
    principal = construir(saida, layout=LAYOUT_JSON)
    raiz, ext = os.path.splitext(principal)
    print('ATLAS', principal)
    print('ATLAS_TRANSMISSAO', f'{raiz}_transmissao{ext}')
    print('ATLAS_LAYOUT', LAYOUT_JSON)
    # Estado inicial (dailies r4, ponto 3): mesma UV e layout, sem nada do que a animação escreve.
    vazio = construir(f'{raiz}_vazio{ext}', vazio=True)
    print('ATLAS_VAZIO', vazio)
    for png in (principal, vazio):
        print('ATLAS_DERIVADAS', *derivadas(png))
