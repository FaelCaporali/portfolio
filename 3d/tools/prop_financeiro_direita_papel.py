"""Papéis do lado direito do financeiro: a fita que sai da calculadora e o boleto (parte de prop_financeiro_direita.py).

Folhas com espessura real (frente, verso e bordas). Fita: u na largura, v = 0 na fenda e 1 na ponta da espiral; verso e
bordas em u = 0,01 (margem sem tinta). Boleto: UV 0..1 na face (v = 1 na borda presa sob a calculadora); verso em 0,004.
O texto é canvas do site.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import prop_financeiro_v6 as v6

TOPO = 0.035                                          # topo do cabeçote da calculadora (espaço local da peça)
TAPE_X, TAPE_W, TAPE_T, SLOT_Y = 0.010, 0.030, 0.0006, 0.0095
RISE, ESP_R0, ESP_R1, ESP_VOLTAS, TORCAO = 0.150, 0.012, 0.006, 1.75, -0.22   # subida, espiral (m, voltas), giro (rad)
BOL_W, BOL_H, BOL_T, BOL_X, BOL_YAW = 0.105, 0.070, 0.0003, -0.010, 0.0   # X: borda direita rente à carcaça
FRENTE, BOL_PINO, BOL_DOBRA, BOL_TILT = -0.030, 0.0025, 0.0045, 16.0  # pé da carcaça, trecho preso, raio, pende (°)


def folha(nome, grade, largura, esp, uvf, uv_verso):
    """Folha de papel com espessura real: grade da face (pontos e normais da frente), verso deslocado e bordas."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    frente = [[bm.verts.new(p) for p, _ in lin_] for lin_ in grade]
    verso = [[bm.verts.new(p - n * esp) for p, n in lin_] for lin_ in grade]
    ni, nj = len(grade), len(grade[0])

    def quad(vs, u):
        f = bm.faces.new(vs)
        for lp, uvv in zip(f.loops, u):
            lp[uv].uv = uvv

    for i in range(ni - 1):
        for j in range(nj - 1):
            quad((frente[i][j], frente[i][j + 1], frente[i + 1][j + 1], frente[i + 1][j]),
                 [uvf(i, j), uvf(i, j + 1), uvf(i + 1, j + 1), uvf(i + 1, j)])
            quad((verso[i][j], verso[i + 1][j], verso[i + 1][j + 1], verso[i][j + 1]), [uv_verso(i)] * 4)
    for i in range(ni - 1):
        for j in (0, nj - 1):
            quad((frente[i][j], frente[i + 1][j], verso[i + 1][j], verso[i][j]), [uv_verso(i)] * 4)
    for i in (0, ni - 1):
        for j in range(nj - 1):
            quad((frente[i][j], verso[i][j], verso[i][j + 1], frente[i][j + 1]), [uv_verso(i)] * 4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = v6.mesh_obj(nome, bm)
    v6.shade(obj, 60)
    return obj


def fita():
    """Papel de máquina de somar: sai da fenda, sobe com leve arco para trás, ondulação e torção de papel (a face gira
    ~12° para a câmera e volta) e, pela memória do rolo, enrola para trás numa espiral solta de raio decrescente
    (ESP_VOLTAS voltas, ESP_R0 → ESP_R1) que cai por trás, avançando 4 mm em X (não é um anel fechado)."""
    cen, tor, n = [], [], 64
    for k in range(n + 1):
        t = k / n
        cen.append(Vector((TAPE_X + 0.0025 * math.sin(math.pi * t),
                           SLOT_Y + 0.009 * t ** 2.2 + 0.0014 * math.sin(math.pi * 1.6 * t), TOPO - 0.002 + RISE * t)))
        tor.append(TORCAO * math.sin(math.pi * t))
    p, q = cen[-1], cen[-2]
    d = Vector((0, p.y - q.y, p.z - q.z)).normalized()
    cy, cz = p.y + d.z * ESP_R0, p.z - d.y * ESP_R0            # centro atrás da fita (normal à direita = +Y)
    a0, tot, m = math.atan2(p.z - cz, p.y - cy), ESP_VOLTAS * 2 * math.pi, 110
    for k in range(1, m + 1):
        al = tot * k / m
        r = ESP_R0 + (ESP_R1 - ESP_R0) * al / tot
        cen.append(Vector((p.x + 0.004 * al / tot, cy + r * math.cos(a0 - al), cz + r * math.sin(a0 - al))))
        tor.append(0.0)
    s = [0.0]
    for a, b in zip(cen, cen[1:]):
        s.append(s[-1] + (b - a).length)
    grade = []
    for i, pt in enumerate(cen):
        t = (cen[min(i + 1, len(cen) - 1)] - cen[max(i - 1, 0)]).normalized()
        w = (Vector((1, 0, 0)) - t * t.x).normalized()
        w = w * math.cos(tor[i]) + w.cross(t) * math.sin(tor[i])
        nn = w.cross(t)                                      # frente da fita (−Y na subida)
        grade.append([(pt + w * (TAPE_W * (j / 4 - 0.5)) + nn * (0.0004 * (j / 2 - 1) ** 2), nn) for j in range(5)])
    obj = folha('fita', grade, TAPE_W, TAPE_T, lambda i, j: (j / 4, s[i] / s[-1]), lambda i: (0.01, s[i] / s[-1]))
    zs = [c.z for c in cen]
    print('FITA comprimento L = %.4f m, subida %.4f m, altura %.4f m' % (s[-1], s[n], max(zs) - min(zs)))
    return obj


def linha_boleto(s):
    """Linha média do boleto a s metros da borda de cima: ponto (y, z), normal da face (y, z) e quanto já pende (0..1).
    Trecho preso sob o pé da frente da carcaça, dobra de raio BOL_DOBRA e trecho que pende com o pé para a câmera."""
    b, zp = math.radians(BOL_TILT), -0.00008
    arco = BOL_DOBRA * (math.pi / 2 - b)
    if s <= BOL_PINO:
        return (FRENTE + BOL_PINO - s, zp), (0.0, 1.0), 0.0
    f = math.pi + min(s - BOL_PINO, arco) / BOL_DOBRA
    nrm = (math.sin(f), -math.cos(f))
    y, z = FRENTE + BOL_DOBRA * nrm[0], zp - BOL_DOBRA + BOL_DOBRA * nrm[1]
    resto = max(0.0, s - BOL_PINO - arco)
    return (y - math.sin(b) * resto, z - math.cos(b) * resto), nrm, resto / (BOL_H - BOL_PINO - arco)


def boleto():
    """Boleto preso pela calculadora (peso de papel): a borda de cima fica sob o pé da frente e o papel dobra e pende
    inclinado para a câmera, abaixo do teclado, com leve barriga e o canto de baixo levantado. Nada passa na frente."""
    nu = 20
    ss = [0.0, BOL_PINO] + [BOL_PINO + BOL_DOBRA * 1.3 * k / 6 for k in range(1, 7)]
    ss += [ss[-1] + (BOL_H - ss[-1]) * k / 16 for k in range(1, 17)]
    ss.reverse()                                             # i cresce com v (v = 0 embaixo, no código de barras)
    rot = Matrix.Rotation(math.radians(BOL_YAW), 3, 'Z')
    piv = Vector((BOL_X, FRENTE, 0))
    grade = []
    for s in ss:
        (y, z), (ny, nz), h = linha_boleto(s)
        linha = []
        for j in range(nu + 1):
            u = j / nu
            off = 0.0008 * (1 - (2 * u - 1) ** 2) * h + 0.0035 * (max(0, (0.22 - u) / 0.22) * max(0, (h - 0.6) / 0.4)) ** 2
            linha.append(rot @ (Vector((BOL_X + (u - 0.5) * BOL_W, y + ny * off, z + nz * off)) - piv) + piv)
        grade.append(linha)
    nv = len(ss) - 1
    g2 = []
    for i in range(nv + 1):
        linha = []
        for j in range(nu + 1):
            du = grade[i][min(j + 1, nu)] - grade[i][max(j - 1, 0)]
            dv = grade[min(i + 1, nv)][j] - grade[max(i - 1, 0)][j]
            linha.append((grade[i][j], du.cross(dv).normalized()))
        g2.append(linha)
    vs = [1 - s / BOL_H for s in ss]
    return folha('boleto', g2, BOL_W, BOL_T, lambda i, j: (j / nu, vs[i]), lambda i: (0.004, 0.004))
