"""Geometria da receita do headset (vida `techlead`): malhas por grades no espaço do glb (Y para cima, +Z para a câmera,
+X = esquerda do Fael), UV por célula do atlas, perfis revolvidos e seções varridas, caminhos afastados da pele.

Tudo em metros do scan (real × 1,2: `R(mm reais)`). Chanfros e raios entram no PERFIL (mid-poly: arestas arredondadas
com 2–3 segmentos, sombreamento suave por ângulo + Weighted Normal), sem subdivisão.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

ESC = 1.2                                    # scan / real


def R(mm):
    """mm reais → metros do scan."""
    return mm * ESC / 1000.0


def bl(p):
    """glb (x, y, z) → Blender (x, −z, y); vale para pontos e direções."""
    return Vector((float(p[0]), float(-p[2]), float(p[1])))


def gl(v):
    return np.array((v[0], v[2], -v[1]), float)


def un(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


class Malha:
    """Acumula vértices (glb), faces, UV por canto e material por face; `objeto` cria a malha do Blender, funde as
    costuras duplicadas (a UV fica com a costura), acerta as normais e o sombreamento."""

    def __init__(self):
        self.V, self.F, self.UV, self.M = [], [], [], []

    def grade(self, P, cel, mat=0, fecha_i=False, fecha_j=False, uv=None):
        """P[i][j] (ni × nj × 3). Fechar = repete a primeira linha/coluna no fim (costura fundida depois).
        UV: (i, j) normalizados em 0..1 dentro da célula (u0, v0, u1, v1), ou uv(s, t) → (u, v) do atlas."""
        P = np.asarray(P, float)
        if fecha_i:
            P = np.concatenate([P, P[:1]], 0)
        if fecha_j:
            P = np.concatenate([P, P[:, :1]], 1)
        ni, nj = P.shape[:2]
        base = len(self.V)
        self.V += list(P.reshape(-1, 3))
        u0, v0, u1, v1 = cel
        for i in range(ni - 1):
            for j in range(nj - 1):
                idx = [base + a * nj + b for a, b in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
                cs = [(a / (ni - 1), b / (nj - 1)) for a, b in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
                uvs = [uv(s, t) if uv else (u0 + (u1 - u0) * s, v0 + (v1 - v0) * t) for s, t in cs]
                self.F.append(tuple(idx))
                self.UV.append(uvs)
                self.M.append(mat)
        return self

    def leque(self, anel, centro, uvc, mat=0):
        """Tampa em leque (anel fechado de pontos → centro), UV num ponto só (face lisa)."""
        c = len(self.V)
        self.V.append(np.asarray(centro, float))
        b = len(self.V)
        self.V += [np.asarray(p, float) for p in anel]
        n = len(anel)
        for k in range(n):
            self.F.append((c, b + k, b + (k + 1) % n))
            self.UV.append([uvc] * 3)
            self.M.append(mat)
        return self

    def objeto(self, nome, materiais, origem=(0, 0, 0), angulo=35.0, ponderada=True):
        me = bpy.data.meshes.new(nome)
        o = bl(origem)
        me.from_pydata([tuple(bl(p) - o) for p in self.V], [], self.F)
        camada = me.uv_layers.new(name='UVMap')
        for f, uvs in zip(me.polygons, self.UV):
            for k, li in enumerate(f.loop_indices):
                camada.data[li].uv = uvs[k]
        me.polygons.foreach_set('material_index', self.M)
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
        bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-8)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        for m in materiais:
            me.materials.append(m)
        for p in me.polygons:
            p.use_smooth = True
        me.set_sharp_from_angle(angle=math.radians(angulo))
        ob = bpy.data.objects.new(nome, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.location = o
        if ponderada:
            md = ob.modifiers.new('Normais', 'WEIGHTED_NORMAL')
            md.keep_sharp = True
            md.mode = 'FACE_AREA'
        return ob


# --------------------------------------------------------------------------------------------------- perfis e seções
def arco_canto(cx, cy, r, a0, a1, n):
    return [(cx + r * math.cos(a), cy + r * math.sin(a)) for a in np.linspace(a0, a1, n + 1)]


def sec_ret(w, h, r, n=3):
    """Retângulo w × h (centro na origem) com cantos de raio r (n segmentos por canto), anti-horário."""
    a, b = w / 2 - r, h / 2 - r
    pts = []
    for cx, cy, a0 in ((a, b, 0), (-a, b, 90), (-a, -b, 180), (a, -b, 270)):
        pts += arco_canto(cx, cy, r, math.radians(a0), math.radians(a0 + 90), n)
    return pts


def sec_circ(r, n=10):
    return [(r * math.cos(t), r * math.sin(t)) for t in np.linspace(0, 2 * math.pi, n, endpoint=False)]


def revolver(M, perfil, o, eixo, ref, seg, cel, mat=0, a0=0.0, a1=2 * math.pi, uv=None):
    """Revolve o perfil [(r, t)] em volta do eixo (origem o, direção eixo, ref = direção do ângulo 0)."""
    n = un(eixo)
    u = un(np.asarray(ref, float) - n * np.dot(ref, n))
    w = np.cross(n, u)
    cheio = abs(a1 - a0 - 2 * math.pi) < 1e-6
    angs = np.linspace(a0, a1, seg, endpoint=not cheio)
    P = [[np.asarray(o) + n * t + (u * math.cos(a) + w * math.sin(a)) * r for r, t in perfil] for a in angs]
    return M.grade(P, cel, mat, fecha_i=cheio, uv=uv)


def quadros(pts, ref=None):
    """Quadros (T, N, B) ao longo da polilinha: N = ref ortogonalizado (fixo) ou transporte paralelo."""
    pts = np.asarray(pts, float)
    T = np.gradient(pts, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    out = []
    n = None
    for t in T:
        if ref is not None:
            n = un(np.asarray(ref, float) - t * np.dot(ref, t))
        elif n is None:
            a = np.array((0, 1.0, 0)) if abs(t[1]) < 0.9 else np.array((1.0, 0, 0))
            n = un(a - t * np.dot(a, t))
        else:
            n = un(n - t * np.dot(n, t))
        out.append((t, n, np.cross(t, n)))
    return out


def varrer(M, pts, secao, cel, mat=0, ref=None, escala=None, tampas=True, uv=None):
    """Seção fechada [(a, b)] (a em N, b em B) varrida ao longo de pts; escala(k) ∈ (0, 1] afina as pontas."""
    Q = quadros(pts, ref)
    P = []
    for k, (p, (t, n, b)) in enumerate(zip(pts, Q)):
        s = escala(k / (len(pts) - 1)) if escala else 1.0
        P.append([np.asarray(p) + (n * a + b * c) * s for a, c in secao])
    M.grade(P, cel, mat, fecha_j=True, uv=uv)
    if tampas:
        uc = ((cel[0] + cel[2]) / 2, (cel[1] + cel[3]) / 2)
        M.leque(P[0][::-1], np.mean(P[0], 0), uc, mat)
        M.leque(P[-1], np.mean(P[-1], 0), uc, mat)
    return P


# ------------------------------------------------------------------------------------------------------- caminhos
def bezier(p0, p1, p2, p3, n):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2, p3 = (np.asarray(p, float) for p in (p0, p1, p2, p3))
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3


def hermite(p0, m0, p1, m1, n):
    t = np.linspace(0, 1, n)[:, None]
    h00, h10, h01, h11 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
    return h00 * p0 + h10 * np.asarray(m0) + h01 * p1 + h11 * np.asarray(m1)


def comprimento(pts):
    d = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    return np.concatenate([[0], np.cumsum(d)])


def reamostrar(pts, n):
    pts = np.asarray(pts, float)
    s = comprimento(pts)
    alvo = np.linspace(0, s[-1], n)
    return np.stack([np.interp(alvo, s, pts[:, k]) for k in range(3)], 1)


def afastar(pts, perto, folga, iters=40, fixos=2, suave=0.35):
    """Empurra a polilinha para fora da pele até `folga` (distância do eixo) e alisa; `perto(p)` → (q, n, d com sinal).
    As `fixos` primeiras e últimas amostras ficam onde estão (encaixe na concha e na cápsula)."""
    P = np.asarray(pts, float).copy()
    for _ in range(iters):
        mexeu = False
        for k in range(fixos, len(P) - fixos):
            q, nrm, d = perto(P[k])
            if d < folga:
                v = P[k] - q if d > 0 else q - P[k]
                v = un(v) if np.linalg.norm(v) > 1e-9 else un(nrm)
                P[k] = q + v * folga * 1.02
                mexeu = True
        Q = P.copy()
        viz = 0.5 * (P[fixos - 1:-fixos - 1] + P[fixos + 1:len(P) - fixos + 1])
        Q[fixos:-fixos] = (1 - suave) * P[fixos:-fixos] + suave * viz
        P = Q
        if not mexeu:
            break
    return P
