"""V3 `vela_oculos`: óculos de sol de velejador em acetato, VESTIDOS no rosto do S13.

Ajuste (ficha, harmonização 2): lentes centradas nos olhos reais (x ±0,042, z 0,178 no Blender); frente com curva
de envolvimento (raio RW) e inclinação pantoscópica; a frente é levada para trás até a menor folga medida entre a
armação e a pele (sobrancelha, bochecha em mouthSmile 1) valer FOLGA; plaquetas moldadas no aro, cada uma encostada
no ponto real do nariz torto (achado por proximidade, lado a lado); hastes que contornam a cabeça a 1,2 mm do cabelo
até as orelhas e descem atrás delas. Lente (`vela_lente`) = casca fina com UV vertical para o degradê.
Espaço do Blender (Z para cima, rosto para −Y). Lado s = +1 é o esquerdo DELE (x+).
"""
import math

import bmesh
from mathutils import Vector

import prop_vela_base as B

XC, ZC = 0.0440, 0.1785           # centro das lentes
A, BB, N = 0.0335, 0.0205, 3.6    # meia largura, meia altura, expoente (superelipse): lente esportiva quadrada
RW, PANTO = 0.098, math.radians(9)  # envolvimento esportivo (base 7) e inclinação pantoscópica
PROF = 0.0078                     # profundidade do aro (frente → trás): acetato encorpado esportivo
FOLGA = 0.0030                    # folga mínima armação/lente × pele
NP = 44                           # pontos do contorno
COR = {'acetato': '#20262c', 'metal': '#9ea3a8', 'ponteira': '#2e8fd6'}
PONTAS = {}                       # pontas das hastes (lado → ponto), para o retêntor do apito


def contorno(s):
    """Contorno da lente (x, z) no lado s: superelipse com topo reto e subido para fora e canto nasal inferior
    recolhido (o aro dá lugar ao nariz)."""
    pts = []
    for k in range(NP):
        t = 2 * math.pi * k / NP
        c, sn = math.cos(t), math.sin(t)
        xl = A * math.copysign(abs(c) ** (2 / N), c)          # xl > 0: lado de fora (têmpora)
        z = BB * math.copysign(abs(sn) ** (2 / (N + 1.4 if sn > 0 else N)), sn)
        if z < 0 and xl < 0:
            xl *= 1 - 0.20 * (-z / BB) ** 1.3                  # canto nasal recolhido (dá lugar ao nariz)
        if z < 0 and xl > 0:
            z *= 1 - 0.18 * (xl / A) ** 2                      # fundo sobe para fora (desenho esportivo)
        z += 0.0030 * (xl / A) * (z > 0) + 0.0008 * (z > 0)   # topo reto, varrido para cima na têmpora
        pts.append((XC * s + s * xl, ZC + z))
    return pts


def desloca2d(pts, larg):
    """Offset para fora de um laço 2D (x, z) com largura variável larg(k)."""
    out = []
    n = len(pts)
    cx = sum(p[0] for p in pts) / n
    cz = sum(p[1] for p in pts) / n
    for k in range(n):
        a, b = Vector(pts[k - 1]), Vector(pts[(k + 1) % n])
        t = (b - a).normalized()
        nrm = Vector((t.y, -t.x))
        if nrm.dot(Vector(pts[k]) - Vector((cx, cz))) < 0:
            nrm = -nrm
        out.append((pts[k][0] + nrm.x * larg(k), pts[k][1] + nrm.y * larg(k)))
    return out


def frente_y(x, z, y0):
    """y da face da frente no ponto (x, z): envolvimento + pantoscópico."""
    return y0 + x * x / (2 * RW) - (z - ZC) * math.tan(PANTO)


def recuo(busto, y0):
    """Menor folga (m) entre a face de trás da armação/lente e a pele, na área das duas lentes + aro."""
    menor = 9.0
    for s in (-1, 1):
        for k, (x, z) in enumerate(desloca2d(contorno(s), lambda k: 0.0048)):
            for f in (1.0, 0.7, 0.4):
                px, pz = XC * s + (x - XC * s) * f, ZC + (z - ZC) * f
                h = busto.raio(Vector((px, 0.12, pz)), Vector((0, -1, 0)))
                if h:
                    menor = min(menor, h[0].y - (frente_y(px, pz, y0) + PROF))
    for x in (-0.012, -0.006, 0.0, 0.006, 0.012):                  # ponte (acima do dorso do nariz)
        z = ZC + 0.0150 + 0.0040 * math.cos(math.pi * x / 0.027) ** 2
        h = busto.raio(Vector((x, 0.12, z)), Vector((0, -1, 0)))
        if h:
            menor = min(menor, h[0].y - (frente_y(x, z, y0) + PROF * 0.45 + 0.0027))
    return menor


def ajustar_y0(buscas):
    """y0 (frente no centro) mais para trás possível com folga ≥ FOLGA em todas as poses pedidas."""
    y0 = 0.02
    for _ in range(160):
        if all(recuo(b, y0) >= FOLGA for b in buscas):
            return y0
        y0 -= 0.0005
    return y0


def aro(bm, s, y0):
    """Aro de acetato em volta da lente (anel com espessura), com chanfro nas arestas vivas."""
    dentro = contorno(s)
    k_topo = lambda k: math.sin(2 * math.pi * k / NP)       # noqa: E731
    fora = desloca2d(dentro, lambda k: 0.0044 + 0.0046 * max(0.0, k_topo(k)) ** 0.8)   # topo grosso (esportivo)
    t = bmesh.new()
    def v(x, z, dy):                                         # noqa: E306
        return t.verts.new((x, frente_y(x, z, y0) + dy, z))
    Fi = [v(x, z, 0.0) for x, z in dentro]
    Fo = [v(x, z, 0.0) for x, z in fora]
    Ti = [v(x, z, PROF) for x, z in dentro]
    To = [v(x, z, PROF) for x, z in fora]
    for k in range(NP):
        k1 = (k + 1) % NP
        for q in ((Fo[k], Fo[k1], Fi[k1], Fi[k]), (Ti[k], Ti[k1], To[k1], To[k]),
                  (To[k], To[k1], Fo[k1], Fo[k]), (Fi[k], Fi[k1], Ti[k1], Ti[k])):
            t.faces.new(q)
    bmesh.ops.recalc_face_normals(t, faces=t.faces)
    vivas = [e for e in t.edges if e.is_manifold and e.calc_face_angle(0) > math.radians(35)]
    bmesh.ops.bevel(t, geom=vivas, offset=0.0007, segments=2, profile=0.5, affect='EDGES', clamp_overlap=True)
    return B.anexar(bm, t, lambda p: p), fora


def ponte(bm, y0):
    """Ponte em buraco de fechadura: arco achatado entre os aros, acima do dorso do nariz."""
    pts = []
    for k in range(11):
        x = -0.0135 + 0.027 * k / 10
        z = ZC + 0.0150 + 0.0040 * math.cos(math.pi * x / 0.027) ** 2
        pts.append(Vector((x, frente_y(x, z, y0) + PROF * 0.45, z)))
    f = B.tubo_pts(bm, pts, 0.0038, seg=10)                  # ponte maciça de acetato (óculos de sol, não de grau)
    for fc in f:
        for v in fc.verts:
            v.co.y = pts[0].y + (v.co.y - pts[0].y) * 1.5
    return f


def plaqueta(bm, busto, s, y0):
    """Plaqueta moldada: parte do aro nasal inferior e encosta no ponto do nariz mais próximo (nariz torto: cada lado
    tem o seu)."""
    zp = ZC + 0.002
    base = Vector((s * 0.0118, frente_y(0.0118, zp, y0) + PROF, zp))
    q, nrm, d = busto.perto(base)
    contato = q + nrm * 0.0004
    eixo = contato - base
    pts = [base + eixo * (i / 6) for i in range(7)]
    f = B.tubo_pts(bm, pts, lambda t: 0.0020 + 0.0010 * t, seg=10)
    # Almofada: elipsoide achatado deitado na face do nariz.
    rot = Vector((0, 0, 1)).rotation_difference(nrm).to_matrix().to_4x4()
    perfil = [(0.0, 0.0012), (0.0024, 0.0010), (0.0036, 0.0004), (0.0036, -0.0002), (0.0, -0.0004)]
    f += B.torno(bm, perfil, 14, mapa=lambda p: contato + nrm * 0.0004 + rot @ Vector((p.x * 0.8, p.y * 1.5, p.z)))
    return f, contato


def varrer(bm, pts, secao):
    """Varredura de uma seção 2D (lateral, vertical) ao longo de pts, com 'vertical' = Z projetado."""
    aneis = []
    for k, p in enumerate(pts):
        t = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]).normalized()
        up = (Vector((0, 0, 1)) - t * t.z).normalized()
        lat = t.cross(up)
        aneis.append([bm.verts.new(p + lat * a + up * b) for a, b in secao(k / (len(pts) - 1))])
    n = len(aneis[0])
    faces = []
    for A_, C_ in zip(aneis, aneis[1:]):
        for s in range(n):
            faces.append(bm.faces.new((A_[s], A_[(s + 1) % n], C_[(s + 1) % n], C_[s])))
    faces.append(bm.faces.new(list(reversed(aneis[0]))))
    faces.append(bm.faces.new(aneis[-1]))
    return faces


def ret(w, h, r, n=3):
    pts = B.EB.ret_arred(w, h, r, n)
    return [(x, y) for x, y in pts]


def haste(bm, busto, s, inicio, y0):
    """Haste: da dobradiça até a orelha a 1,2 mm do cabelo/pele, depois desce atrás da orelha."""
    pts = []
    x_prev = abs(inicio.x)
    n = 26
    for k in range(n + 1):
        t = k / n
        y = inicio.y + (0.150 - inicio.y) * t
        z = inicio.z - 0.006 * t
        h = busto.raio(Vector((0, y, z)), Vector((s, 0, 0)))
        xs = abs(h[0].x) if h else x_prev
        x = max(x_prev - 0.0006 if k else x_prev, xs + 0.0012 + 0.0011)
        x_prev = x
        pts.append(Vector((s * x, y, z)))
    for k in range(1, 7):                                     # curva atrás da orelha, rente
        a = k / 6 * math.radians(55)
        p = pts[-1] + Vector((0, math.cos(a) * 0.0045, -math.sin(a) * 0.0045))
        h = busto.raio(Vector((0, p.y, p.z)), Vector((s, 0, 0)))
        if h:
            p.x = s * (abs(h[0].x) + 0.0023)
        pts.append(p)
    PONTAS[s] = pts[-1].copy()                                # ponta da haste: onde o retêntor prende
    return varrer(bm, pts, lambda t: ret(0.0032, 0.0108 - 0.0058 * t ** 0.6, 0.0013, 2))   # haste larga


def construir(busto, poses, mat_armacao, mat_lente):
    y0 = ajustar_y0(poses)
    bm = bmesh.new()
    contatos, metal, ponteiras = {}, [], []
    for s in (-1, 1):
        f, fora = aro(bm, s, y0)
        B.EB.pintar(bm, f, COR['acetato'])
        # Dobradiça: bloco na ponta de fora do aro + barril de metal; haste a partir dele.
        kx = max(range(NP), key=lambda k: s * fora[k][0] + 0.4 * fora[k][1])
        x, z = fora[kx]
        p0 = Vector((x - s * 0.0025, frente_y(x, z, y0), z - 0.0035))
        bloco = B.anexar(bm, B.caixa(0.0048, 0.0105, 0.0062, 0.0012),
                         lambda p: p0 + Vector((p.x, p.y + 0.0048, p.z)))
        B.EB.pintar(bm, bloco, COR['acetato'])
        barril = B.torno(bm, [(0.0, -0.0026), (0.0013, -0.0026), (0.0013, 0.0026), (0.0, 0.0026)], 10,
                         mapa=lambda p: p0 + Vector((p.x - s * 0.0006, 0.0108 + p.y, p.z)))
        B.EB.pintar(bm, barril, COR['metal'])
        metal += barril
        h = haste(bm, busto, s, p0 + Vector((0, 0.0112, 0)), y0)
        B.EB.pintar(bm, h, lambda f: COR['ponteira'] if f.calc_center_median().y > 0.118 else COR['acetato'])
        ponteiras += [f for f in h if f.calc_center_median().y > 0.118]
        pl, contatos[s] = plaqueta(bm, busto, s, y0)
        B.EB.pintar(bm, pl, COR['acetato'])
    B.EB.pintar(bm, ponte(bm, y0), COR['acetato'])
    empurrar(bm, poses)
    B.uv_reg(bm, bm.faces, 'acetato', 60)
    B.uv_reg(bm, metal, 'aluminio', 60)
    B.uv_reg(bm, ponteiras, 'borracha', 60)
    armacao = B.objeto('vela_oculos_armacao', bm, mat_armacao, ang=40)
    return [armacao, lentes(y0, mat_lente)], {'y0': y0, 'plaquetas': {s: tuple(c) for s, c in contatos.items()}}


def empurrar(bm, poses, folga=0.0002):
    """Zera a interpenetração: vértice da armação dentro da pele (em qualquer pose) sai pela normal da pele até
    0,2 mm fora (as plaquetas planas encostam no nariz curvo: as bordas entravam 0,28 mm)."""
    n = 0
    for v in bm.verts:
        for b in poses:
            q, nrm, d = b.perto(v.co)
            if d < folga:
                fora = nrm if not b.dentro(q + nrm * 0.001) else -nrm      # normal do scan pode vir trocada
                v.co = q + fora * folga
                n += 1
    print('OCULOS empurrados', n)


def lentes(y0, mat):
    """As duas lentes numa malha: leque do centro ao contorno (um pouco maior que o furo, assenta no sulco), casca de
    1,2 mm; UV v = altura (0 embaixo, 1 em cima) para o degradê."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    z0, z1 = ZC - BB - 0.001, ZC + BB + 0.003
    for s in (-1, 1):
        borda = desloca2d(contorno(s), lambda k: 0.0008)
        for dy in (PROF * 0.42, PROF * 0.42 + 0.0012):
            aneis = []
            for f in (0.0, 0.35, 0.7, 1.0):
                aneis.append([Vector((XC * s + (x - XC * s) * f, 0, ZC + (z - ZC) * f)) for x, z in borda])
            V = [[bm.verts.new((p.x, frente_y(p.x, p.z, y0) + dy - 0.0012 * (1 - f) ** 2, p.z)) for p in anel]
                 for anel, f in zip(aneis, (0.0, 0.35, 0.7, 1.0))]
            for a_, c_ in zip(V, V[1:]):
                for k in range(NP):
                    k1 = (k + 1) % NP
                    q = (a_[k], a_[k1], c_[k1], c_[k]) if dy > PROF * 0.43 else (c_[k], c_[k1], a_[k1], a_[k])
                    fc = bm.faces.new(q)
                    for lp in fc.loops:
                        lp[uv].uv = (0.5, min(max((lp.vert.co.z - z0) / (z1 - z0), 0.002), 0.998))
        bm.verts.ensure_lookup_table()
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    obj = B.objeto('vela_oculos_lente', bm, mat, ang=80, normais=False)
    return obj
