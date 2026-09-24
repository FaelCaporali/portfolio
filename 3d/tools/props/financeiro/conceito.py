"""Miniaturas de conceito do adereço financeiro (diretor de arte, E1 da v7). NÃO é blockout nem produção.

Uso (na raiz do repo):
  blender -b --python 3d/tools/props/financeiro/conceito.py -- <pasta> [opcoes] [--vazio]
    <pasta>  : destino (ex.: 3d/captura/props/financeiro/v7/conceito)
    [opcoes] : lista separada por vírgula (padrão: todas); ex.: M1,M4
    --vazio  : só exporta 3d/export/props/lab/vazio.glb (cubo de 1 mm dentro do crânio): captura do site sem peça.

Grava, por opção e por tela, `sil/<opcao>-<tela>.png` (peça preta, busto cinza, fundo branco, sem AA, câmera
exata do site, escala da captura) e `notan/<opcao>-<tela>.png` (3 valores: peça em cinzas chapados, busto magenta de chave).
As massas são primitivas em escala e posição reais no espaço do glb; servem só para julgar silhueta, massa e lugar.
"""

import math
import os
import sys

import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [AQUI, os.path.join(AQUI, '..')]
import comum  # noqa: E402
from conceito_formas import (  # noqa: E402
    CLARO, ESCURO, MAGENTA, MEDIO, ancora, bandeira, bandeira_onda, caixa, cilindro, grade, haste, linha, macro, moedas,
    pilha, tendencia_acima)


# ---------------------------------------------------------------- opções (coordenadas locais do Blender: X direita,
# −Y para a câmera, Z para cima; a âncora põe e gira no espaço do glb)
def m1(pai):  # placa-troféu em retrato sobre régua de metal; mastro na ponta direita; moedas ao pé do mastro
    W, H, T = 0.100, 0.130, 0.012
    o = [caixa('M1_vidro', (0, 0, 0), (W, T, H), pai, ESCURO)]
    o += [caixa('M1_base', (0.012, -0.004, -H / 2 - 0.007), (W + 0.040, 0.036, 0.014), pai, MEDIO)]
    o += grade('M1', pai, W * 0.84, H * 0.62, -T / 2 - 0.0006, 4, 5, z0=-0.012)
    o += linha('M1', pai, [(-0.036, -0.045), (-0.014, -0.030), (0.008, -0.036), (0.030, 0.004), (0.062, 0.052)],
               -T / 2 - 0.004)
    o += bandeira('M1', pai, 0.064, -H / 2, H + 0.030, lado=-1, y=-0.004)
    o += [moedas('M1_moedas', pai, (0.064, -0.018, -H / 2))]
    return o


def m2(pai):  # lâmina solta em paisagem com grampos de canto; bandeira no grampo alto; moedas no grampo baixo
    W, H, T = 0.130, 0.090, 0.012
    o = [caixa('M2_vidro', (0, 0, 0), (W, T, H), pai, ESCURO)]
    for sx in (-1, 1):
        for sz in (-1, 1):
            o.append(caixa(f'M2_grampo{sx}{sz}', (sx * W / 2, 0, sz * H / 2), (0.014, 0.020, 0.014), pai, MEDIO))
    o += grade('M2', pai, W * 0.86, H * 0.70, -T / 2 - 0.0006, 5, 4)
    o += linha('M2', pai, [(-0.05, -0.02), (-0.02, -0.01), (0.01, -0.016), (0.04, 0.012), (W / 2, H / 2)],
               -T / 2 - 0.004)
    o += bandeira('M2', pai, W / 2, H / 2, 0.040, lado=-1)
    o += [caixa('M2_prateleira', (W / 2 + 0.004, -0.012, -H / 2 - 0.004), (0.036, 0.034, 0.004), pai, MEDIO),
          moedas('M2_moedas', pai, (W / 2 + 0.004, -0.012, -H / 2 - 0.002))]
    return o


def m3(pai):  # bloco de cristal (deal toy): grade gravada dentro; bandeira no topo; moedas encostadas
    W, H, T = 0.092, 0.080, 0.036
    o = [caixa('M3_bloco', (0, 0, 0), (W, T, H), pai, ESCURO)]
    o += grade('M3', pai, W * 0.8, H * 0.6, -T / 2 - 0.0006, 4, 4)
    o += bandeira('M3', pai, W / 2 - 0.008, H / 2, 0.045, lado=-1)
    o += [moedas('M3_moedas', pai, (W / 2 + 0.010, -0.020, -H / 2), n=8)]
    return o


def m4(pai):  # lâmina reclinada (mesa de leitura); a linha sai do vidro como haste em diagonal até a bandeira
    W, H, T = 0.120, 0.080, 0.010
    o = [caixa('M4_vidro', (0, 0, 0), (W, T, H), pai, ESCURO)]
    o += grade('M4', pai, W * 0.86, H * 0.70, -T / 2 - 0.0006, 5, 4)
    o += [haste('M4_trilho', (0.02, -0.02, 0.0), (0.085, -0.03, 0.085), 0.0022, pai)]
    o += bandeira('M4', pai, 0.085, 0.085, 0.025, lado=-1, y=-0.03)
    o += [caixa('M4_pe', (0, 0.01, -H / 2 - 0.006), (W + 0.02, 0.040, 0.010), pai, MEDIO),
          moedas('M4_moedas', pai, (W / 2 + 0.012, -0.008, -H / 2 - 0.001))]
    return o


def m5(pai):  # duas lâminas: planilha na frente, macro atrás e acima à direita (como Alt+F11)
    W, H, T = 0.095, 0.115, 0.010
    o = [caixa('M5_macro', (0.030, 0.030, 0.040), (0.080, 0.006, 0.060), pai, MEDIO)]
    for i in range(6):
        ind = 0.008 if 0 < i < 5 else 0.0
        o.append(caixa(f'M5_cod{i}', (0.012 + ind + 0.018, 0.026, 0.062 - i * 0.008), (0.040 - ind, 0.001, 0.003),
                       pai, CLARO))
    o += [caixa('M5_vidro', (0, 0, 0), (W, T, H), pai, ESCURO)]
    o += grade('M5', pai, W * 0.84, H * 0.66, -T / 2 - 0.0006, 4, 5)
    o += bandeira('M5', pai, W / 2, H / 2, 0.035, lado=-1)
    o += [moedas('M5_moedas', pai, (W / 2 - 0.004, -0.018, -H / 2 - 0.012), n=7)]
    return o


def m6(pai):  # redução (Brancusi): lâmina em retrato, bandeira no canto, moedas apoiadas na quina inferior
    W, H, T = 0.095, 0.125, 0.012
    o = [caixa('M6_vidro', (0, 0, 0), (W, T, H), pai, ESCURO)]
    o += grade('M6', pai, W * 0.84, H * 0.66, -T / 2 - 0.0006, 4, 5, z0=-0.008)
    o += linha('M6', pai, [(-0.034, -0.042), (-0.012, -0.028), (0.010, -0.034), (0.032, 0.000), (W / 2, H / 2)],
               -T / 2 - 0.004)
    o += bandeira('M6', pai, W / 2, H / 2, 0.034, lado=-1)
    o += [moedas('M6_moedas', pai, (W / 2 - 0.002, -0.020, -H / 2), n=7)]
    return o


# ---------------------------------------------------------------- 2ª rodada: a tendência sai do vidro por cima
def r2(pai, W, H, T, cols, linhas, alturas, pe=True, moeda_pos=None, dentro=False):
    p = pai.name[:2]
    o = [caixa(f'{p}_vidro', (0, 0, 0), (W, T, H), pai, ESCURO)]
    face = -T / 2 - 0.0006
    o += macro(p, pai, W, H / 2 - 0.009, face)
    o += grade(p, pai, W * 0.84, H * 0.56, face, cols, linhas, z0=-H * 0.14)
    xm = W / 2 + 0.004
    if dentro:  # comparação: a linha no vidro, acima da grade (sem sair por cima)
        o += tendencia_acima(p, pai, W, H - 0.07, cols, [a * 0.5 - 0.004 for a in alturas], xm, y=face - 0.003)
        o += [haste(f'{p}_mastro', (xm, 0, H / 2 - 0.035), (xm, 0, H / 2 + 0.028), 0.0017, pai, MEDIO),
              bandeira_onda(f'{p}_bandeira', pai, xm, H / 2 + 0.028)]
    else:
        topo = H / 2 + alturas[-1]
        o += tendencia_acima(p, pai, W, H, cols, alturas, xm)
        o += [haste(f'{p}_mastro', (xm, 0, H / 2 - 0.02), (xm, 0, topo + 0.024), 0.0017, pai, MEDIO),
              bandeira_onda(f'{p}_bandeira', pai, xm, topo + 0.024)]
    if pe:
        o += [caixa(f'{p}_pe', (0.006, 0.0, -H / 2 - 0.004), (W + 0.012, T + 0.010, 0.008), pai, MEDIO)]
    mx, my, mz = moeda_pos or (W / 2 - 0.004, -0.024, -H / 2 - 0.008)
    o += [moedas(f'{p}_moedas', pai, (mx, my, mz), raio=0.0135, n=6)]
    return o


def re_(pai, postes=False):  # 3ª rodada: RD refinada
    p = pai.name[:2]
    W, H, T, cols = 0.092, 0.105, 0.012, 4
    alturas = (0.006, 0.004, 0.017, 0.030, 0.043)
    o = [caixa(f'{p}_vidro', (0, 0, 0), (W, T, H), pai, ESCURO)]
    face = -T / 2 - 0.0006
    o += macro(p, pai, W, H / 2 - 0.009, face)
    o += grade(p, pai, W * 0.84, H * 0.56, face, cols, 4, z0=-H * 0.14)
    xm = W / 2 - 0.004
    o += tendencia_acima(p, pai, W, H, cols, alturas, xm, postes=postes)
    topo = H / 2 + alturas[-1] + 0.022
    o += [haste(f'{p}_mastro', (xm, -0.002, H / 2), (xm, -0.002, topo), 0.0017, pai, MEDIO),
          bandeira_onda(f'{p}_bandeira', pai, xm, topo, larg=0.026, alt=0.017, y=-0.002)]
    o += pilha(p, pai, W / 2 - 0.002, -0.022, -H / 2 - 0.004)
    return o


def rg(pai):  # 4ª rodada (escolhida): fio nasce na borda; totais com filete duplo; célula ativa; moedas sob o total
    p = pai.name[:2]
    W, H, T, cols = 0.090, 0.098, 0.012, 4
    alturas = (0.0, 0.003, 0.014, 0.025, 0.036)
    o = [caixa(f'{p}_vidro', (0, 0, 0), (W, T, H), pai, ESCURO)]
    face = -T / 2 - 0.0006
    o += macro(p, pai, W, H / 2 - 0.009, face)
    cel = grade(p, pai, W * 0.84, H * 0.56, face, cols, 4, z0=-H * 0.14)
    for c in cel:
        c['valor'] = MEDIO
    o += cel
    gw, gh = W * 0.84, H * 0.56
    z_tot = -H * 0.14 - gh / 2 + gh / 8  # centro da linha de totais
    for i, dz in enumerate((0.0085, 0.0112)):  # filete duplo do contador sob os totais
        o.append(caixa(f'{p}_filete{i}', (0, face - 0.0002, z_tot - dz), (gw, 0.001, 0.0011), pai, CLARO))
    cx = gw / 2 - gw / 8  # célula ativa = total geral (moldura + alça de preenchimento)
    cw_, ch_ = gw / 4, gh / 4
    for i, (dx, dz, sx, sz) in enumerate(((0, ch_ / 2, cw_, 0.0012), (0, -ch_ / 2, cw_, 0.0012),
                                         (-cw_ / 2, 0, 0.0012, ch_), (cw_ / 2, 0, 0.0012, ch_))):
        o.append(caixa(f'{p}_ativa{i}', (cx + dx, face - 0.0004, z_tot + dz), (sx, 0.001, sz), pai, CLARO))
    o.append(caixa(f'{p}_alca', (cx + cw_ / 2, face - 0.0008, z_tot - ch_ / 2), (0.0034, 0.002, 0.0034), pai, CLARO))
    xm = W / 2 - 0.004
    o += tendencia_acima(p, pai, W, H, cols, alturas, xm)
    topo = H / 2 + alturas[-1] + 0.017
    o += [haste(f'{p}_mastro', (xm, -0.002, H / 2), (xm, -0.002, topo), 0.0017, pai, MEDIO),
          bandeira_onda(f'{p}_bandeira', pai, xm, topo, larg=0.022, alt=0.014, y=-0.002)]
    o += pilha(p, pai, W / 2 - 0.014, -0.010, -H / 2 - 0.0145, n=4, lado=-1)  # resultado sob o total geral
    return o


def rf(pai):  # RE + postes: cada nó preso à sua coluna (ritmo com os totais, como o fio é sustentado)
    return re_(pai, postes=True)


ALT = (0.010, 0.006, 0.020, 0.034)  # alturas dos nós acima da borda (m); o último sobe ao mastro


def ra(pai):  # retrato, tendência por cima, pé de metal, moedas à frente da quina inferior direita
    return r2(pai, 0.092, 0.105, 0.012, 4, 4, ALT + (0.046,))


def rb(pai):  # paisagem, mesma lógica
    return r2(pai, 0.118, 0.082, 0.012, 5, 4, (0.008, 0.014, 0.006, 0.022, 0.032, 0.044))


def rc(pai):  # comparação: a linha dentro do vidro (acima da grade), bandeira no canto
    return r2(pai, 0.092, 0.120, 0.012, 4, 4, ALT + (0.046,), dentro=True)


def rd(pai):  # retrato sem pé; moedas empilhadas saindo da quina inferior direita para fora
    return r2(pai, 0.092, 0.105, 0.012, 4, 4, ALT + (0.046,), pe=False, moeda_pos=(0.052, -0.012, -0.0525))


# nome → (construtor, posição do centro no glb, giro_y, inclinação_x)
OPCOES = {
    'RG': (rg, (0.138, 0.172, 0.040), -25, 0),
    'RE': (re_, (0.135, 0.162, 0.040), -25, 0),
    'RF': (rf, (0.135, 0.162, 0.040), -25, 0),
    'RA': (ra, (0.135, 0.165, 0.040), -25, 0),
    'RB': (rb, (0.140, 0.165, 0.040), -25, 0),
    'RC': (rc, (0.135, 0.170, 0.040), -25, 0),
    'RD': (rd, (0.135, 0.165, 0.040), -25, 0),
    'M1': (m1, (0.138, 0.178, 0.040), -25, 0),
    'M2': (m2, (0.140, 0.185, 0.040), -25, 0),
    'M3': (m3, (0.138, 0.170, 0.050), -28, 0),
    'M4': (m4, (0.138, 0.165, 0.050), -25, -30),
    'M5': (m5, (0.132, 0.170, 0.045), -25, 0),
    'M6': (m6, (0.135, 0.178, 0.040), -25, 0),
}


def _notan(saida, pretos, busto):
    """Render chapado de 3 valores: peça pelos valores gravados em cada objeto, busto magenta, fundo transparente."""
    sh = comum._workbench('FLAT', 'OFF')
    sh.color_type = 'OBJECT'
    bpy.context.scene.render.film_transparent = True
    bpy.context.scene.render.image_settings.color_mode = 'RGBA'
    for o in pretos:
        v = o.get('valor', MEDIO)
        o.color = (v, v, v, 1.0)
    for o in busto:
        o.color = MAGENTA
    return comum._render(saida, list(pretos) + list(busto))


def exportar_vazio():
    comum.cena_nova()
    bpy.ops.mesh.primitive_cube_add(size=0.001, location=comum.gl_para_bl((0.0, 0.2, -0.15)))
    comum.exportar_glb([bpy.context.active_object], os.path.join(comum.RAIZ, '3d/export/props/lab/vazio.glb'),
                       draco=False)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if '--vazio' in args:
        exportar_vazio()
        return
    pasta = os.path.join(comum.RAIZ, args[0] if args else '3d/captura/props/financeiro/v7/conceito')
    nomes = args[1].split(',') if len(args) > 1 else list(OPCOES)
    comum.cena_nova()
    busto = [o for o in comum.importar_busto() if o.type == 'MESH']
    pecas = {}
    for n in nomes:
        fn, pos, giro, incl = OPCOES[n]
        pecas[n] = [o for o in fn(ancora(f'{n}_ancora', pos, giro, incl)) if o.type == 'MESH']
    for tela in comum.TELAS:
        k = comum.ler_camera_site(tela).get('dsfCaptura', 1)
        comum.camera_site(tela, escala=k)
        for n, objs in pecas.items():
            comum.render_silhueta(os.path.join(pasta, 'sil', f'{n}-{tela}.png'), objs, busto)
            _notan(os.path.join(pasta, 'notan', f'{n}-{tela}.png'), objs, busto)
            bpy.context.scene.render.film_transparent = False
            bpy.context.scene.render.image_settings.color_mode = 'RGB'
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(comum.RAIZ, '3d/blend/props/financeiro_v7_conceito.blend'))


main()
