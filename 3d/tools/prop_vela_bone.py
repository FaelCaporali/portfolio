"""V2 `vela_bone`: boné de velejador de 6 gomos, VESTIDO no crânio real do S13.

Método (ficha, harmonização 1): a copa é uma grade (azimute u × meridiano v) lançada por raios de dentro da cabeça;
o raio do cabelo/pele em cada direção é o envelope; a copa = envelope suavizado + folga (1,5 mm na testa, até ~5 mm no
alto), com a restrição copa ≥ pele + folga mínima reimposta a cada passo de suavização (não atravessa o busto).
A faixa (borda da copa) é a interseção do envelope com um plano inclinado (frente alta na testa, trás baixa), acima das
sobrancelhas e das orelhas. Gomos: 6 meridianos (frente, ±63°, ±120°, trás) com costura rebaixada e gomo levemente
estufado; botão forrado no ápice; abertura traseira em arco com a tira por baixo (o volume do cabelo passa por ela).
Aba pré-curvada presa à faixa na frente, com espessura, borda arredondada e as 8 carreiras de pesponto (textura).
Espaço do Blender (Z para cima, rosto para −Y); UV da copa = (u, v) da grade; aba na faixa de cima do atlas.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

import prop_vela_base as B

C = Vector((0.0, 0.122, 0.185))              # centro dos raios, dentro do crânio
APICE = Vector((0.0, 0.140, 0.345))          # para onde convergem os gomos (botão)
Z_FRENTE, Y_FRENTE, INCL = 0.259, -0.010, 0.175   # faixa: z = Z_FRENTE − INCL·(y − Y_FRENTE) − queda lateral
LAT = 0.031                                  # a faixa desce nas laterais até ~1 cm acima da orelha (Fael, 25/09)
NU, NV = 72, 16
COSTURAS = (0.0, 1.10, 2.08, math.pi, -2.08, -1.10)
ESP = 0.0018                                 # espessura do tecido (≈1,5 mm real × 1,2 do scan)
ABA_U = 1.22                                 # meia abertura da aba na faixa (rad a partir da frente)
ABA_L, ABA_INCL, ABA_CURV = 0.094, math.radians(15), 0.030   # aba 7,8 cm real, pré-curvada
ABERTURA = (0.085, 0.40, 0.30)               # v da tira, v do topo do arco, meia largura (rad) do arco
CIRC = None                                  # comprimento do anel da copa por v (preenchido em `copa`)


def direcao(u, e):
    return Vector((math.cos(e) * math.sin(u), -math.cos(e) * math.cos(u), math.sin(e)))


def z_faixa(y, x=0.0):
    """Linha da faixa: alta na testa, desce sobre as têmporas até logo acima da orelha (x ±0,09, z ≈ 0,203, acima
    das hastes dos óculos) e fica baixa atrás, como boné bem vestido."""
    return Z_FRENTE - INCL * (y - Y_FRENTE) - LAT * (max(0.0, abs(x) - 0.03) / 0.06) ** 1.5


def envelope(busto, d):
    h = busto.raio(C, d)
    return (h[0] - C).length if h else 0.0


def ponto_faixa(busto, u):
    """Direção (do centro) cujo ponto do envelope está no plano da faixa: bisseção na elevação."""
    lo, hi = -0.7, 1.45
    for _ in range(32):
        e = (lo + hi) / 2
        d = direcao(u, e)
        p = C + d * envelope(busto, d)
        if p.z - z_faixa(p.y, p.x) > 0:
            hi = e
        else:
            lo = e
    return direcao(u, (lo + hi) / 2)


def slerp(a, b, t):
    om = math.acos(max(-1.0, min(1.0, a.dot(b))))
    if om < 1e-6:
        return a.copy()
    return (a * math.sin((1 - t) * om) + b * math.sin(t * om)) / math.sin(om)


def dist_costura(u):
    return min(abs((u - c + math.pi) % (2 * math.pi) - math.pi) for c in COSTURAS)


def copa_raios(busto):
    """Grade de direções e raios da copa (lista NU × (NV+1)) e o raio da pele em cada uma."""
    ap = (APICE - C).normalized()
    us = [2 * math.pi * i / NU - math.pi for i in range(NU)]
    vs = [(j / NV) ** 0.9 for j in range(NV + 1)]
    D, R0 = [], []
    for u in us:
        db = ponto_faixa(busto, u)
        linha = [slerp(db, ap, v) for v in vs]
        D.append(linha)
        R0.append([envelope(busto, d) for d in linha])
    # Dilatação 3 × 3: o cabelo (coque atrás) tem relevo entre os raios; a copa cobre o máximo da vizinhança.
    R0 = [[max(R0[(i + a) % NU][min(max(j + b, 0), NV)] for a in (-1, 0, 1) for b in (-1, 0, 1))
           for j in range(NV + 1)] for i in range(NU)]
    # Folga mínima: 1,5 mm na faixa, sobe a ~4 mm no alto; frente estruturada sobe um pouco mais (gomo dianteiro).
    def fmin(i, j):
        v = vs[j]
        frente = max(0.0, math.cos(us[i])) ** 2
        return 0.0014 + 0.0009 * min(1.0, v / 0.45) + 0.0016 * frente * math.sin(math.pi * min(v / 0.6, 1.0))
    R = [[R0[i][j] + fmin(i, j) for j in range(NV + 1)] for i in range(NU)]
    for _ in range(14):                       # pouca suavização: a copa acompanha o crânio (não cúpula)
        N = [[0.0] * (NV + 1) for _ in range(NU)]
        for i in range(NU):
            for j in range(NV + 1):
                if j == 0:
                    N[i][j] = R[i][j]
                    continue
                viz = [R[(i - 1) % NU][j], R[(i + 1) % NU][j], R[i][j - 1], R[i][min(j + 1, NV)]]
                N[i][j] = 0.5 * R[i][j] + 0.125 * sum(viz)
                N[i][j] = max(N[i][j], R0[i][j] + fmin(i, j))
        R = N
    ap_r = sum(R[i][NV] for i in range(NU)) / NU
    for i in range(NU):
        R[i][NV] = ap_r
    return us, vs, D, R


def gomo(u, v):
    """Relevo do tecido: costura que afunda (−1,1 mm), gomo estufado entre costuras (+1,2 mm) e caimento leve
    (ondulação baixa nas laterais e atrás, ±0,5 mm; a frente estruturada fica lisa)."""
    dc = dist_costura(u)
    rugas = 0.0005 * math.sin(3.0 * u + 7.0 * v) * math.sin(5.0 * u - 3.0 * v) * (1 - max(0.0, math.cos(u)) ** 2)
    return -0.0011 * math.exp(-(dc / 0.030) ** 2) + 0.0012 * math.sin(min(dc / 0.52, 1.0) * math.pi / 2) * \
        math.sin(math.pi * min(v / 0.9, 1.0)) + rugas * math.sin(math.pi * min(v / 0.7, 1.0))


def na_abertura(u, v):
    vs, vt, a = ABERTURA
    du = abs((u - math.pi + math.pi) % (2 * math.pi) - math.pi)
    if v < vs or v > vt:
        return False
    k = (v - vs) / (vt - vs)
    return du < a * math.sqrt(max(0.0, 1 - k ** 4))


def copa(busto):
    us, vs, D, R = copa_raios(busto)
    P = [[C + D[i][j] * (R[i][j] + gomo(us[i], vs[j])) for j in range(NV + 1)] for i in range(NU)]
    P.append(P[0])
    global CIRC
    anel = [sum((P[i + 1][j] - P[i][j]).length for i in range(NU)) for j in range(NV + 1)]
    CIRC = lambda v: float(np.interp(v, vs, anel))                  # noqa: E731 (comprimento do anel em v)
    bm = bmesh.new()
    faces = B.grade(bm, P, uv=lambda i, j: (i / NU, 0.64 * vs[min(j, NV)] ** 1.0 * 0.97 + 0.005))
    tira = []
    for k, f in enumerate(faces):
        i, j = divmod(k, NV)
        uc = us[i] + math.pi / NU
        vc = (vs[j] + vs[j + 1]) / 2
        if na_abertura(uc, vc):
            f.tag = True
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.tag], context='FACES')
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    faixa = [C + D[i][0] * R[i][0] for i in range(NU)]
    return bm, us, faixa, tira


def botao(bm, topo, nrm):
    """Botão forrado do ápice: domo baixo de 6,5 mm de raio."""
    z = Vector((0, 0, 1))
    rot = z.rotation_difference(nrm).to_matrix().to_4x4()
    perfil = [(0.0, 0.0024), (0.0026, 0.0021), (0.0042, 0.0013), (0.0050, 0.0004), (0.0048, -0.0008), (0.0, -0.0008)]
    f = B.torno(bm, perfil, 20, mapa=lambda p: topo + rot @ p)
    B.uv_fixo(bm, f, (0.5, 0.645))
    return f


def aba(busto, faixa, us):
    """Aba: grade (s ao longo da faixa, t para fora); plano a partir da faixa, descendo ABA_INCL e curvando nas
    laterais; a espessura vem do Solidify (centrado) com a borda arredondada por bevel."""
    ns, nt = 32, 8
    bm = bmesh.new()
    ids = [i for i, u in enumerate(us) if abs(u) <= ABA_U]
    ids.sort(key=lambda i: us[i])
    P = []
    for k in range(ns + 1):
        s = -1 + 2 * k / ns
        u = s * ABA_U
        x = (u - us[ids[0]]) / (us[ids[-1]] - us[ids[0]]) * (len(ids) - 1)
        a = int(min(max(math.floor(x), 0), len(ids) - 2))
        f = x - a
        base = faixa[ids[a]] * (1 - f) + faixa[ids[a + 1]] * f
        base = base + (base - Vector((C.x, C.y, base.z))).normalized() * 0.0022   # sai da face externa
        fora = Vector((math.sin(u) * 0.30, -1.0, 0.0)).normalized()
        comp = ABA_L * max(0.0, 1 - abs(s) ** 2.0) ** 0.62
        linha = []
        for j in range(nt + 1):
            t = j / nt
            dist = comp * t
            p = base + fora * dist
            p.z -= dist * math.tan(ABA_INCL) + ABA_CURV * (abs(p.x) / 0.09) ** 2 * dist / ABA_L
            linha.append(p)
        P.append(linha)
    B.grade(bm, P, uv=lambda i, j: (0.02 + 0.96 * i / ns, 0.68 + 0.30 * j / nt))
    return bm


def solido(nome, bm, esp, desloc, bevel=0.0):
    """Malha com Solidify (+ bevel na borda) aplicados: devolve um objeto sem modificadores."""
    me = bpy.data.meshes.new('_' + nome)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('_' + nome, me)
    bpy.context.scene.collection.objects.link(o)
    s = o.modifiers.new('Esp', 'SOLIDIFY')
    s.thickness, s.offset, s.use_rim, s.use_even_offset = esp, desloc, True, True
    if bevel:
        bv = o.modifiers.new('Borda', 'BEVEL')
        bv.width, bv.segments, bv.limit_method, bv.angle_limit = bevel, 2, 'ANGLE', math.radians(50)
        bv.harden_normals = False
    dg = bpy.context.evaluated_depsgraph_get()
    novo = bmesh.new()
    novo.from_object(o, dg)
    bpy.data.objects.remove(o)
    bpy.data.meshes.remove(me)
    return novo


def construir(busto, mat):
    bm, us, faixa, _ = copa(busto)
    bm.verts.ensure_lookup_table()
    ap = max(bm.verts, key=lambda v: v.co.z).co.copy()
    casca = solido('copa', bm, ESP, 1.0)
    nrm = (ap - C).normalized()
    botao(casca, ap + nrm * (ESP + 0.0002), nrm)
    abm = solido('aba', aba(busto, faixa, us), 0.0034, 0.0, bevel=0.0011)
    me = bpy.data.meshes.new('_aba')
    abm.to_mesh(me)
    abm.free()
    casca.from_mesh(me)
    bpy.data.meshes.remove(me)
    obj = B.objeto('vela_bone_tecido', casca, mat, ang=40)
    return [obj]
