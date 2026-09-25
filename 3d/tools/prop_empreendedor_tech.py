"""E4: `foguete` (foguete "startup launch" de qualidade) e `notebook` (notebook aberto com adesivos na tampa).

foguete: corpo de alumínio torneado (saia cônica, cilindro com duas juntas de painel rebaixadas), coifa ogival
pintada, janela redonda (aro de alumínio e vidro escuro abaulado), quatro aletas enflechadas com espessura e chanfro,
tubeira de sino em metal escuro. Inclinado 11° para longe do rosto (subindo). Sem chama: nada de neon.
Materiais: alumínio (metal 1, rug 0,3) e pintura/vidro (rug 0,35).
notebook: base e tampa de alumínio de cantos redondos, dobradiça, teclado e trackpad; tampa aberta ~105° com o VERSO
para a câmera, coberto de adesivos de vinil recortados (borda branca, formas sem marca e sem texto).
Materiais: alumínio (metal 1, rug 0,35) e vinil/tela (rug 0,5).
"""
import math

import bmesh
from mathutils import Matrix, Vector

import prop_empreendedor_base as B

CF = {'aluminio': '#bcc0c6', 'escuro': '#3b3d41', 'tinta': '#8e3a2c', 'vidro': '#15181c'}


def foguete(mats):
    alu, tinta = mats('aluminio', 1.0, 0.3), mats('pintura', 0.0, 0.35)
    R, ZC = 0.0142, 0.080
    incl = Matrix.Rotation(math.radians(-11), 4, 'Y') @ Matrix.Translation((0, 0, 0.004))
    bm_a, bm_t = bmesh.new(), bmesh.new()
    corpo = [(0, 0.018), (0.0100, 0.018), (0.0112, 0.0195), (0.0128, 0.025), (0.0139, 0.032), (R, 0.036)]
    for zj in (0.044, 0.062):
        corpo += [(R, zj - 0.0006), (R - 0.00045, zj - 0.0002), (R - 0.00045, zj + 0.0002), (R, zj + 0.0006)]
    corpo += [(R, ZC - 0.0008), (R + 0.0003, ZC - 0.0004), (R + 0.0003, ZC), (0, ZC)]
    B.pintar(bm_a, B.torno(bm_a, corpo, 20, mapa=lambda p: incl @ p), CF['aluminio'])
    coifa = [(R + 0.0001, ZC)] + [(R * math.cos(t * math.pi / 2) ** 0.7, ZC + 0.050 * t)
                                  for t in (i / 8 for i in range(1, 8))] + [(0.0009, ZC + 0.0497), (0, ZC + 0.050)]
    coifa = [(0, ZC + 0.0002)] + coifa
    B.pintar(bm_t, B.torno(bm_t, coifa, 20, mapa=lambda p: incl @ p), CF['tinta'])
    tubeira = [(0, 0.0185), (0.0062, 0.0185), (0.0060, 0.0145), (0.0070, 0.0095), (0.0092, 0.0035), (0.0096, 0.0022),
               (0.0089, 0.0020), (0.0064, 0.0085), (0.0042, 0.0130), (0, 0.0130)]
    B.pintar(bm_a, B.torno(bm_a, tubeira, 16, mapa=lambda p: incl @ p), CF['escuro'])
    # Janela na frente (−Y): aro de alumínio e vidro escuro abaulado.
    zj, frente = 0.071, Matrix.Rotation(math.pi / 2, 4, 'X')
    aro = [(0.0052 + 0.0011 * math.cos(2 * math.pi * k / 6), 0.0011 * math.sin(2 * math.pi * k / 6)) for k in range(7)]
    B.pintar(bm_a, B.torno(bm_a, aro, 20, mapa=lambda p: incl @ (frente @ p + Vector((0, -R + 0.0006, zj)))),
             CF['aluminio'])
    vidro = [(0, 0.0009), (0.0030, 0.0007), (0.0053, 0.0), (0.0053, -0.0012), (0, -0.0012)]
    B.pintar(bm_t, B.torno(bm_t, vidro, 16, mapa=lambda p: incl @ (frente @ p + Vector((0, -R + 0.0004, zj)))),
             CF['vidro'])
    # Aletas enflechadas: contorno (distância para fora do casco, altura), espessura 1,6 mm.
    aleta = [(-0.0008, 0.047), (0.0060, 0.034), (0.0132, 0.017), (0.0146, 0.007), (0.0142, 0.0035),
             (0.0118, 0.0040), (0.0062, 0.0125), (-0.0008, 0.0195)]
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        rd, tg = Vector((math.cos(a), math.sin(a), 0)), Vector((-math.sin(a), math.cos(a), 0))
        f = B.placa(bm_t, aleta, 0.0016, 0.0005, 1,
                    lambda p, rd=rd, tg=tg: incl @ (rd * (0.0122 + p.x) + tg * (p.z - 0.0008) + Vector((0, 0, p.y))))
        B.pintar(bm_t, f, CF['tinta'])
    return [B.objeto('foguete_aluminio', bm_a, alu, ang=50), B.objeto('foguete_pintura', bm_t, tinta, ang=50)]


CN = {'aluminio': '#8f9298', 'dobradica': '#5d6065', 'trackpad': '#999ca2', 'tela': '#0f1113', 'teclas': '#1b1c1f',
      'branco': '#ece8df'}
ADESIVOS = [  # (forma, tamanho, centro na tampa (x, s), giro°, cor, detalhe)
    ('hex', 0.0092, (-0.026, 0.047), 0, '#3f7775', ('hex', 0.0045, '#d9d3c4')),
    ('circ', 0.0082, (0.021, 0.050), 0, '#c29943', ('circ', 0.0035, '#2d3440')),
    ('pilula', (0.024, 0.0105), (0.019, 0.022), 12, '#b3604c', None),
    ('circ', 0.0052, (-0.035, 0.019), 0, '#e6e1d6', ('circ', 0.0022, '#b3604c')),
    ('pilula', (0.017, 0.0065), (-0.008, 0.030), -22, '#33475a', None),
    ('hex', 0.0062, (0.038, 0.035), 30, '#7a8b98', None),
]


def _forma(tipo, tam, n=14):
    if tipo == 'hex':
        return [(tam * math.cos(math.pi / 3 * k + math.pi / 6), tam * math.sin(math.pi / 3 * k + math.pi / 6))
                for k in range(6)]
    if tipo == 'circ':
        return [(tam * math.cos(2 * math.pi * k / n), tam * math.sin(2 * math.pi * k / n)) for k in range(n)]
    w, h = tam
    return [(x, y) for x, y in B.ret_arred(w, h, h / 2 - 1e-5, 3)]


def notebook(mats):
    alu, vinil = mats('aluminio', 1.0, 0.35), mats('vinil', 0.0, 0.5)
    LX, LY, EB, ET = 0.100, 0.068, 0.0045, 0.0034
    ab = math.radians(15)                       # tampa passa 15° da vertical (aberta ~105°)
    sobe, fora = Vector((0, math.sin(ab), math.cos(ab))), Vector((0, -math.cos(ab), math.sin(ab)))
    dob = Vector((0, -LY / 2 + 0.0022, EB + 0.0012))
    contorno = B.ret_arred(LX, LY, 0.0045, 4)
    bm_a, bm_v = bmesh.new(), bmesh.new()
    B.pintar(bm_a, B.placa(bm_a, contorno, EB, 0.0009, 2), CN['aluminio'])

    def tampa(x, s, t):
        return dob + Vector((x, 0, 0)) + sobe * (s + 0.0012) + fora * (t - ET)

    B.pintar(bm_a, B.placa(bm_a, contorno, ET, 0.0008, 2, lambda p: tampa(p.x, p.y + LY / 2, p.z)), CN['aluminio'])
    B.pintar(bm_a, B.torno(bm_a, [(0, -0.040), (0.0021, -0.040), (0.0023, -0.039), (0.0023, 0.039), (0.0021, 0.040),
                                  (0, 0.040)], 12, mapa=lambda p: dob + Vector((p.z, p.x, p.y))),
             CN['dobradica'])
    B.pintar(bm_a, B.anexar(bm_a, B.caixa(0.032, 0.019, 0.0006, 0.0015, 3),
                            lambda p: p + Vector((0, LY / 2 - 0.0155, EB - 0.00022))), CN['trackpad'])
    # Tela (face interna da tampa, virada para +Y) e teclado rebaixado.
    B.pintar(bm_v, B.anexar(bm_v, B.caixa(LX - 0.009, LY - 0.011, 0.0004, 0.0003, 1),
                            lambda p: tampa(p.x, LY / 2 + 0.0015 + p.y, -0.00012 + p.z)), CN['tela'])
    B.pintar(bm_v, B.anexar(bm_v, B.caixa(LX - 0.014, 0.029, 0.0006, 0.0006, 2),
                            lambda p: p + Vector((0, -0.006, EB - 0.00018))), CN['teclas'])
    # Adesivos de vinil no verso da tampa: borda branca recortada + cor + detalhe (sem letras).
    for tipo, tam, (cx, cs), giro, cor, det in ADESIVOS:
        g = Matrix.Rotation(math.radians(giro), 2)
        camadas = [(_forma(tipo, tuple(t + 0.0016 for t in tam) if isinstance(tam, tuple) else tam + 0.0012),
                    0.00018, CN['branco']), (_forma(tipo, tam), 0.00030, cor)]
        if det:
            camadas.append((_forma(det[0], det[1]), 0.00040, det[2]))
        for pts, alt, c in camadas:
            pts = [g @ Vector(p) for p in pts]
            f = B.placa(bm_v, [(p.x, p.y) for p in pts], alt, mapa=lambda p: tampa(cx + p.x, cs + p.y, ET + p.z))
            B.pintar(bm_v, f, c)
    return [B.objeto('notebook_aluminio', bm_a, alu, ang=45), B.objeto('notebook_vinil', bm_v, vinil, ang=45)]
