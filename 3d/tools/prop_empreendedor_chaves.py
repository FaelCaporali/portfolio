"""E5 `chaves`: molho de chaves real — argola partida de aço e quatro chaves de tipos diferentes penduradas nela.

Argola partida: fita de aço de seção oval achatada (1,7 × 0,9 mm) em 1,85 volta helicoidal, pontas cortadas.
Chaves (modeladas em milímetros do objeto real; K leva a metros e a vitrine reescala):
- Yale de latão: cabeça oval com furo, lâmina com segredo de cinco cortes em V, batente e friso do canal;
- tetra de aço: cabeça, colarinho torneado e lâmina em cruz (duas aletas cruzadas) com entalhes nas quatro bordas;
- chave de carro: cabeça de plástico injetado (chanfro largo) e lâmina de aço com a trilha ondulada fresada;
- chave de cadeado: pequena, latão envelhecido, três cortes.
Cada chave pende pelo furo: o fio da argola apoia no topo interno do furo; as chaves abrem em leque pelo peso e giram
um pouco para a câmera (o furo é folgado). Materiais: metal (metal 1, rug 0,33; aço/latão por cor de vértice) e
plástico (rug 0,5). Espaço da peça: Z para cima, frente para −Y.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import prop_empreendedor_base as B

K = 0.0014                                          # metros por milímetro do objeto real
CC = {'aco': '#c3c5c8', 'niquel': '#aeb1b5', 'latao': '#c8a360', 'latao_velho': '#a98a52', 'plastico': '#1f2023',
      'trilha': '#7d8187'}
ARG = {'R': 12.5, 'larg': 1.7, 'alt': 0.9, 'voltas': 1.85, 'passo': 1.0}


def _se(c, n):
    return math.copysign(abs(c) ** (2 / n), c)


def oval(a, b, n=2.0, c=(0.0, 0.0), seg=16):
    """Contorno superelíptico anti-horário a partir do topo (mesmo `seg` casa contorno e furo)."""
    return [(c[0] + a * _se(math.cos(t), n), c[1] + b * _se(math.sin(t), n))
            for t in (math.pi / 2 + 2 * math.pi * k / seg for k in range(seg))]


def _solido(t, fs, esp, bev, seg, fora=0.0):
    """Extruda as faces `fs` em z (0..esp) e chanfra só o perímetro de frente e de trás (as arestas verticais e,
    com `fora`, as do furo de raio < fora ficam vivas: abaixo de 1 px na vitrine e dobrariam os triângulos)."""
    ext_ = bmesh.ops.extrude_face_region(t, geom=fs)
    bmesh.ops.translate(t, verts=[e for e in ext_['geom'] if isinstance(e, bmesh.types.BMVert)], vec=(0, 0, esp))
    bmesh.ops.recalc_face_normals(t, faces=t.faces)
    borda = [e for e in t.edges if e.is_manifold and e.calc_face_angle(0) > math.radians(30)
             and any(abs(f.normal.z) > 0.9 for f in e.link_faces)
             and ((e.verts[0].co.xy + e.verts[1].co.xy) / 2).length > fora]
    if bev:
        bmesh.ops.bevel(t, geom=borda, offset=bev, segments=seg, profile=0.5, affect='EDGES', clamp_overlap=True)


def placa_furo(bm, ext, furo, esp, bev, mapa, seg=1):
    """Placa de contorno `ext` vazada por `furo` (mesmo nº de pontos, furo centrado na origem), extrudada em z."""
    t = bmesh.new()
    n = len(ext)
    vo = [t.verts.new((x, y, 0)) for x, y in ext]
    vi = [t.verts.new((x, y, 0)) for x, y in furo]
    fs = [t.faces.new((vo[k], vo[(k + 1) % n], vi[(k + 1) % n], vi[k])) for k in range(n)]
    _solido(t, fs, esp, bev, seg, fora=1.2 * max(math.hypot(x, y) for x, y in furo))
    return B.anexar(bm, t, mapa)


def lamina(bm, contorno, esp, bev=0.0, seg=1, mapa=None):
    """Contorno 2D extrudado (assinatura de B.placa) com chanfro só no perímetro de frente e de trás."""
    t = bmesh.new()
    _solido(t, [t.faces.new([t.verts.new((x, y, 0)) for x, y in contorno])], esp, bev, seg)
    if mapa is None:
        return B.anexar(bm, t, lambda p: p)
    return B.anexar(bm, t, mapa)


def toro(bm, R, r, seg, segr, lugar):
    perfil = [(R + r * math.cos(2 * math.pi * k / segr), r * math.sin(2 * math.pi * k / segr)) for k in range(segr)]
    return B.torno(bm, perfil + [perfil[0]], seg, mapa=lugar)


def argola(bm, M, n=16, lados=6):
    """Argola partida: hélice de 1,85 volta (passo = espessura da fita), seção oval achatada, pontas fechadas."""
    R, lg, al, vt, ps = ARG['R'], ARG['larg'], ARG['alt'], ARG['voltas'], ARG['passo']
    aneis = []
    for i in range(int(vt * n) + 1):
        a = 2 * math.pi * i / n
        rad = Vector((math.cos(a), math.sin(a), 0))
        c = rad * R + Vector((0, 0, ps * (a / (2 * math.pi) - vt / 2)))
        aneis.append([bm.verts.new(M @ (c + rad * (lg / 2 * math.cos(2 * math.pi * j / lados))
                                        + Vector((0, 0, al / 2 * math.sin(2 * math.pi * j / lados)))))
                      for j in range(lados)])
    fs = [bm.faces.new((A[j], A[(j + 1) % lados], C[(j + 1) % lados], C[j]))
          for A, C in zip(aneis, aneis[1:]) for j in range(lados)]
    return fs + [bm.faces.new(aneis[0][::-1]), bm.faces.new(aneis[-1])]


def quadro_argola(z, giro=40):
    """Matriz da argola (mm): centro a `z` do chão, plano vertical girado `giro`° da frente."""
    return Matrix.Translation((0, 0, z)) @ Matrix.Rotation(math.radians(giro), 4, 'Z') @ \
        Matrix.Rotation(math.pi / 2, 4, 'X')


def ponto(Marg, a):
    return Marg @ Vector((ARG['R'] * math.cos(a), ARG['R'] * math.sin(a), 0))


def pendurar(Marg, a, folga, psi, tau):
    """Matriz da peça pendurada no ponto `a` (rad) da argola: a origem local (centro do furo) fica `folga` mm abaixo
    do fio no eixo da peça; gira `psi` em Z (0 = de frente) e abre `tau` no próprio plano (leque)."""
    Rk = Matrix.Rotation(psi, 4, 'Z') @ Matrix.Rotation(tau, 4, 'Y')
    return Matrix.Translation(ponto(Marg, a) - Rk.to_3x3() @ Vector((0, 0, folga))) @ Rk


def _m(M, e):
    """Plano da chave: contorno (u, v) no plano XZ, espessura `e` centrada em Y."""
    return lambda p: M @ Vector((p.x, p.z - e / 2, p.y))


def _segredo(borda, cortes):
    """Pontos da borda do segredo (subindo): cortes em V [(v, profundidade)]."""
    pts = []
    for v, d in cortes:
        pts += [(borda, v - 1.8), (borda - d, v), (borda, v + 1.8)]
    return pts


def yale(bm, bm_p, M):
    f = placa_furo(bm, oval(12.5, 11.0, 2.6, (0, -5.2), 12), oval(2.9, 2.9, 2, (0, 0), 12), 2.4, 0.45, _m(M, 2.4))
    lam = [(-4.2, -12.0), (-4.2, -44.0), (-2.4, -47.0), (1.6, -47.0), (4.4, -44.4)]
    lam += _segredo(4.4, [(-41.0, 1.4), (-36.6, 2.5), (-32.2, 0.9), (-27.8, 2.1), (-23.4, 1.6)])
    lam += [(4.4, -19.2), (6.0, -17.6), (6.0, -12.0)]
    f += lamina(bm, lam, 2.0, 0.3, 1, _m(M, 2.0))
    for lado, (u0, u1) in ((-1, (-3.0, 0.4)),):                          # friso do canal (face da câmera)
        f += lamina(bm, [(u0, -43.0), (u1, -43.0), (u1, -19.8), (u0, -19.8)], 0.3, 0.08, 1,
                     lambda p, s=lado: M @ Vector((p.x, s * (1.0 + p.z), p.y)))
    B.pintar(bm, f, CC['latao'])


def _lamina_tetra(entalhes, w=3.1, d=0.9):
    esq = [(-w, -17.5)]
    for v in sorted(entalhes, reverse=True):
        esq += [(-w, v + 1.1), (-w + d, v + 0.7), (-w + d, v - 0.7), (-w, v - 1.1)]
    esq += [(-w, -44.5), (-1.6, -46.2)]
    return esq + [(-x, y) for x, y in reversed(esq)]


def tetra(bm, bm_p, M):
    f = placa_furo(bm, oval(12.0, 10.0, 2.2, (0, -5.8), 12), oval(2.9, 2.9, 2, (0, 0), 12), 3.0, 0.55, _m(M, 3.0))
    f += B.torno(bm, [(0, -14.0), (3.1, -14.0), (3.4, -14.6), (3.4, -17.6), (2.7, -18.4), (0, -18.4)], 8,
                 mapa=lambda p: M @ p)
    f += lamina(bm, _lamina_tetra((-39.0, -29.5)), 1.5, 0.2, 1, _m(M, 1.5))
    f += lamina(bm, _lamina_tetra((-34.0,)), 1.5, 0.2, 1,
                 lambda p: M @ Vector((p.z - 0.75, p.x, p.y)))
    B.pintar(bm, f, CC['aco'])


def carro(bm, bm_p, M):
    B.pintar(bm_p, placa_furo(bm_p, oval(11.0, 14.5, 3.4, (0, -10.5), 14), oval(2.6, 2.6, 2, (0, 0), 14), 6.4, 1.3,
                              _m(M, 6.4), seg=2), CC['plastico'])
    lam = [(-4.2, -21.0), (-4.2, -55.0), (-3.2, -58.6), (-1.2, -60.0), (1.2, -60.0), (3.2, -58.6), (4.2, -55.0),
           (4.2, -21.0)]
    B.pintar(bm, lamina(bm, lam, 2.6, 0.35, 1, _m(M, 2.6)), CC['niquel'])
    vs = [-26.0 - 4.0 * i for i in range(8)]
    onda = [1.3 * math.sin((v + 26.0) / 4.0) for v in vs]
    trilha = [(c - 1.0, v) for c, v in zip(onda, vs)] + [(c + 1.0, v) for c, v in reversed(list(zip(onda, vs)))]
    for lado in (-1,):                                                     # trilha fresada (face da câmera)
        B.pintar(bm, lamina(bm, trilha, 0.1, 0, mapa=lambda p, s=lado: M @ Vector((p.x, s * (1.3 + p.z), p.y))),
                 CC['trilha'])


def cadeado(bm, bm_p, M):
    f = placa_furo(bm, oval(8.0, 7.2, 2.4, (0, -3.6), 10), oval(2.2, 2.2, 2, (0, 0), 10), 2.0, 0.4, _m(M, 2.0))
    lam = [(-2.4, -9.0), (-2.4, -26.0), (-1.2, -27.6), (2.6, -27.6)]
    lam += _segredo(2.6, [(-24.6, 1.2), (-20.4, 0.6), (-16.2, 1.0)])[1:]
    lam += [(2.6, -13.0), (3.8, -11.8), (3.8, -9.0)]
    f += lamina(bm, lam, 1.6, 0.25, 1, _m(M, 1.6))
    B.pintar(bm, f, CC['latao_velho'])


FOLGA = {yale: 2.9, tetra: 2.9, carro: 2.6, cadeado: 2.2}                  # raio do furo de cada chave


def pendura_chave(bm, bm_p, G, Marg, fn, a, psi, tau):
    fn(bm, bm_p, G @ pendurar(Marg, math.radians(a), FOLGA[fn] - ARG['larg'] / 2, psi, tau))


def chaves(mats):
    metal, plastico = mats('metal', 1.0, 0.33), mats('plastico', 0.0, 0.5)
    bm, bm_p = bmesh.new(), bmesh.new()
    G, Marg = Matrix.Scale(K, 4), quadro_argola(76.0)
    B.pintar(bm, argola(bm, G @ Marg), CC['aco'])
    for fn, a, psi, tau in ((yale, -130, -0.40, 0.36), (tetra, -112, -0.20, 0.14), (carro, -94, -0.45, -0.04),
                            (cadeado, -62, -0.10, -0.48)):
        pendura_chave(bm, bm_p, G, Marg, fn, a, psi, tau)
    return [B.objeto('chaves_metal', bm, metal, ang=60), B.objeto('chaves_plastico', bm_p, plastico, ang=60)]
