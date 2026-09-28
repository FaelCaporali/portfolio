"""Base da receita da vida `qa` (prop_qa.py): malha montada em coordenadas do GLB (Y para cima, +Z para a câmera,
+X = esquerda do Fael) e convertida para o Blender na criação do vértice, com UV no atlas e cor por vértice.

Por que no espaço do glb: o contrato da ficha (nós, pivôs, frente do bug em +Z local) é escrito nele; cada peça é
pensada e medida onde vai viver. `Malha.xf` (4×4, glb) leva a peça local ao lugar (ex.: espécime na caixa).
"""
import math
import os
import subprocess

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import prop_financeiro_v6 as v6
import prop_vela_base as B
import tempfile

TMP = tempfile.gettempdir()     # respeita o TMPDIR
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))       # glb → Blender


def bl(p):
    return Vector((p[0], -p[2], p[1]))


def m_bl(M):
    """Matriz 4×4 (numpy, glb) → matriz de objeto do Blender (o exportador devolve a mesma no glb)."""
    return C @ Matrix(np.asarray(M).tolist()) @ C.inverted()


def quadro(o, x, y, z):
    M = np.eye(4)
    M[:3, 0], M[:3, 1], M[:3, 2], M[:3, 3] = x, y, z, o
    return M


def unit(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


def lin(c):
    """hex sRGB ou tupla linear → RGBA linear."""
    if isinstance(c, str):
        return v6.srgb(c)
    return tuple(c) + ((1.0,) if len(c) == 3 else ())


def mistura(a, b, t):
    a, b = np.array(lin(a)), np.array(lin(b))
    return tuple(a + (b - a) * float(np.clip(t, 0, 1)))


# orçamento da vida (uma mão, 1024²): pele um pouco mais leve
QUALIDADE = {'uber_pele_cor': 66, 'uber_pele_normal': 74}


def imagem(nome, rgb, pasta, qualidade=90):
    """numpy (h, w, 3|4) 0..1 sRGB, linha 0 = v 0 → WebP em `pasta` → imagem do Blender (bytes do arquivo)."""
    qualidade = QUALIDADE.get(nome, qualidade)
    os.makedirs(pasta, exist_ok=True)
    arq = os.path.join(pasta, nome + '.webp')
    a = (np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)
    tmp = os.path.join(TMP, nome + '.npy')
    np.save(tmp, np.ascontiguousarray(a[::-1]))
    cod = ("import numpy as n,sys;from PIL import Image;a=n.load(sys.argv[1]);"
           "Image.fromarray(a,'RGBA' if a.shape[2]==4 else 'RGB').save(sys.argv[2],'WEBP',quality=int(sys.argv[3]),"
           "method=6)")
    subprocess.run(['python3', '-c', cod, tmp, arq, str(qualidade)], check=True)
    img = bpy.data.images.load(arq, check_existing=False)
    img.name = nome
    return img


B.imagem = imagem                                        # a pele do Uber grava pelo B.imagem: temporário no nosso tmp


class Malha:
    """bmesh com camadas UVMap e Col; pontos dados no glb (× xf)."""

    def __init__(self):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap')
        self.col = self.bm.loops.layers.float_color.new('Col')
        self.xf = np.eye(4)

    def _p(self, p):
        q = self.xf[:3, :3] @ np.asarray(p, float) + self.xf[:3, 3]
        return bl(q)

    def verts(self, P):
        return [self.bm.verts.new(self._p(p)) for p in P]

    def face(self, vs, uvs=None, cores=None):
        try:
            f = self.bm.faces.new(vs)
        except ValueError:
            return None
        for k, lp in enumerate(f.loops):
            if uvs is not None:
                lp[self.uv].uv = uvs[k]
            if cores is not None:
                lp[self.col] = cores[k] if isinstance(cores, list) else cores
        return f

    def grade(self, P, uv=None, cor=None, fecha_i=False, fecha_j=False, cel=None, wrap_j=False):
        """P (ni, nj, 3) no glb; uv (ni, nj, 2) em 0..1 (levado à célula `cel` do atlas); cor (ni, nj, 4) ou uma
        cor. wrap_j: u (uv[..., 0]) dá a volta em j (a última coluna de faces usa u + 1)."""
        P = np.asarray(P, float)
        ni, nj = P.shape[:2]
        V = [self.verts(P[i]) for i in range(ni)]
        fs = []
        for i in range(ni if fecha_i else ni - 1):
            i1 = (i + 1) % ni
            for j in range(nj if fecha_j else nj - 1):
                j1 = (j + 1) % nj
                ids = ((i, j), (i1, j), (i1, j1), (i, j1))
                uvs = None
                if uv is not None:
                    uvs = [np.array(uv[a][b], float) for a, b in ids]
                    if wrap_j and j1 == 0:
                        uvs[2][0] += 1.0
                        uvs[3][0] += 1.0
                    uvs = [celula_uv(cel, u) for u in uvs]
                cs = None
                if cor is not None:
                    cs = [lin(cor[a][b]) for a, b in ids] if isinstance(cor, np.ndarray) else lin(cor)
                f = self.face([V[a][b] for a, b in ids], uvs, cs)
                if f is not None:
                    fs.append(f)
        return V, fs

    def leque(self, anel, centro, uv_c, uvs, cor, cel=None, inverte=False):
        """Tampa em leque de um anel de vértices até o ponto `centro`."""
        c = self.verts([centro])[0]
        n = len(anel)
        for k in range(n):
            a, b = anel[k], anel[(k + 1) % n]
            vs, u = ([a, b, c], [uvs[k], uvs[(k + 1) % n], uv_c])
            if inverte:
                vs, u = vs[::-1], u[::-1]
            self.face(vs, [celula_uv(cel, x) for x in u], lin(cor))

    def torno(self, perfil, seg, o, eixo, ref, cel=None, cor='#ffffff', fecha_perfil=False, tampas=(False, False)):
        """Sólido de revolução: perfil [(r, h)] em volta de `eixo` a partir de `o` (glb); UV u = ângulo, v = perfil;
        cor: uma ou lista por ponto do perfil."""
        e, r0 = unit(eixo), unit(ref)
        b0 = np.cross(e, r0)
        ang = np.linspace(0, 2 * math.pi, seg, endpoint=False)
        pr = np.array(perfil, float)
        L = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pr, axis=0), axis=1))]
        L = L / max(L[-1], 1e-9)
        P = np.array([[o + e * h + (r0 * math.cos(a) + b0 * math.sin(a)) * r for a in ang] for r, h in pr])
        uv = np.array([[(a / (2 * math.pi), v) for a in ang] for v in L])
        cores = None if isinstance(cor, str) else np.array([[lin(c)] * seg for c in cor])
        V, fs = self.grade(P, uv, cores if cores is not None else cor, fecha_i=fecha_perfil, fecha_j=True, cel=cel,
                           wrap_j=True)
        for k, (usa, i) in enumerate(zip(tampas, (0, len(pr) - 1))):
            if usa:
                c = cor if isinstance(cor, str) else cor[i]
                self.leque(V[i], o + e * pr[i][1], (0.5, 0.5), [(0.5 + 0.4 * math.cos(a), 0.5 + 0.4 * math.sin(a))
                                                                  for a in ang], c, cel, inverte=(k == 1))
        return V, fs

    def elipsoide(self, c, semi, nu=12, nv=16, ex=2.0, ey=2.0, forma=None, cel=None, cor='#ffffff'):
        """Superelipsoide (polos em ±z local); forma(P) → P deforma no local antes de ir ao lugar."""
        def s(w, e):
            return np.sign(w) * np.abs(w) ** (2.0 / e)
        th = np.linspace(0, math.pi, nu + 1)[1:-1]
        ph = np.linspace(0, 2 * math.pi, nv, endpoint=False)
        T, F = np.meshgrid(th, ph, indexing='ij')
        P = np.stack([semi[0] * s(np.sin(T), ex) * s(np.cos(F), ey), semi[1] * s(np.sin(T), ex) * s(np.sin(F), ey),
                      semi[2] * s(np.cos(T), ex)], -1)
        polos = np.array([[0, 0, semi[2]], [0, 0, -semi[2]]], float)
        if forma is not None:
            P = forma(P.reshape(-1, 3)).reshape(P.shape)
            polos = forma(polos)
        P, polos = P + c, polos + c
        uv = np.stack([F / (2 * math.pi), T / math.pi], -1)
        cor_g = cor(P) if callable(cor) else cor
        V, fs = self.grade(P, uv, cor_g, fecha_j=True, cel=cel, wrap_j=True)
        cu = cor_g if isinstance(cor_g, str) else tuple(cor_g[0][0])
        cd = cor_g if isinstance(cor_g, str) else tuple(cor_g[-1][0])
        self.leque(V[0], polos[0], (0.5, 0.0), [(u, 0.02) for u in ph / (2 * math.pi)], cu, cel, inverte=True)
        self.leque(V[-1], polos[1], (0.5, 1.0), [(u, 0.98) for u in ph / (2 * math.pi)], cd, cel)
        return V, fs

    def tubo(self, pts, raios, seg=6, cel=None, cor='#ffffff', tampa=True):
        """Tubo ao longo da polilinha (glb) com raio por ponto; UV u = volta, v = comprimento."""
        pts = np.asarray(pts, float)
        n = len(pts)
        t0 = unit(pts[1] - pts[0])
        nrm = unit(np.cross(t0, [0.31, 0.93, 0.17]))
        P = []
        for k in range(n):
            t = unit(pts[min(k + 1, n - 1)] - pts[max(k - 1, 0)])
            nrm = unit(nrm - t * (nrm @ t))
            b = np.cross(t, nrm)
            P.append([pts[k] + (nrm * math.cos(a) + b * math.sin(a)) * raios[k]
                      for a in np.linspace(0, 2 * math.pi, seg, endpoint=False)])
        P = np.array(P)
        L = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
        uv = np.array([[(j / seg, L[k] / max(L[-1], 1e-9)) for j in range(seg)] for k in range(n)])
        V, fs = self.grade(P, uv, cor, fecha_j=True, cel=cel, wrap_j=True)
        if tampa:
            ring = [(0.5, 0.5)] * seg
            self.leque(V[0], pts[0] - t0 * raios[0] * 0.5, (0.5, 0.5), ring, cor if isinstance(cor, str) else
                       tuple(cor[0][0]), cel, inverte=True)
            tn = unit(pts[-1] - pts[-2])
            self.leque(V[-1], pts[-1] + tn * raios[-1] * 0.5, (0.5, 0.5), ring, cor if isinstance(cor, str) else
                       tuple(cor[-1][0]), cel)
        return V, fs

    def objeto(self, nome, mat, ang=40, normais=True, cor=True):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        if not cor:
            self.bm.loops.layers.float_color.remove(self.col)
        ob = v6.mesh_obj(nome, self.bm)
        v6.shade(ob, ang)
        if normais:
            md = ob.modifiers.new('Normais', 'WEIGHTED_NORMAL')
            md.keep_sharp, md.weight, md.mode = True, 50, 'FACE_AREA'
        ob.data.materials.append(mat)
        return ob


# Atlas 4 × 4 (células de 128 px no 512): nome → (coluna, linha); linha 0 = v de baixo
CELULAS = {'laca': (0, 0), 'quitina': (1, 0), 'olho': (2, 0), 'pata': (3, 0),
           'latao': (0, 1), 'madeira': (1, 1), 'cortica': (2, 1), 'papel': (3, 1),
           'etiqueta_a': (0, 2), 'etiqueta_b': (1, 2), 'etiqueta_c': (2, 2), 'aco': (3, 2),
           'especime': (0, 3), 'verniz': (1, 3), 'liso': (2, 3), 'nylon': (3, 3)}
MARGEM = 0.03


def celula_uv(cel, uv):
    if cel is None:
        return (float(uv[0]), float(uv[1]))
    c, r = CELULAS[cel]
    u = MARGEM + (1 - 2 * MARGEM) * float(uv[0])
    v = MARGEM + (1 - 2 * MARGEM) * float(uv[1])
    return ((c + u) / 4, (r + v) / 4)


def vazio(nome, pai=None, M=None):
    o = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(o)
    o.empty_display_size = 0.01
    if pai is not None:
        o.parent = pai
    if M is not None:
        bpy.context.view_layer.update()
        o.matrix_world = m_bl(M)
    return o


def pendurar(filho, pai):
    """Parenta mantendo o mundo, com a inversa embutida na local (o glTF recebe TRS limpo)."""
    bpy.context.view_layer.update()
    mw = filho.matrix_world.copy()
    filho.parent = pai
    filho.matrix_parent_inverse.identity()
    filho.matrix_world = mw


def fade(ob, valores=None):
    """2ª UV `Fade` (TEXCOORD_1.x): 1 visível → 0 fundo; sem valores, tudo 1."""
    me = ob.data
    n = len(me.vertices)
    val = np.ones(n) if valores is None else np.asarray(valores, float)
    lay = me.uv_layers.get('Fade') or me.uv_layers.new(name='Fade')
    for p in me.polygons:
        for li, vi in zip(p.loop_indices, p.vertices):
            lay.data[li].uv = (float(val[vi]), 0.5)
    me.uv_layers.active = me.uv_layers['UVMap']


def chave_forma(ob, nome, V_bl):
    """Chave de forma `nome` com as posições V_bl (mesma ordem de vértices), base = a malha atual."""
    if ob.data.shape_keys is None:
        ob.shape_key_add(name='Basis', from_mix=False)
    k = ob.shape_key_add(name=nome, from_mix=False)
    for i, p in enumerate(V_bl):
        k.data[i].co = p
    k.value = 0.0
    return k
