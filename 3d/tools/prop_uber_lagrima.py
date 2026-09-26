"""U4 lágrimas do `uber`: estilizadas, no nível do busto (sem contorno, sem gota azul chapada, sem desenho animado).

Uma por olho: RASTRO molhado (faixa fina com leve abaulado, colada à pele do S13 COM a expressão triste aplicada,
browInnerUp 0,8, a 0,5 mm da pele) da pálpebra inferior descendo pela bochecha por queda livre na superfície (a
direção da gravidade projetada no plano tangente, passo a passo) + GOTA (lente d'água achatada contra a pele, mais
cheia embaixo, origem no centro). Estado exportado: gota a meio caminho (estado do movimento reduzido).

Contrato (glb): `uber_lagrima_<lado>` (nó sem malha, TRS identidade) → `uber_lagrima_<lado>_rastro` (malha; UV u
0→1 atravessando, v 0 na pálpebra → 1 na ponta) e `uber_lagrima_<lado>_gota` (nó no centro da gota; +Z local = normal
para fora da pele, +Y local = subindo pelo rastro) → `uber_lagrima_<lado>_gota_malha`. Extras do nó do lado:
`trilha` (pontos do centro do rastro no espaço do glb, v uniforme 0..1) e `trilha_normal` (normais da pele).
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import prop_empreendedor_base as EB
import prop_vela_base as B

OLHO = {'esq': 'Olho_E_malha', 'dir': 'Olho_D_malha'}   # olho E = esquerdo DELE (x > 0)
PASSO, COMPR = 0.0008, 0.066                             # passo e comprimento do rastro (unidades do glb)
LARG = (0.0031, 0.0022)                                  # largura do rastro no início e na ponta (≈ 6→4 px)
ELEV = 0.0005                                            # rastro a 0,5 mm da pele
MEANDRO = 0.0015                                         # desvio lateral máximo do rastro
GOTA = (0.0050, 0.0064, 0.0019)                          # largura, comprimento, altura
CENTRO = 0.0006 + GOTA[2] * 0.5                          # origem da gota: meio da altura, sobre a pele


def inicio(busto, lado):
    """Ponto da pálpebra inferior sob a íris: desce do centro do olho até o raio da frente bater na pele (não no
    globo) e mais 1,6 mm; ligeiramente para fora do centro da pupila."""
    ol = busto.malhas[OLHO[lado]]
    c = sum((ol.matrix_world @ v.co for v in ol.data.vertices), Vector()) / len(ol.data.vertices)
    sx = 1 if c.x > 0 else -1
    x = c.x + sx * 0.002
    for k in range(80):
        z = c.z - 0.004 - k * 0.0003
        hp = busto.raio(Vector((x, c.y, z)), Vector((0, -1, 0)))
        ho = busto.raio(Vector((x, c.y, z)), Vector((0, -1, 0)), nomes=(OLHO[lado],))
        if hp is not None and (ho is None or hp[3] <= ho[3] + 1e-5):
            h = busto.raio(Vector((x, c.y, z - 0.0016)), Vector((0, -1, 0)))
            return h[0], h[1]
    raise RuntimeError('pálpebra não encontrada')


def trilha(busto, lado):
    """Pontos e normais do caminho da gota sobre a pele (queda livre na superfície), v uniforme."""
    p, n = inicio(busto, lado)
    arv = busto.arvores[B.PELE]
    pts, nrm = [p.copy()], [n.copy()]
    g = Vector((0, 0, -1))
    feito = 0.0
    while feito < COMPR:
        t = (g - n * g.dot(n))
        if t.length < 1e-6:
            break
        q = p + t.normalized() * PASSO + n * 0.001
        hit = arv.find_nearest(q)
        p, n = hit[0], hit[1]
        if n.dot(Vector((0, -1, 0))) < 0:                    # normal de face virada no scan: usa a anterior
            n = nrm[-1]
        feito += (p - pts[-1]).length
        pts.append(p.copy())
        nrm.append(n.copy())
    P, N = np.array([v[:] for v in pts]), np.array([v[:] for v in nrm])
    for _ in range(6):                                       # normais suaves (o scan tem ruído)
        N[1:-1] = (N[:-2] + 2 * N[1:-1] + N[2:]) / 4
    N /= np.linalg.norm(N, axis=1, keepdims=True)
    s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    v = np.linspace(0, s[-1], 41)
    Pi = np.array([np.interp(v, s, P[:, k]) for k in range(3)]).T
    Ni = np.array([np.interp(v, s, N[:, k]) for k in range(3)]).T
    Ni /= np.linalg.norm(Ni, axis=1, keepdims=True)
    T = np.gradient(Pi, axis=0)
    lat = np.cross(Ni, T / np.linalg.norm(T, axis=1, keepdims=True))
    fase = 0.7 if lado == 'esq' else 2.1                     # meandro leve (a gota não desce em linha de régua)
    Pi = Pi + lat * (MEANDRO * np.sin(v / s[-1] * 1.8 * np.pi + fase) * np.clip(v / 0.01, 0, 1))[:, None]
    for i in range(len(Pi)):                                 # de volta à pele
        q = arv.find_nearest(Vector(Pi[i]))[0]
        Pi[i] = q[:]
    return Pi, Ni


def rastro(nome, P, N, mat):
    bm = bmesh.new()
    n = len(P)
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    lados = np.cross(N, T)
    us = np.linspace(0, 1, 5)
    grade = []
    for i in range(n):
        v = i / (n - 1)
        w = LARG[0] + (LARG[1] - LARG[0]) * v
        grade.append([Vector(P[i] + lados[i] * (u - 0.5) * w + N[i] * (ELEV + 0.00022 * math.sin(math.pi * u)))
                      for u in us])
    B.grade(bm, grade, uv=lambda i, j: (us[j], i / (n - 1)))
    ob = EB.objeto(nome, bm, mat, ang=180, normais=False)
    return ob


def gota(nome, mat):
    """Lente d'água no quadro local (X atravessa, Z sobe pelo rastro, −Y = para fora da pele), origem no centro."""
    bm = bmesh.new()
    w, L, h = GOTA
    anel, seg = 10, 20
    V = []
    for i in range(anel + 1):
        r = i / anel
        linha = []
        for j in range(seg):
            a = 2 * math.pi * j / seg
            ca, sa = math.cos(a), math.sin(a)
            fz = 0.5 * L * sa * (1.0 if sa > 0 else 0.85)          # contorno: cauda em cima, bojo embaixo
            fx = 0.5 * w * ca * (1 - 0.35 * max(sa, 0) ** 2)
            alt = h * (1 - r * r) ** 0.6 * (1.1 - 0.25 * sa)       # mais cheia embaixo
            linha.append(Vector((fx * r, -alt - 0.0006 + CENTRO, fz * r - 0.0006 * sa)))
        V.append(linha)
    topo = bm.verts.new(V[0][0])
    vs = [[topo] * seg] + [[bm.verts.new(p) for p in V[i]] for i in range(1, anel + 1)]
    for i in range(anel):
        for j in range(seg):
            j1 = (j + 1) % seg
            q = [vs[i][j], vs[i + 1][j], vs[i + 1][j1], vs[i][j1]]
            if i == 0:
                bm.faces.new((q[0], q[1], q[2]))
            else:
                bm.faces.new(q)
    fundo = [bm.verts.new(Vector((p.x, -0.0006 + CENTRO, p.z))) for p in V[anel]]
    for j in range(seg):
        j1 = (j + 1) % seg
        bm.faces.new((vs[anel][j], fundo[j], fundo[j1], vs[anel][j1]))
    bm.faces.new(list(reversed(fundo)))
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for lp in f.loops:
            lp[uv].uv = (0.5 + lp.vert.co.x / w, 0.5 + lp.vert.co.z / L)
    return EB.objeto(nome, bm, mat, ang=180, normais=False)


def materiais(pasta):
    """Materiais que leem no three.js (standard, transparente, SEM transmissão): o que brilha está no próprio texel.
    Rastro: película clara e polida (clareia a pele, nunca escurece), bordas somem, ponta afina.
    Gota: centro quase transparente (a pele aparece), borda levemente escurecida (a lente), realce especular forte
    pintado no lado da luz-chave (em cima à esquerda) e um brilho menor oposto; polida para o envMap somar."""
    u = np.linspace(0, 1, 32)[None, :]
    v = np.linspace(0, 1, 128)[:, None]
    borda = np.clip(np.minimum(u, 1 - u) / 0.22, 0, 1)
    borda = borda * borda * (3 - 2 * borda)
    a = borda * np.clip(v / 0.05, 0, 1) * np.clip((1 - v) / 0.22, 0, 1) ** 1.3 * 0.34
    rgba = np.dstack([np.full((128, 32), c) for c in (0.97, 0.93, 0.90)] + [a])
    m_r = B.material('uber_lagrima_rastro', 0.0, 0.07, cor_base=B.imagem('uber_rastro', rgba, pasta, 95), vcor=False,
                     alfa=True)
    n = 96
    uu, vv = np.meshgrid(np.linspace(0, 1, n), np.linspace(0, 1, n))
    r = np.clip(np.hypot((uu - 0.5) / 0.5, (vv - 0.5) / 0.5), 0, 1.2)
    lente = np.clip((r - 0.62) / 0.36, 0, 1) ** 1.5
    real = np.exp(-(((uu - 0.36) / 0.10) ** 2 + ((vv - 0.60) / 0.13) ** 2))
    real2 = np.exp(-(((uu - 0.63) / 0.08) ** 2 + ((vv - 0.30) / 0.06) ** 2)) * 0.45
    cor = np.dstack([np.full((n, n), c) for c in (0.90, 0.95, 1.0)])
    escuro = np.array((0.20, 0.17, 0.17))
    cor = cor * (1 - lente[..., None] * 0.85) + escuro * lente[..., None] * 0.85
    br = np.clip(real + real2, 0, 1)[..., None]
    cor = cor * (1 - br) + br
    alfa = np.clip(0.10 + 0.50 * lente + 0.90 * br[..., 0], 0, 0.97) * (r < 1.02)
    m_g = B.material('uber_lagrima_gota', 0.0, 0.03, cor_base=B.imagem('uber_gota', np.dstack([cor, alfa]), pasta, 95),
                     vcor=False, alfa=True)
    for m in (m_r, m_g):
        m['envMapIntensity'] = 3.0                             # reflexo próprio (scene/envIntensity.ts)
    return m_r, m_g


def construir(busto, raiz, lado, mats, vazio):
    """Nós e malhas de um lado; `busto` já na pose triste. Devolve a lista de objetos."""
    P, N = trilha(busto, lado)
    no = vazio('uber_lagrima_' + lado, raiz)
    r = rastro('uber_lagrima_%s_rastro' % lado, P, N, mats[0])
    r.parent = no
    k = len(P) // 2
    t = P[k - 1] - P[k + 1]
    t /= np.linalg.norm(t)
    n = N[k]
    x = np.cross(-n, t)
    x /= np.linalg.norm(x)
    t = np.cross(x, -n)
    g = vazio('uber_lagrima_%s_gota' % lado, no)
    g.matrix_world = Matrix.Translation(Vector(P[k] + n * CENTRO)) @ Matrix((x, -n, t)).transposed().to_4x4()
    m = gota('uber_lagrima_%s_gota_malha' % lado, mats[1])
    m.parent = g
    gl = lambda a: [[round(float(p[0]), 5), round(float(p[2]), 5), round(float(-p[1]), 5)] for p in a]  # noqa: E731
    no['trilha'] = gl(P)
    no['trilha_normal'] = gl(N)
    return [no, r, g, m]
