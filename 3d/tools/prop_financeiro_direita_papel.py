"""Papéis do lado direito do financeiro: a fita que sai da calculadora e o boleto (parte de prop_financeiro_direita.py).

Folhas com espessura real (frente, verso e bordas). Fita: u na largura, v = 0 na fenda e 1 na ponta; verso e bordas em
u = 0,01 (margem sem tinta). Boleto: UV 0..1 na face; verso em 0,004. O texto é canvas do site.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import prop_financeiro_v6 as v6

TOPO = 0.035                                          # topo do cabeçote da calculadora (espaço local da peça)
TAPE_X, TAPE_W, TAPE_T, SLOT_Y, RISE, CURL_R = 0.010, 0.030, 0.0006, 0.0095, 0.155, 0.011
BOL_W, BOL_H, BOL_T, BOL_X, BOL_Y, BOL_LEAN, BOL_YAW = 0.105, 0.070, 0.0003, -0.0015, 0.0215, 9.0, 2.0


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
    """Fita saindo da fenda, subindo com leve inclinação e ondulação de papel e enrolando para trás no alto."""
    pts = [(SLOT_Y + 0.0016 * (k / 48) ** 2 + 0.0006 * math.sin(k / 48 * math.pi * 1.5), TOPO - 0.002 + RISE * k / 48)
           for k in range(49)]
    ye, ze = pts[-1]
    total = math.pi + 0.55
    for k in range(1, 37):
        fi = math.pi - total * k / 36
        rr = CURL_R * (1 - 0.3 * k / 36)
        pts.append((ye + CURL_R + rr * math.cos(fi), ze + rr * math.sin(fi)))
    s = [0.0]
    for a, b in zip(pts, pts[1:]):
        s.append(s[-1] + math.dist(a, b))
    grade = []
    xs = [TAPE_X + TAPE_W * (j / 4 - 0.5) for j in range(5)]
    for i, (y, z) in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        t = Vector((0, b[0] - a[0], b[1] - a[1])).normalized()
        n = Vector((0, -t.z, t.y))
        grade.append([(Vector((x, y, z)) + n * (0.0004 * ((x - TAPE_X) / (TAPE_W / 2)) ** 2), n) for x in xs])
    obj = folha('fita', grade, TAPE_W, TAPE_T, lambda i, j: (j / 4, s[i] / s[-1]), lambda i: (0.01, s[i] / s[-1]))
    print('FITA comprimento %.4f m, reta %.4f m' % (s[-1], s[48]))
    return obj


def boleto():
    """Boleto destacável apoiado no degrau do cabeçote e no arame: leve arco, topo cedendo para trás, canto erguido."""
    nu, nv = 20, 12
    rot = Matrix.Rotation(math.radians(BOL_YAW), 3, 'Z') @ Matrix.Rotation(math.radians(-BOL_LEAN), 3, 'X')
    grade = []
    for i in range(nv + 1):
        v = i / nv
        linha = []
        for j in range(nu + 1):
            u = j / nu
            y = 0.0010 * (1 - (2 * u - 1) ** 2) * v + 0.0020 * max(0, (v - 0.7) / 0.3) ** 2
            y -= 0.0035 * max(0, (0.22 - u) / 0.22) ** 2 * max(0, (v - 0.55) / 0.45) ** 2
            p = rot @ Vector(((u - 0.5) * BOL_W, y, v * BOL_H)) + Vector((BOL_X, BOL_Y, TOPO))
            linha.append(p)
        grade.append(linha)
    g2 = []
    for i in range(nv + 1):
        linha = []
        for j in range(nu + 1):
            du = grade[i][min(j + 1, nu)] - grade[i][max(j - 1, 0)]
            dv = grade[min(i + 1, nv)][j] - grade[max(i - 1, 0)][j]
            linha.append((grade[i][j], du.cross(dv).normalized()))
        g2.append(linha)
    return folha('boleto', g2, BOL_W, BOL_T, lambda i, j: (j / nu, i / nv), lambda i: (0.004, 0.004))
