"""V9 `vela_apito` com o V10 (lais de guia) no próprio cabo, ADENDOS 4–6 (o `vela_lais` avulso saiu).

Cabo náutico trançado Ø 4 mm (textura + normal da trança na UV1 `UVTrama`; UV0 u 0 → 1 ao longo de cada trecho),
falcaça no chicote. A alça em volta do pescoço é FECHADA POR UM LAIS DE GUIA no peito, logo abaixo da base da barba;
o firme desce do nó até a argola do apito clássico (câmara cilíndrica de perfil, janela em rampa, bocal achatado).
Topologia do nó conferida no traçado LAIS (desenho com o firme para cima; no cabo ele é girado 180°): a volta pequena
(o "buraco") é feita com o lado do trabalho POR CIMA do firme; o chicote sobe pelo buraco (vindo de trás), passa por
trás do firme ("a árvore"), volta pela frente e desce pelo buraco ao lado de si mesmo, terminando DENTRO da alça.
Cruzamentos com afastamento ≥ 1,05 diâmetro (medido: folga_propria_no_mm).
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

import prop_vela_base as B

# Traçado do lais (x, y, z) em unidades; z > 0 = para a câmera. Firme desce do alto à direita até o cruzamento C.
LAIS = [(0.3, 15.0, 0.0), (0.1, 10.5, 0.0), (0.0, 7.4, 0.0), (0.0, 5.6, -0.3), (0.0, 4.8, -0.6),   # firme, por baixo em C
        (-1.0, 4.25, -0.5), (-1.75, 3.55, -0.3), (-2.1, 2.4, 0.0), (-1.5, 0.9, 0.0), (0.0, 0.3, 0.1),  # buraco (R 2,1)
        (1.5, 0.9, 0.0), (2.1, 2.4, 0.0), (1.75, 3.55, 0.0), (1.0, 4.35, 0.3),
        (0.0, 4.85, 0.65), (-1.4, 5.15, 0.1), (-3.0, 4.7, 0.0),                                    # por cima em C
        (-4.3, 3.0, 0.0), (-4.6, -1.0, 0.0), (-4.3, -5.0, 0.0), (-2.8, -8.2, 0.0), (0.0, -9.3, 0.0),  # alça fixa
        (2.8, -8.2, 0.0), (4.3, -5.0, 0.0), (4.5, -1.6, 0.0), (3.2, -0.3, -0.5), (1.8, 0.3, -1.0),
        (0.8, 0.6, -1.15), (0.75, 2.2, -0.3), (0.75, 3.3, 1.0), (0.85, 4.5, 1.6), (1.1, 5.7, 1.2),  # sai do buraco
        (1.15, 6.8, -0.6), (0.0, 7.3, -1.3), (-1.15, 6.8, -0.6),                                   # volta na árvore
        (-1.05, 6.1, 0.9), (-0.95, 5.1, 1.75), (-0.9, 4.2, 1.3), (-0.9, 3.1, 0.6), (-0.9, 2.0, -0.2),                 # desce no buraco
        (-0.9, 0.55, -1.15), (-1.3, -1.2, -0.6), (-1.7, -3.2, 0.0)]                                # chicote dentro


def spline(pts, n):
    """Catmull-Rom centrípeta amostrada por comprimento de arco (n pontos)."""
    P = [Vector(p) for p in pts]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    fino = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(24):
            t = k / 24
            fino.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
                               (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    fino.append(P[-2])
    comp = [0.0]
    for a, b in zip(fino, fino[1:]):
        comp.append(comp[-1] + (b - a).length)
    out, j = [], 0
    for k in range(n):
        s = comp[-1] * k / (n - 1)
        while j < len(comp) - 2 and comp[j + 1] < s:
            j += 1
        f = (s - comp[j]) / max(1e-9, comp[j + 1] - comp[j])
        out.append(fino[j].lerp(fino[j + 1], f))
    return out, comp[-1]


def tubo_uv(bm, pts, raio, seg, periodo, falcaca=0.0):
    """Tubo contínuo com UV0 (u ao longo 0→1, v em volta) e UV1 `UVTrama` (u = comprimento/período); falcaça: as
    duas pontas com voltas apertadas (raio −6 %, cor escura, sem trança)."""
    uv0 = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
    uv1 = bm.loops.layers.uv.get('UVTrama') or bm.loops.layers.uv.new('UVTrama')
    col = bm.loops.layers.float_color.get('Col') or bm.loops.layers.float_color.new('Col')
    s_ac = [0.0]
    for a, b in zip(pts, pts[1:]):
        s_ac.append(s_ac[-1] + (b - a).length)
    L = s_ac[-1]
    n = (pts[1] - pts[0]).cross(Vector((0, 0, 1))).normalized()
    aneis = []
    for k, p in enumerate(pts):
        t = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]).normalized()
        n = (n - t * n.dot(t)).normalized()
        b = t.cross(n)
        ponta = s_ac[k] < falcaca or s_ac[k] > L - falcaca
        r = raio * (0.94 if ponta else 1.0)
        aneis.append(([bm.verts.new(p + (n * math.cos(a) + b * math.sin(a)) * r)
                       for a in (2 * math.pi * j / seg for j in range(seg))], ponta))
    faces = []
    for k in range(len(aneis) - 1):
        (A, pa), (C, _) = aneis[k], aneis[k + 1]
        for j in range(seg):
            f = bm.faces.new((A[j], A[(j + 1) % seg], C[(j + 1) % seg], C[j]))
            for lp, (kk, jj) in zip(f.loops, ((k, j), (k, j + 1), (k + 1, j + 1), (k + 1, j))):
                lp[uv0].uv = (s_ac[kk] / L, jj / seg)
                lp[uv1].uv = (s_ac[kk] / periodo, jj / seg)
                lp[col] = B.srgb('#5e5a52') if pa else (1, 1, 1, 1)
            faces.append(f)
    for anel, _ in (aneis[0], aneis[-1]):                         # pontas cortadas, seladas
        f = bm.faces.new(anel if anel is aneis[-1][0] else list(reversed(anel)))
        for lp in f.loops:
            lp[uv0].uv = (0.0 if anel is aneis[0][0] else 1.0, 0.5)
            lp[uv1].uv = (0.0, 0.0)
            lp[col] = B.srgb('#5e5a52')
        faces.append(f)
    return faces, L


def folga_propria(pts, raio, vizinho):
    """Menor distância entre pontos do eixo que não são vizinhos no cabo (≥ 2·raio = cabo não se atravessa)."""
    menor = 9.0
    for i in range(len(pts)):
        for j in range(i + vizinho, len(pts)):
            menor = min(menor, (pts[i] - pts[j]).length)
    return menor


def caminho_lais(K, u, pescoco, z_barba):
    """Eixo do cabo do apito (ADENDO 6): o lais de guia do desenho LAIS girado 180° no plano (firme para BAIXO, até o
    apito; alça fixa para CIMA) e posto de frente na câmera em K; a alça fixa é trocada pelo contorno do pescoço
    (sai do nó pela direita da tela, entra sob a barba, contorna a nuca e volta pela esquerda). Devolve os pontos
    (firme + nó + perna), (pescoço), (perna + gola + chicote)."""
    R = Matrix.Translation(K) @ Matrix.Rotation(math.radians(90), 4, 'X') @ \
        Matrix.Rotation(math.radians(180), 4, 'Z') @ Matrix.Scale(u, 4)
    firme = [R @ Vector(p) for p in [(0.05, 8.4, 0.0)] + LAIS[2:17]]
    chicote = [R @ Vector(p) for p in LAIS[25:]]
    sob_e = Vector((0.022, -0.010, z_barba + 0.006))
    sob_d = Vector((-0.022, -0.010, z_barba + 0.006))
    subida = [firme[-1].lerp(sob_e, 0.5) + Vector((0.004, -0.004, 0)), sob_e]
    descida = [sob_d, sob_d.lerp(chicote[0], 0.5) + Vector((-0.004, -0.004, 0))]
    return firme + subida, [sob_e] + pescoco + [sob_d], descida + chicote


def apito_peito(raiz, busto, mats):
    """ADENDOS 4–6: cabo náutico trançado Ø 4,5 mm cuja alça em volta do pescoço é FECHADA POR UM LAIS DE GUIA no
    peito, abaixo da ponta da barba (medida na malha do S13); o firme desce do nó ao apito clássico. O trecho da nuca
    passa por dentro da barba na frente (escondido) e rente ao cabelo atrás. Malhas: `vela_apito_cordao_pescoco`
    (contorno do pescoço), `vela_apito_cordao_pendente` (pernas, nó e firme), `vela_apito_corpo`."""
    g = bpy.data.objects.new('vela_apito', None)
    bpy.context.scene.collection.objects.link(g)
    g.parent = raiz
    frente = [v.co for v in busto.bm_pele.verts if v.co.y < 0.0 and abs(v.co.x) < 0.05]
    z_barba = min(p.z for p in frente)
    u = 0.0040                                                     # Ø do cabo (1 unidade do desenho)
    K = Vector((0.0, -0.024, z_barba - 0.004))                     # nó logo abaixo da base da barba
    o = Vector((0, 0.12, 0))
    pts = []
    for i in range(0, 37):
        a = math.radians(30 + 300 * i / 36)                       # 30° (frente, x+) → nuca (180°) → 330° (frente, x−)
        z = 0.060 - 0.020 * max(0.0, math.cos(a)) ** 2
        d = Vector((math.sin(a), -math.cos(a), 0))
        c = o + Vector((0, 0, z))
        h = busto.raio(c, d)
        r = (h[0] - c).length if h else 0.07
        pts.append(c + d * (r - 0.005 if math.cos(a) > 0.5 else r + 0.0026))
    pend1, pesc, pend2 = caminho_lais(K, u, pts, z_barba)
    e1, _ = spline(pend1, 120)
    e2, _ = spline(pesc, 72)
    e3, _ = spline(pend2, 120)
    no = e1 + e3
    vz = int(3 * u / ((e1[1] - e1[0]).length)) + 1
    objs = [g]
    for nome, eixos in (('vela_apito_cordao_pescoco', [e2]), ('vela_apito_cordao_pendente', [e1, e3])):
        bm = bmesh.new()
        for k, e in enumerate(eixos):
            tubo_uv(bm, e, 0.5 * u, 8, periodo=0.0042, falcaca=(0.9 * u if (nome.endswith('pendente') and k == 1)
                                                                    else 0.0))
        B.EB.pintar(bm, [f for f in bm.faces if all(c > 0.5 for c in f.loops[0][bm.loops.layers.float_color['Col']][:3])],
                    '#2e8fd6')
        c = B.objeto(nome, bm, mats['cabo'], ang=80, normais=False)
        c.parent = g
        objs.append(c)
    argola = e1[0] + Vector((0, 0, -0.0015))
    bm = bmesh.new()
    corpo, jan, arg, anel = apito3_corpo(bm, 0.011 * 1.2)
    B.EB.pintar(bm, corpo + arg, '#d6d1c6')
    B.EB.pintar(bm, jan, '#15171a')
    B.uv_reg(bm, bm.faces, 'plastico', 60)
    obj = B.objeto('vela_apito_corpo', bm, mats['rigido'], ang=40)
    obj.parent = g
    alfa = math.atan2(anel.x, anel.z)
    giro = Matrix.Rotation(math.radians(-62) - alfa, 4, 'Y')      # de perfil: bocal quase horizontal
    obj.matrix_world = Matrix.Translation(argola - giro @ anel) @ giro
    objs.append(obj)
    info = {'z_barba_bl': round(z_barba, 4), 'apito_topo_z_bl': round(argola.z + 0.005, 4),
            'folga_barba_apito_mm': round((z_barba - argola.z - 0.005) * 1000, 1),
            'folga_propria_no_mm': round(folga_propria(no, 0.5 * u, vz) * 1000, 2), 'cabo_mm': u * 1000,
            'no_altura_mm': round((max(p.z for p in no) - min(p.z for p in no)) * 1000, 1)}
    return objs, info


APITO_INFO = {}


def apito3_corpo(bm, R):
    """Apito clássico (ADENDO 5): câmara cilíndrica deitada (eixo Y: o CÍRCULO olha para a câmera), bocal estreito e
    achatado tangente ao topo (+X), janela em rampa no topo da câmara junto ao bocal, argola atrás (−X, em cima) numa
    orelha. Medidas reais × 1,2: câmara Ø 22 × 15 mm, bocal 22 × 13 × 5,5 mm, argola Ø 9 mm."""
    k = 1.2
    h = 0.0075 * k
    perfil = [(0.0, -h), (R - 0.0012, -h), (R - 0.0002, -h + 0.0010), (R, -h + 0.0022), (R, h - 0.0022),
              (R - 0.0002, h - 0.0010), (R - 0.0012, h), (0.0, h)]
    troca = lambda p: Vector((p.x, p.z, p.y))                             # noqa: E731 (eixo Z → Y)
    corpo = B.torno(bm, perfil, 32, mapa=troca)
    corpo += B.anexar(bm, B.caixa(0.022 * k, 0.013 * k, 0.0055 * k, 0.0016, 2),
                      lambda p: p + Vector((0.011 * k + 0.0015, 0, R - 0.00275 * k)))
    jan = B.anexar(bm, B.caixa(0.0075 * k, 0.0105 * k, 0.0024, 0.0006),
                   lambda p: Matrix.Rotation(math.radians(-22), 3, 'Y') @ p + Vector((0.0015, 0, R - 0.0004)))
    orelha = B.anexar(bm, B.caixa(0.0060, 0.0040, 0.0060, 0.0014),
                      lambda p: p + Vector((-R * 0.70, 0, R * 0.72)))
    anel = Vector((-R * 0.70 - 0.0048, 0, R * 0.72 + 0.0048))
    argola = B.torno(bm, [(0.0036, -0.0011), (0.0050, -0.0011), (0.0050, 0.0011), (0.0036, 0.0011), (0.0036, -0.0011)],
                     16, mapa=lambda p: troca(p) + anel)
    return corpo + orelha, jan, argola, anel


def construir(raiz, busto, mats, variante='peito'):
    """ADENDO 6: o lais de guia avulso (`vela_lais`) SAIU; o nó vive no cabo do apito."""
    objs, info = apito_peito(raiz, busto, mats)
    print('APITO', info)
    return objs
