"""E5/E9 `chaves_negocios`: o mesmo molho (argola partida, Yale e tetra) em que cada CHAVEIRO é um negócio.

Chaveiros de verdade, em miniatura (resina/madeira/metal), cada um com olhal parafusado e argolinha de aço enfiada na
argola grande — a argolinha em plano cruzado com o olhal, como elos reais:
- SUP: a prancha do `sup` (mesmas funções, menos estações), 58 mm, bico para cima, deck pad e quilha;
- doce: o brigadeiro do `brigadeiros` (forminha plissada e casca de granulado), 24 mm;
- hostel: o chaveiro torneado do `chave_quarto` (olhal, bojo de madeira, medalhão liso), 48 mm;
- tech: o foguete do `foguete` (corpo de alumínio, coifa pintada, janela, quatro aletas, tubeira), 44 mm, mais leve.
Materiais: metal (aço, latão, alumínio; metal 1, rug 0,33) e resina/madeira (rug 0,42: miniatura envernizada).
Unidades em mm do objeto real (K de prop_empreendedor_chaves); espaço da peça Z para cima, frente −Y.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import prop_empreendedor_base as B
import prop_empreendedor_chaves as CH
import prop_empreendedor_doces as doces
import prop_empreendedor_hostel as hostel
import prop_empreendedor_sup as sup
import prop_empreendedor_tech as tech

RJ, WJ = 3.2, 0.5                  # argolinha: raio, raio do fio (mm)
RO, WO = 1.9, 0.45                 # olhal parafusado
TOPO = -(RO + 1.6)                 # onde a peça começa, abaixo do centro do olhal (a rosca entra nela)
XZ = Matrix.Rotation(math.pi / 2, 4, 'X')
FORMINHA = '#a8875c'                 # forminha de papel kraft (a creme do `brigadeiros` virava mancha clara)


def olhal(bm, M):
    """Olhal no plano da peça (XZ), centro na origem, e a haste de rosca descendo para dentro da peça."""
    f = CH.toro(bm, RO, WO, 8, 4, lambda p: M @ (XZ @ p))
    f += B.torno(bm, [(0, -RO - 2.4), (0.55, -RO - 2.4), (0.55, -RO + 0.2), (0, -RO + 0.2)], 5, mapa=lambda p: M @ p)
    B.pintar(bm, f, CH.CC['aco'])


def mini_sup(bm_m, bm_r, M):
    ns, nr = sup.NS, sup.NR
    sup.NS, sup.NR = 11, 8
    t = bmesh.new()
    sup.prancha(t)
    sup.quilha(t)
    sup.NS, sup.NR = ns, nr
    desf = sup.INCL.inverted()
    pad = []
    for fc in t.faces:                             # deck pad pintado no deck (−Y), entre a rabeta e o meio
        c = desf @ fc.calc_center_median()
        tt = c.z / sup.L
        if 0.06 < tt < 0.5 and c.y < -sup.rocker(tt) - 0.25 * sup.esp(tt) and abs(c.x) < 0.8 * sup.meia(tt):
            pad.append(fc)
    B.pintar(t, pad, sup.COR['pad'])
    f = 58.0 / sup.L
    nariz = desf @ Vector((0, -sup.rocker(1.0), sup.L))
    B.anexar(bm_r, t, lambda p: M @ ((desf @ p - nariz) * f + Vector((0, 0, TOPO + 0.6))))
    olhal(bm_m, M)


def mini_brigadeiro(bm_m, bm_r, M):
    f = 1150.0                                     # m do `brigadeiros` → mm do chaveiro (forminha de 24 mm)
    zb = TOPO + 0.5 - 0.01704 * f
    forminha = [(0, 0), (0.0074, 0), (0.0104, 0.0085), (0.0100, 0.0088), (0.0071, 0.0005), (0, 0.0005)]
    fs = B.torno(bm_r, [(r * f, z * f) for r, z in forminha], 12,
                 raio=lambda r, z, a: r * (1 + 0.07 * math.cos(6 * a + 0.7) * min(1.0, r / (0.0074 * f))),
                 mapa=lambda p: M @ (p + Vector((0, 0, zb))))
    B.pintar(bm_r, fs, FORMINHA)
    c1, c2, amp = doces.CASCAS[0]
    rs = 0.0093 * f
    perfil = [(rs * math.sin(math.pi * k / 6), -rs * 0.9 * math.cos(math.pi * k / 6)) for k in range(7)]
    perfil = [(0 if abs(r) < 1e-6 else r, z) for r, z in perfil]
    c = Vector((0, 0, zb + (0.0083 * 0.9 + 0.0012) * f))
    fs = B.torno(bm_r, perfil, 8, raio=lambda r, z, a: r * (1 + amp * (B.hash01(round(z * 4), round(a * 30)) - 0.5)),
                 mapa=lambda p: M @ (p + c))
    B.pintar(bm_r, fs, lambda fc: c1 if B.hash01(*(fc.calc_center_median() * 3), 1) > 0.45 else c2)
    olhal(bm_m, M)


def mini_hostel(bm_m, bm_r, M):
    """O chaveiro do `chave_quarto` (o olhal de latão dele é o olhal do elo), escalado para 48 mm."""
    f = 620.0
    hostel.chaveiro(bm_m, bm_r, lambda q: M @ ((q - Vector((0, 0, 0.0932))) * f), seg=8)


def mini_foguete(bm_m, bm_r, M):
    """Perfis do `foguete` com menos segmentos (sem as juntas de painel) (chaveiro de 44 mm), de pé, olhal no bico."""
    f, R, ZC = 340.0, 0.0142, 0.080

    def lugar(p):
        return M @ ((p - Vector((0, 0, ZC + 0.050))) * f + Vector((0, 0, TOPO + 0.4)))
    corpo = [(0, 0.018), (0.0100, 0.018), (0.0128, 0.025), (R, 0.036), (R, ZC - 0.0008), (R + 0.0003, ZC), (0, ZC)]
    B.pintar(bm_m, B.torno(bm_m, corpo, 8, mapa=lugar), tech.CF['aluminio'])
    coifa = [(0, ZC + 0.0002), (R + 0.0001, ZC)] + [(R * math.cos(t * math.pi / 2) ** 0.7, ZC + 0.050 * t)
                                                     for t in (0.3, 0.62, 0.86)] + [(0, ZC + 0.050)]
    B.pintar(bm_r, B.torno(bm_r, coifa, 8, mapa=lugar), tech.CF['tinta'])
    tubeira = [(0, 0.0185), (0.0062, 0.0185), (0.0070, 0.0095), (0.0096, 0.0022), (0.0086, 0.0020), (0.0050, 0.0110),
               (0, 0.0110)]
    B.pintar(bm_m, B.torno(bm_m, tubeira, 8, mapa=lugar), tech.CF['escuro'])
    zj = 0.069
    vidro = [(0, 0.0009), (0.0054, 0.0002), (0.0054, -0.0012), (0, -0.0012)]
    B.pintar(bm_r, B.torno(bm_r, vidro, 8, mapa=lambda p: lugar(XZ @ p + Vector((0, -R + 0.0004, zj)))),
             tech.CF['vidro'])
    aleta = [(-0.0008, 0.047), (0.0060, 0.034), (0.0132, 0.017), (0.0146, 0.007), (0.0142, 0.0035),
             (0.0118, 0.0040), (0.0062, 0.0125), (-0.0008, 0.0195)]
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        rd, tg = Vector((math.cos(a), math.sin(a), 0)), Vector((-math.sin(a), math.cos(a), 0))
        B.pintar(bm_r, CH.lamina(bm_r, aleta, 0.0016, 0.0005, 1,
                               lambda p, rd=rd, tg=tg: lugar(rd * (0.0122 + p.x) + tg * (p.z - 0.0008)
                                                             + Vector((0, 0, p.y)))), tech.CF['tinta'])
    olhal(bm_m, M)


def pendura_chaveiro(bm_m, bm_r, G, Marg, fn, a, psi, tau):
    """Argolinha enfiada na argola grande (apoia no fio), plano cruzado com o da peça; o olhal apoia na argolinha."""
    a = math.radians(a)
    Cj = CH.ponto(Marg, a) + Vector((0, 0, CH.ARG['larg'] / 2 - RJ + WJ))
    Rp = Matrix.Rotation(psi, 4, 'Z')
    Mj = Matrix.Translation(Cj) @ Rp @ Matrix.Rotation(math.pi / 2, 4, 'Z') @ XZ
    B.pintar(bm_m, CH.toro(bm_m, RJ, WJ, 8, 4, lambda p: G @ (Mj @ p)), CH.CC['aco'])
    O = Cj + Vector((0, 0, -RJ + WJ - RO + WO))
    fn(bm_m, bm_r, G @ Matrix.Translation(O) @ Rp @ Matrix.Rotation(tau, 4, 'Y'))


def chaves_negocios(mats):
    metal, resina = mats('metal', 1.0, 0.33), mats('resina', 0.0, 0.42)
    bm_m, bm_r = bmesh.new(), bmesh.new()
    G, Marg = Matrix.Scale(CH.K, 4), CH.quadro_argola(82.0)
    B.pintar(bm_m, CH.argola(bm_m, G @ Marg), CH.CC['aco'])
    # Leque: o curto (doce) na frente à esquerda, alto; os longos abrem para os lados; chaves entre eles.
    for fn, a, psi, tau in ((mini_brigadeiro, -140, -0.15, 0.50), (mini_sup, -124, 0.05, 0.26),
                            (CH.yale, -108, -0.45, 0.10), (mini_hostel, -92, -0.10, -0.05),
                            (CH.tetra, -76, -0.30, -0.20), (mini_foguete, -58, 0.15, -0.36)):
        if fn in CH.FOLGA:
            CH.pendura_chave(bm_m, bm_r, G, Marg, fn, a, psi, tau)
        else:
            pendura_chaveiro(bm_m, bm_r, G, Marg, fn, a, psi, tau)
    return [B.objeto('negocios_metal', bm_m, metal, ang=60), B.objeto('negocios_resina', bm_r, resina, ang=60)]
