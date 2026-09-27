"""E6 `qa_lupa`: lupa de leitura de verdade. Aro de latão escovado com chanfros e um friso no meio da parede, lente
biconvexa com a borda retificada, pescoço e virola de latão torneados (com friso e lábio), cabo de nogueira escura
torneado com empunhadura cilíndrica (o raio da pegada da mão), nó alargado no fim e botão de latão.

Quadro local (glb) = quadro do nó `qa_lupa`: origem no CENTRO DA LENTE, +Z = normal da lente (para a câmera),
+Y = para cima (lado oposto ao cabo), o cabo desce por −Y. Medidas em m do scan (≈ 1,2 × real): lente Ø 0,0696
(58 mm reais), aro Ø 0,083, empunhadura Ø 0,027 (22 mm reais).
"""
import numpy as np

import prop_qa_util as U

R_LENTE = 0.0348
R_ARO = 0.0414
RG = 0.0135                                        # raio da empunhadura (= o da pegada da mão)
H_VIROLA = 0.0644                                  # do centro da lente ao fim da virola (eixo −Y)
LATAO, NOGUEIRA = '#b8955e', '#3c2517'
EIXO, FRENTE = np.array((0, -1.0, 0)), np.array((0, 0, 1.0))


def perfil_lente():
    """Biconvexa: 2,4 mm no centro, 1,0 mm na borda cilíndrica retificada (a borda que aparece dentro do aro)."""
    rs = np.linspace(0.006, 0.0322, 4)
    frente = [(r, 0.0012 + 0.0009 * (1 - (r / R_LENTE) ** 2)) for r in rs]
    borda = [(0.0337, 0.00088), (R_LENTE, 0.0005), (R_LENTE, -0.0005), (0.0337, -0.00088)]
    return frente + borda + [(r, -z) for r, z in frente[::-1]]


def lente(mat, seg=24):
    m = U.Malha()
    m.torno(perfil_lente(), seg, np.zeros(3), (0, 0, 1), (0, -1, 0), cel=None, cor='#ffffff', tampas=(True, True))
    return m.objeto('qa_lupa_lente', mat, ang=35, normais=False, cor=False)


def rigido(mat, h_no, seg_aro=48, seg=20):
    """Aro + pescoço + virola (latão) + cabo (nogueira) + botão; h_no = início do nó do cabo (m ao longo de −Y, a
    partir do centro da lente), escolhido pela mão (o nó fica abaixo do dedo mínimo)."""
    m = U.Malha()
    aro = [(0.0340, 0.0030), (0.0346, 0.0040), (0.0356, 0.0042), (0.0392, 0.0042), (0.0405, 0.0033),
           (0.0409, 0.0012), (0.0414, 0.0), (0.0409, -0.0012), (0.0405, -0.0033), (0.0392, -0.0042),
           (0.0356, -0.0042), (0.0346, -0.0040), (0.0340, -0.0030)]
    m.torno(aro, seg_aro, np.zeros(3), (0, 0, 1), (0, -1, 0), cel='latao', cor=LATAO, fecha_perfil=True)
    virola = [(0.0060, 0.0396), (0.0060, 0.0410), (0.0044, 0.0420), (0.0044, 0.0443), (0.0051, 0.0452),
              (0.0043, 0.0462), (0.0043, 0.0473), (0.0112, 0.0477), (0.0124, 0.0488), (0.0124, 0.0558),
              (0.0131, 0.0566), (0.0124, 0.0576), (0.0124, 0.0628), (0.0131, 0.0636), (0.0126, H_VIROLA)]
    m.torno(virola, seg, np.zeros(3), EIXO, FRENTE, cel='latao', cor=LATAO, tampas=(True, False))
    hk = max(h_no, 0.080)
    meio = (0.070 + hk) / 2
    cabo = [(0.0121, 0.0636), (0.0128, 0.0662), (RG, 0.0690), (RG + 0.0003, meio), (RG, hk - 0.002),
            (0.0142, hk + 0.003), (0.0150, hk + 0.007), (0.0151, hk + 0.010), (0.0144, hk + 0.0132),
            (0.0118, hk + 0.0150), (0.0070, hk + 0.0158)]
    m.torno(cabo, seg, np.zeros(3), EIXO, FRENTE, cel='madeira', cor=NOGUEIRA, tampas=(False, True))
    botao = [(0.0046, hk + 0.0152), (0.0046, hk + 0.0162), (0.0036, hk + 0.0167)]
    m.torno(botao, 16, np.zeros(3), EIXO, FRENTE, cel='latao', cor=LATAO, tampas=(False, True))
    ob = m.objeto('qa_lupa_malha', mat, ang=38)
    return ob, {'h_no': hk, 'comprimento_total': R_ARO + hk + 0.0167, 'raio_pegada': RG}


def raio_cabo(h, h_no):
    """Raio da superfície do cabo/virola na altura h (m ao longo de −Y) para medir a folga dos dedos."""
    hs = [0.0476, 0.0488, 0.0558, 0.0564, 0.0576, 0.0582, 0.0626, 0.0632, 0.0640, 0.0662, 0.0690, (0.070 + h_no) / 2,
          h_no - 0.002, h_no + 0.003, h_no + 0.007, h_no + 0.010, h_no + 0.0132, h_no + 0.0150, h_no + 0.0158]
    rs = [0.0100, 0.0124, 0.0124, 0.0130, 0.0130, 0.0124, 0.0124, 0.0131, 0.0131, 0.0128, RG, RG + 0.0003, RG, 0.0142,
          0.0150, 0.0151, 0.0144, 0.0118, 0.0070]
    return np.interp(h, hs, rs, left=0.0, right=0.0)
