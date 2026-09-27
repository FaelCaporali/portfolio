"""Microfone de haste, cápsula e cabo do headset (vida `techlead`), todos na concha ESQUERDA do Fael (+X).

- `tl_haste`: cubo giratório na tampa da concha (origem = pivô, gira em volta do eixo da concha), braço de raiz de
  plástico e haste flexível emborrachada. O caminho é uma Bézier da raiz à cápsula, EMPURRADA para fora da pele até
  FOLGA_HASTE (do eixo) e alisada: contorna a bochecha sem tocá-la.
- `tl_mic`: colar de plástico + espuma antipuff; ao lado e um pouco abaixo do canto da boca, à frente do plano dos
  lábios, apontando para a boca (CAPSULA, ALVO: medidos no S13, canto E no sorriso em (0,033; 0,097; 0,004)).
- `tl_cabo`: alívio de tensão na parte de baixo e de trás da concha e cabo que desce atrás do pescoço (ponto medido
  por raio na nuca), afastado da pele. Malha própria para o site poder aplicar o neckFade do busto nele.
"""
import math

import numpy as np

import prop_techlead_concha as C
import prop_techlead_geo as G
import prop_techlead_material as MT

CAPSULA = np.array((0.058, 0.085, 0.026))      # centro da espuma (glb)
ALVO = np.array((0.0, 0.093, 0.030))           # para onde a cápsula aponta (frente da boca)
ESPUMA_R, ESPUMA_L = G.R(5.6), G.R(17.0)
COLAR_L = G.R(5.0)
TUBO_R = G.R(2.1)
FOLGA_HASTE = 0.0105 + TUBO_R                  # ≥ 1 cm da superfície da haste à pele
THETA_HASTE = math.radians(-38)                # saída do braço de raiz (frente, um pouco para baixo)
THETA_CABO = math.radians(-118)                # saída do cabo (baixo, um pouco para trás)
CABO_R = G.R(1.8)


def _eixo_capsula():
    a = G.un(ALVO - CAPSULA)
    return a, CAPSULA - a * (ESPUMA_L / 2 + COLAR_L)        # (eixo, traseira do colar)


def haste(enc, q, k, materiais, rel):
    M = G.Malha()
    n, fr, up = q['n'], q['fr'], q['up']
    T0 = k['tampa']
    cubo = [(0.0, -G.R(0.4)), (G.R(12.0), -G.R(0.4)), (G.R(12.8), G.R(0.3)), (G.R(13.0), G.R(2.2)),
            (G.R(12.4), G.R(3.6)), (G.R(11.2), G.R(4.2)), (0.0, G.R(4.2))]
    G.revolver(M, cubo, T0, n, fr, 32, MT.ilha('acetinado'))
    d = fr * math.cos(THETA_HASTE) + up * math.sin(THETA_HASTE)
    h = G.R(2.2)
    raiz = [T0 + n * h + d * G.R(r) for r in np.linspace(6.0, 33.0, 10)]
    G.varrer(M, raiz, G.sec_ret(G.R(3.8), G.R(7.4), G.R(1.4), 2), MT.ilha('plastico'), ref=n,
             escala=lambda x: 1.0 - 0.30 * x)
    a, traseira = _eixo_capsula()
    p0 = raiz[-1] - d * G.R(3.0)
    ctrl = G.bezier(p0, p0 + d * 0.035 - n * 0.004, traseira - a * 0.055, traseira, 48)
    caminho = G.afastar(ctrl, enc.perto, FOLGA_HASTE, fixos=3)
    caminho = G.reamostrar(caminho, 40)
    G.varrer(M, caminho, G.sec_circ(TUBO_R, 8), MT.ilha('borracha'), escala=lambda x: 1.0 - 0.12 * x)
    rel['haste_comprimento_m'] = round(float(G.comprimento(caminho)[-1]), 4)
    ob = M.objeto('tl_haste', [materiais[0]], origem=T0)
    return ob, {'pivo': T0, 'eixo': n, 'caminho': caminho}


def mic(materiais):
    M = G.Malha()
    a, traseira = _eixo_capsula()
    ref = np.cross(a, (0, 1.0, 0))
    colar = [(0.0, -G.R(1.0)), (G.R(3.0), -G.R(1.0)), (G.R(3.5), -G.R(0.4)), (G.R(3.6), G.R(3.6)),
             (G.R(3.2), G.R(4.4)), (G.R(3.2), COLAR_L + G.R(0.6)), (0.0, COLAR_L + G.R(0.6))]
    G.revolver(M, colar, traseira, a, ref, 24, MT.ilha('plastico'))
    base = traseira + a * (COLAR_L - G.R(0.4))
    esp = []
    for f in np.linspace(-math.pi / 2, math.pi / 2, 11):
        c, s = math.cos(f), math.sin(f)
        esp.append((ESPUMA_R * abs(c) ** (2 / 2.6), ESPUMA_L / 2 * (1 + np.sign(s) * abs(s) ** (2 / 2.2))))
    esp[0] = (0.0, 0.0)
    esp[-1] = (0.0, ESPUMA_L)
    G.revolver(M, esp, base, a, ref, 24, MT.ilha('espuma'))
    ob = M.objeto('tl_mic', [materiais[0]], origem=CAPSULA)
    return ob, {'centro': CAPSULA, 'eixo': a, 'ponta': base + a * ESPUMA_L}


def cabo(enc, q, materiais, rel):
    M = G.Malha()
    d = q['fr'] * math.cos(THETA_CABO) + q['up'] * math.sin(THETA_CABO)
    b0 = C.P(q, C.RS - G.R(1.5), THETA_CABO, C.TC + G.R(7.0))
    alivio = [(0.0, 0.0), (G.R(3.6), 0.0), (G.R(3.6), G.R(3.0)), (G.R(3.0), G.R(7.0)), (G.R(2.4), G.R(12.0)),
              (G.R(2.2), G.R(13.0)), (0.0, G.R(13.0))]
    G.revolver(M, alivio, b0, d, q['n'], 16, MT.ilha('plastico'))
    # desce pela lateral do pescoço, atrás da mandíbula (o fundo do busto atrás do pescoço é cabelo, z −0,28)
    fim = enc.lateral(0.012, -0.19, 1) + np.array((G.R(5.0), 0.0, 0.0))
    while enc.perto(fim)[2] < CABO_R + G.R(3.0):                   # a ponta fica fixa: afasta até a folga
        fim = fim + np.array((0.001, 0.0, -0.0005))
    p0 = b0 + d * G.R(11.0)
    ctrl = G.bezier(p0, p0 + d * 0.03, fim + np.array((0.0, 0.05, 0.0)), fim, 40)
    caminho = G.reamostrar(G.afastar(ctrl, enc.perto, CABO_R + G.R(3.0), fixos=2), 32)
    G.varrer(M, caminho, G.sec_circ(CABO_R, 6), MT.ilha('borracha'))
    rel['cabo_fim_glb'] = [round(float(v), 4) for v in caminho[-1]]
    rel['cabo_comprimento_m'] = round(float(G.comprimento(caminho)[-1]), 4)
    return M.objeto('tl_cabo', [materiais[0]], origem=b0), {'saida': b0}
