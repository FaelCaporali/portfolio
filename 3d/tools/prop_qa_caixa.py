"""E7 `qa_caixa`: caixa entomológica de mesa. Moldura de nogueira escura com perfil (chanfro externo, face, chanfro
da vista e rebaixo do vidro) varrido em meia-esquadria; vidro de 1,2 mm no rebaixo; fundo de cortiça clara; 8
espécimes em grade 3 × 3 (formas de besouro variadas, cores dessaturadas e 3 vermelhos), cada um num alfinete de aço
com cabeça de náilon preto que ATRAVESSA O TÓRAX, com etiqueta de papel embaixo (linhas ilegíveis de propósito); a 9ª
posição é a VAGA LIVRE: alfinete espetado e etiqueta em branco. Cavalete de nogueira com dobradiça de latão atrás.

Quadro local (glb) = nó `qa_caixa`: origem no CENTRO DA ARESTA DE APOIO (aresta de trás da base, na mesa), +Y para
cima (vertical), +Z para a frente (câmera), +X ao longo da mesa. A caixa se inclina LEAN graus para trás, apoiada
nessa aresta e no cavalete. Medidas em m do scan: 0,130 × 0,094 × 0,024 (≈ 11 × 8 × 2 cm reais).
"""
import math

import numpy as np

import prop_qa_especimes as ESP
import prop_qa_util as U

W, HH, D = 0.130, 0.094, 0.024
LEAN = 20.0
INSET = 0.0074
Z_VIDRO = (-0.0048, -0.0036)
Z_CORTICA = -0.0195
NOGUEIRA, NOGUEIRA_SOMBRA, CORTICA, PAPEL, ACO, NYLON = ('#3a2416', '#241509', '#d9bd93', '#f0eadb', '#c3c7cc',
                                                         '#141416')
ESPECIMES = [('besouro-alongado', 0.40), ('besouro-vermelho', 0.50), ('besouro-rinoceronte', 0.44),
             ('percevejo-vermelho', 0.62), ('formiga', 0.74), ('gorgulho', 0.44),
             ('mosca', 0.80), ('joaninha', 0.48)]                # 3 vermelhos; a 9ª posição é a vaga livre


def _rot_lean(p):
    """Local da caixa (frente em z = 0, aresta de trás da base em (0, 0, −D)) → quadro do nó."""
    q = np.asarray(p, float) - (0, 0, -D)
    t = math.radians(-LEAN)
    return np.array((q[0], q[1] * math.cos(t) - q[2] * math.sin(t), q[1] * math.sin(t) + q[2] * math.cos(t)))


def _M_lean():
    M = np.eye(4)
    t = math.radians(-LEAN)
    M[1, 1], M[1, 2], M[2, 1], M[2, 2] = math.cos(t), -math.sin(t), math.sin(t), math.cos(t)
    M[:3, 3] = M[:3, :3] @ np.array((0, 0, D))
    return M


def _bloco(m, c, semi, cel, cor, uv_topo=None, fundo=True):
    """Caixa de 6 faces (glb; sem a de −Z se `fundo` False); uv_topo = (u0, v0, u1, v1) na célula da face +Z."""
    c, s = np.asarray(c, float), np.asarray(semi, float)
    P = [c + s * np.array(k) for k in ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1),
                                       (1, 1, 1), (-1, 1, 1))]
    V = m.verts(P)
    cc = U.celula_uv(cel, (0.5, 0.5))
    for f in ((0, 3, 2, 1), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7))[0 if fundo else 1:]:
        m.face([V[i] for i in f], [cc] * 4, U.lin(cor))
    u0, v0, u1, v1 = uv_topo or (0.05, 0.05, 0.95, 0.95)
    m.face([V[4], V[5], V[6], V[7]], [U.celula_uv(cel, q) for q in ((u0, v0), (u1, v0), (u1, v1), (u0, v1))],
           U.lin(cor))


def moldura(m):
    """Perfil (recuo, z) varrido no retângulo em meia-esquadria; UV u = perfil, v = ao longo da régua (veio)."""
    perfil = [(0, -D), (0, -0.0025), (0.0004, -0.0008), (0.0013, 0), (0.0060, 0), (0.0069, -0.0005),
              (INSET, -0.0014), (INSET, Z_VIDRO[1]), (0.0062, Z_VIDRO[1]), (0.0062, Z_VIDRO[0]),
              (INSET, Z_VIDRO[0]), (INSET, -D)]
    L = np.r_[0, np.cumsum([math.dist(a, b) for a, b in zip(perfil, perfil[1:])])]
    L /= L[-1]
    anel = []
    for w, z in perfil:
        x, y0, y1 = W / 2 - w, w, HH - w
        anel.append(m.verts([(-x, y0, z), (x, y0, z), (x, y1, z), (-x, y1, z)]))
    n = len(perfil)
    for i in range(n):
        i1 = (i + 1) % n
        cor = NOGUEIRA_SOMBRA if perfil[i][0] >= INSET - 1e-6 and perfil[i][1] < -0.004 else NOGUEIRA
        u0, u1 = L[i], (L[i1] if i1 else 1.0)
        for j in range(4):
            j1 = (j + 1) % 4
            m.face([anel[i][j], anel[i1][j], anel[i1][j1], anel[i][j1]],
                   [U.celula_uv('madeira', q) for q in ((u0, 0), (u1, 0), (u1, 1), (u0, 1))], U.lin(cor))


def _T(v):
    M = np.eye(4)
    M[:3, 3] = v
    return M


def alfinete(m, topo, base):
    """Haste de aço (Ø 0,6 mm) de `topo` a `base` e cabeça de náilon."""
    m.tubo(np.array([topo, base]), np.array((0.00040, 0.00036)), seg=4, cel='aco', cor=ACO, tampa=False)
    m.elipsoide(np.asarray(topo) + (0, 0, 0.0007), (0.0011, 0.0011, 0.0010), 3, 6, cel='nylon', cor=NYLON)


def construir(mats):
    """Malhas `qa_caixa_malha` (rígido) e `qa_caixa_vidro` no quadro do nó. Devolve (objetos, medidas)."""
    m = U.Malha()
    ML = _M_lean()
    m.xf = ML
    moldura(m)
    _bloco(m, (0, HH / 2, -D + 0.001), (W / 2 - INSET + 0.0002, HH / 2 - INSET + 0.0002, 0.001), 'madeira',
           NOGUEIRA_SOMBRA)
    fw, fh = W / 2 - INSET, HH / 2 - INSET
    _bloco(m, (0, HH / 2, Z_CORTICA - 0.0015), (fw, fh, 0.0015), 'cortica', CORTICA, fundo=False)
    cw, ch = 2 * fw / 3, 2 * fh / 3
    med = {'celula_m': [round(cw, 4), round(ch, 4)], 'alfinetes': []}
    rot = np.array(((-1, 0, 0), (0, 0, 1), (0, 1, 0.0))).T          # local do bug → caixa: frente +Y, dorso +Z
    for idx in range(9):
        lin_, col = divmod(idx, 3)
        cx = -fw + cw * (col + 0.5)
        cy = HH - INSET - ch * (lin_ + 0.5)
        et = (cx, cy - ch * 0.5 + 0.0036, Z_CORTICA + 0.00015)
        cima, baixo = (0.02, 0.52, 0.98, 0.98), (0.02, 0.02, 0.98, 0.48)
        cel, meia = ([('etiqueta_a', cima), ('etiqueta_a', baixo), ('etiqueta_b', cima), ('etiqueta_b', baixo),
                      ('etiqueta_c', cima)][idx % 5] if idx < 8 else ('etiqueta_c', baixo))   # vaga: em branco
        _bloco(m, et, (0.0070, 0.0023, 0.00015), cel, PAPEL, uv_topo=meia, fundo=False)
        z_esp = Z_CORTICA + 0.0060
        if idx < 8:
            nome, esc = ESPECIMES[idx]
            M = np.eye(4)
            ang = math.radians((idx * 37 % 7 - 3) * 0.8)
            Rz = np.array(((math.cos(ang), -math.sin(ang), 0), (math.sin(ang), math.cos(ang), 0), (0, 0, 1)))
            M[:3, :3] = Rz @ rot * esc
            M[:3, 3] = (cx, cy + 0.0035, z_esp)
            n0 = len(m.bm.verts)
            m.xf = ML @ M
            pin, torax = ESP.construir(m, nome)
            m.xf = ML
            novos = np.array([tuple(v.co) for v in list(m.bm.verts)[n0:]])
            pw = M[:3, :3] @ np.array(pin) + M[:3, 3]
            alfinete(m, (pw[0], pw[1], pw[2] + 0.0022), (pw[0], pw[1], Z_CORTICA - 0.002))
            med['alfinetes'].append({'especime': nome, 'escala': esc, 'torax_z_local_m': list(torax),
                                     'alfinete_z_local_m': pin[2],
                                     'atravessa_torax': bool(torax[0] <= pin[2] <= torax[1]),
                                     'comprimento_m': round(float(np.ptp(novos[:, 2])), 4),
                                     'largura_m': round(float(np.ptp(novos[:, 0])), 4)})
        else:
            m.xf = ML
            alfinete(m, (cx, cy + 0.0035, z_esp + 0.0040), (cx, cy + 0.0035, Z_CORTICA - 0.002))
    _cavalete(m)
    m.xf = np.eye(4)
    ob = m.objeto('qa_caixa_malha', mats['rigido'], ang=80)
    v = U.Malha()
    v.xf = ML
    _bloco(v, (0, HH / 2, sum(Z_VIDRO) / 2), (W / 2 - 0.0062, HH / 2 - 0.0062, (Z_VIDRO[1] - Z_VIDRO[0]) / 2), None,
           '#ffffff', uv_topo=(0.0, 0.0, 1.0, 1.0))
    vidro = v.objeto('qa_caixa_vidro', mats['vidro_caixa'], ang=30, normais=False, cor=False)
    med['externo_m'] = [W, HH, D]
    med['inclinacao_graus'] = LEAN
    return [ob, vidro], med


def _cavalete(m):
    """Perna de apoio (nogueira, 3 mm) da dobradiça de latão, a 58 % da altura nas costas, até a mesa."""
    m.xf = np.eye(4)
    h = _rot_lean((0, 0.58 * HH, -D))
    pe = np.array((0.0, 0.0015, h[2] - 0.050))
    d = pe - h
    L = float(np.linalg.norm(d))
    ey = U.unit(d)
    ex = np.array((1.0, 0, 0))
    ez = np.cross(ex, ey)
    m.xf = U.quadro(h, ex, ey, ez)
    _bloco(m, (0, L / 2, -0.0015), (0.0065, L / 2, 0.0015), 'madeira', NOGUEIRA)
    _bloco(m, (0, 0.0015, -0.0005), (0.0070, 0.0022, 0.0009), 'latao', '#b8955e')
    m.xf = np.eye(4)
