"""Conchas on-ear do headset (vida `techlead`): almofada de couro sintético com costura, que comprime sobre a pele
medida do S13; tecido do alto-falante no furo; casco de plástico fosco com tampa acetinada e chanfro; garfo com pinos de pivô;
deslizador por onde o aço do arco entra; anel de LED no chanfro da concha do microfone (malha própria `tl_led`).

Quadro da concha (Encaixe.copa): o = centro da face de contato, n = eixo para fora, up, fr (frente, +Z).
Ponto (r, θ, t) = o + n·t + (fr·cos θ + up·sin θ)·r; θ = 0 na frente, 90° em cima.
"""
import math

import numpy as np

import prop_techlead_geo as G
import prop_techlead_material as MT

TC = G.R(14.0)                     # espessura da almofada em repouso
RI = G.R(10.0)                     # raio do furo da almofada
PROF = G.R(20.0)                   # profundidade do casco
RS = G.R(30.2)                     # raio do casco
RY = RS + G.R(3.8)                 # raio da linha de centro do garfo
TY = TC + G.R(7.5)                 # profundidade do garfo e dos pinos (articulação = origem da concha)
SEG = 48


def P(q, r, th, t):
    return q['o'] + q['n'] * t + (q['fr'] * math.cos(th) + q['up'] * math.sin(th)) * r


def _perfil_almofada(ro, f0, f1, n):
    """Seção da almofada (superelipse p = 3,2) no plano (r, t), de φ0 a φ1; φ = 0 na borda de fora, −90° na face de
    contato."""
    rc, a = (ro + RI) / 2, (ro - RI) / 2
    tc, b = TC / 2, TC / 2
    out = []
    for f in np.linspace(f0, f1, n + 1):
        c, s = math.cos(f), math.sin(f)
        out.append((f, rc + a * np.sign(c) * abs(c) ** (2 / 3.2), tc + b * np.sign(s) * abs(s) ** (2 / 3.2)))
    return out


def almofada(M, q, enc, ro):
    """Couro com a costura na borda de fora (φ −40°…−20°); a face de contato segue a pele (compressão da espuma)."""
    ths = np.linspace(0, 2 * math.pi, SEG, endpoint=False)
    comp = []

    def ponto(f, r, t, th):
        if t < TC * 0.55:
            a, b = r * math.cos(th), r * math.sin(th)
            h = enc.altura(q['c_pele'], q['n'], q['up'], q['fr'], a, b)
            if h is not None:
                piso = h - q['contato'] + G.R(0.25)
                if piso > t:
                    comp.append(piso - t)
                    t = min(piso, TC * 0.8)
        return P(q, r, th, t)

    zonas = [('couro', -math.pi, -0.70, 6), ('costura', -0.70, -0.35, 3), ('couro', -0.35, math.pi, 11)]
    for cel, f0, f1, n in zonas:
        pts = _perfil_almofada(ro, f0, f1, n)
        grade = [[ponto(f, r, t, th) for f, r, t in pts] for th in ths]
        M.grade(grade, MT.ilha(cel), fecha_i=True)
    fio = [(0.0, TC * 0.52), (RI + G.R(0.6), TC * 0.52), (RI + G.R(0.6), TC * 0.62), (0.0, TC * 0.62)]
    G.revolver(M, fio, q['o'], q['n'], q['fr'], 24, MT.ilha('tecido'))
    return max(comp) if comp else 0.0


def casco(M, q, com_led):
    """Casco: placa atrás da almofada, flange, corpo, ombro arredondado, chanfro (anel de LED na concha E) e tampa."""
    t0 = TC
    corpo = [(0.0, t0), (RS - G.R(1.2), t0), (RS - G.R(0.8), t0 + G.R(0.6)), (RS - G.R(0.2), t0 + G.R(1.4)),
             (RS, t0 + G.R(2.6)), (RS, t0 + G.R(10.5)), (RS - G.R(0.25), t0 + G.R(13.0)),
             (RS - G.R(0.9), t0 + G.R(15.0)), (RS - G.R(2.0), t0 + G.R(16.4)), (RS - G.R(4.4), t0 + G.R(18.8)),
             (RS - G.R(5.4), t0 + G.R(19.6)), (RS - G.R(6.0), t0 + PROF)]
    tampa = [(RS - G.R(6.0), t0 + PROF), (RS - G.R(7.2), t0 + PROF + G.R(0.25)), (0.0, t0 + PROF + G.R(0.25))]
    G.revolver(M, corpo, q['o'], q['n'], q['fr'], SEG, MT.ilha('plastico'))
    G.revolver(M, tampa, q['o'], q['n'], q['fr'], SEG, MT.ilha('acetinado'))
    return {'chanfro': (corpo[8], corpo[9]), 'tampa_t': t0 + PROF + G.R(0.25)}


def led(M, q, chanfro):
    """Anel de LED: faixa sobre o chanfro de 45° (lê de frente e de 3/4), 0,35 mm acima dele, com as bordas dobradas."""
    (r0, t0), (r1, t1) = chanfro
    d = np.array((r1 - r0, t1 - t0))
    d /= np.linalg.norm(d)
    nn = np.array((d[1], -d[0]))                   # normal de fora do chanfro (r e t crescem)
    a = np.array((r0, t0)) + d * G.R(0.4)
    b = np.array((r1, t1)) - d * G.R(0.4)
    off = nn * G.R(0.35)
    perfil = [tuple(a - off), tuple(a + off), tuple(b + off), tuple(b - off)]
    G.revolver(M, perfil + perfil[:1], q['o'], q['n'], q['fr'], SEG, (0.05, 0.05, 0.95, 0.95))


def garfo(M, q):
    """Garfo em U: do pino da frente, por cima, ao pino de trás; pinos de pivô de metal; deslizador em cima."""
    ths = np.radians(np.linspace(-7, 187, 27))
    caminho = [P(q, RY, th, TY) for th in ths]
    G.varrer(M, caminho, G.sec_ret(G.R(5.6), G.R(3.2), G.R(1.1), 2), MT.ilha('plastico'), ref=q['n'])
    for th in (0.0, math.pi):
        eixo = q['fr'] * math.cos(th) + q['up'] * math.sin(th)
        base = q['o'] + q['n'] * TY
        perfil = [(0.0, RS - G.R(0.4)), (G.R(2.0), RS - G.R(0.4)), (G.R(2.0), RY + G.R(1.5)),
                  (G.R(1.6), RY + G.R(2.0)), (0.0, RY + G.R(2.1))]
        G.revolver(M, perfil, base, eixo, q['n'], 12, MT.ilha('pino'))
    topo = P(q, RY, math.pi / 2, TY)
    alt = G.R(19.0)
    caminho = [topo + q['up'] * (G.R(-1.5) + alt * k / 5) for k in range(6)]
    G.varrer(M, caminho, G.sec_ret(G.R(8.0), G.R(12.5), G.R(2.4), 3), MT.ilha('plastico'), ref=q['n'],
             escala=lambda k: 1.0 - 0.10 * max(0.0, (k - 0.75) / 0.25))
    return topo + q['up'] * (G.R(-1.5) + alt)


def construir(q, enc, materiais, com_led):
    """Monta a concha do lado q['s']; devolve (objetos, pontos-chave)."""
    M = G.Malha()
    comp = almofada(M, q, enc, RS + G.R(0.8))
    info = casco(M, q, com_led)
    S = garfo(M, q)
    nome = 'tl_concha_e' if q['s'] > 0 else 'tl_concha_d'
    piv = q['o'] + q['n'] * TY
    ob = M.objeto(nome, [materiais[0]], origem=piv)
    objs = [ob]
    if com_led:
        L = G.Malha()
        led(L, q, info['chanfro'])
        objs.append(L.objeto('tl_led', [materiais[1]], origem=piv, ponderada=False))
    k = {'pivo': piv, 'S': S, 'U': q['up'], 'tampa': q['o'] + q['n'] * info['tampa_t'],
         'compressao_mm': round(comp * 1000, 2), 'profundidade_total_m': round(info['tampa_t'], 4)}
    return objs, k
