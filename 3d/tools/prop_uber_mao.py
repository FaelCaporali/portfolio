"""Mãos do `uber` (U2/U3/U5): malha de mão do MPFB2 (a mesma base anatômica do NPC01), extraída com punho e toco de
antebraço, subdividida, com relevo anatômico (nós, tendões extensores, unha) e posada por FK próprio sobre os pesos do
MPFB para ENVOLVER o aro com folga medida (0,5–2 mm, sem atravessar).

Por que FK próprio: o esqueleto `default` do MPFB só encaixa na malha com `detailed_helpers` (cubos de junta) e, mesmo
assim, o giro por modificador exige avaliar o depsgraph a cada passo do ajuste. Aqui a pose é skinning linear em numpy
(pivôs = cabeças dos ossos do rig encaixado, pesos = grupos do MPFB), rápido o bastante para o ajuste por contato.

Espaço de repouso: o do humano do MPFB (metros, Z para cima). A pegada e a ida ao aro (espaço do glb) estão em
prop_uber_pega.py. Lado 'L' = esquerda do Fael (x > 0 no glb), 'R' = direita.
"""
import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

DEDOS = [['finger%d-%d' % (d, k) for k in (1, 2, 3)] for d in range(1, 6)]      # d = 1 polegar … 5 mínimo
MCARP = {2: 'metacarpal1', 3: 'metacarpal2', 4: 'metacarpal3', 5: 'metacarpal4'}
ADUCAO = {2: 0.3, 4: 0.3, 5: 0.4}                       # fração do leque do repouso que fica (dedos juntos)
OSSOS_MAO = ['wrist'] + list(MCARP.values()) + [b for d in DEDOS for b in d]
_HUMANO = {}


def humano():
    """Humano MPFB masculino adulto médio, rig `default` encaixado (cubos de junta). Uma vez por sessão."""
    if 'o' in _HUMANO:
        return _HUMANO['o'], _HUMANO['arm']
    import addon_utils
    addon_utils.enable('bl_ext.blender_org.mpfb', default_set=True, persistent=True)
    from bl_ext.blender_org.mpfb.services.humanservice import HumanService
    macro = {'gender': 1.0, 'age': 0.5, 'muscle': 0.55, 'weight': 0.5, 'height': 0.5, 'proportions': 0.55,
             'cupsize': 0.5, 'firmness': 0.5, 'race': {'asian': 0.1, 'african': 0.15, 'caucasian': 0.75}}
    o = HumanService.create_human(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True,
                                  feet_on_ground=True, scale=0.1, macro_detail_dict=macro)
    arm = HumanService.add_builtin_rig(o, 'default', import_weights=True)
    _HUMANO.update(o=o, arm=arm)
    return o, arm


class Mao:
    """Malha de repouso (V, faces, UV, pesos por osso) e FK por dobradiça."""

    def __init__(self, lado, antebraco=0.075, subdiv=1, rigidez=2.5):
        o, arm = humano()
        self.lado = lado
        for m in o.modifiers:
            m.show_viewport = False                      # só as chaves de forma do MPFB (topologia intacta)
        dg = bpy.context.evaluated_depsgraph_get()
        me = o.evaluated_get(dg).to_mesh()
        P = np.array([v.co[:] for v in me.vertices])
        o.evaluated_get(dg).to_mesh_clear()
        nomes = {g.index: g.name for g in o.vertex_groups}
        self.ossos = [b + '.' + lado for b in OSSOS_MAO]
        idx = {n: i for i, n in enumerate(self.ossos)}
        self.cab = {}
        for b in arm.data.bones:
            nb = b.name
            if nb in idx or nb in ('lowerarm02.' + lado,):
                self.cab[nb] = (np.array(arm.matrix_world @ b.head_local), np.array(arm.matrix_world @ b.tail_local))
        W = np.zeros((len(P), len(self.ossos)))
        corpo = o.vertex_groups['body'].index
        unha = o.vertex_groups['fingernails'].index
        e_corpo = np.zeros(len(P), bool)
        e_unha = np.zeros(len(P))
        for v in o.data.vertices:
            for g in v.groups:
                n = nomes[g.group]
                if n in idx:
                    W[v.index, idx[n]] = g.weight
                elif g.group == corpo:
                    e_corpo[v.index] = True
                elif g.group == unha:
                    e_unha[v.index] = g.weight
        pulso = self.cab['wrist.' + lado][0]
        eixo = pulso - self.cab['lowerarm02.' + lado][0]
        eixo /= np.linalg.norm(eixo)
        t = (P - pulso) @ eixo                            # > 0 na mão; toco de antebraço até −antebraco
        dentro = e_corpo & ((W.sum(1) > 0.01) | ((t > -antebraco) & (np.linalg.norm(P - pulso - np.outer(t, eixo),
                                                                                         axis=1) < 0.06)))
        dentro &= t > -antebraco
        bm = bmesh.new()
        bm.from_mesh(o.data)
        uvl = bm.loops.layers.uv.active
        for v in bm.verts:
            v.co = P[v.index]
        fora = [v for v in bm.verts if not dentro[v.index]]
        # pesos e máscara de unha como camadas de deformação do bmesh (interpolam na subdivisão)
        dl = bm.verts.layers.deform.verify()
        for v in bm.verts:
            v[dl].clear()
            for k in np.nonzero(W[v.index])[0]:
                v[dl][int(k)] = float(W[v.index, k])
            v[dl][len(self.ossos)] = float(e_unha[v.index])
            v[dl][len(self.ossos) + 1] = float(t[v.index] + 0.5)               # distância ao pulso (+0,5)
        bmesh.ops.delete(bm, geom=fora, context='VERTS')
        for camada in list(bm.verts.layers.shape):
            bm.verts.layers.shape.remove(camada)
        borda = [e for e in bm.edges if e.is_boundary]           # toco do antebraço FECHADO (sem boca aberta)
        if borda:
            bmesh.ops.holes_fill(bm, edges=borda, sides=256)
        me2 = bpy.data.meshes.new('_mao_' + lado)
        bm.to_mesh(me2)
        bm.free()
        ob = bpy.data.objects.new('_mao_' + lado, me2)
        bpy.context.scene.collection.objects.link(ob)
        for n in self.ossos + ['_unha', '_t']:
            ob.vertex_groups.new(name=n)
        del uvl
        if subdiv:
            md = ob.modifiers.new('Sub', 'SUBSURF')
            md.levels = subdiv
            md.uv_smooth = 'PRESERVE_CORNERS'
        dg = bpy.context.evaluated_depsgraph_get()
        me3 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        bpy.data.objects.remove(ob)
        bpy.data.meshes.remove(me2)
        self.malha = me3
        n = len(me3.vertices)
        self.V = np.array([v.co[:] for v in me3.vertices])
        self.W = np.zeros((n, len(self.ossos)))
        self.unha = np.zeros(n)
        self.t = np.zeros(n)
        for v in me3.vertices:
            for g in v.groups:
                if g.group < len(self.ossos):
                    self.W[v.index, g.group] = g.weight
                elif g.group == len(self.ossos):
                    self.unha[v.index] = g.weight
                else:
                    self.t[v.index] = g.weight - 0.5
        self.W = self.W ** rigidez                        # dobra concentrada na junta: falange reta, nó marcado
        s = self.W.sum(1, keepdims=True)
        self.W = np.where(s > 1e-6, self.W / np.maximum(s, 1e-6), 0)
        self.W[:, 0] += (s[:, 0] <= 1e-6)                # antebraço (sem peso de mão) segue o punho
        self.idx = idx
        self.pai = {}
        for b in arm.data.bones:
            if b.name in idx and b.parent is not None and b.parent.name in idx:
                self.pai[b.name] = b.parent.name
        self.rot = {}                                     # osso → matriz 3×3 local (repouso) em torno da cabeça
        import prop_uber_mao_relevo as RL                 # lado do DORSO = média das normais do anel das unhas
        self._dorso = RL.normais(self.malha, self.V)[self.unha > 0.5].mean(0)

    # -------------------------------------------------------------------------------------------------- FK
    def escalar(self, k):
        c = self.cab['wrist.' + self.lado][0].copy()
        self.V = c + (self.V - c) * k
        self.cab = {n: (c + (h - c) * k, c + (tl - c) * k) for n, (h, tl) in self.cab.items()}

    def afinar(self, k_dedo=0.86, k_polegar=0.92):
        """Dedos mais finos (proporção real; o MPFB médio sai com dedos cheios): aproxima cada vértice do eixo do seu
        osso de dedo, ponderado pelo peso (a transição na junta com o metacarpo fica suave)."""
        dV = np.zeros_like(self.V)
        for d in range(1, 6):
            k = k_polegar if d == 1 else k_dedo
            for j in (1, 2, 3):
                b = 'finger%d-%d.%s' % (d, j, self.lado)
                h, tl = self.cab[b]
                ax = (tl - h) / np.linalg.norm(tl - h)
                q = self.V - h
                radial = q - np.outer(q @ ax, ax)
                dV -= self.W[:, self.idx[b], None] * (1 - k) * radial
        self.V = self.V + dV

    def dedo(self, d):
        """(cabeças das 3 falanges, ponta, eixos, comprimentos) do dedo d no repouso."""
        s = '.' + self.lado
        hs = [self.cab['finger%d-%d' % (d, k) + s][0] for k in (1, 2, 3)]
        ax3 = self.cab['finger%d-3' % d + s][1] - hs[2]
        ax3 /= np.linalg.norm(ax3)
        seg = self.W[:, self.idx['finger%d-3' % d + s]] > 0.3
        ponta = hs[2] + ax3 * float(((self.V[seg] - hs[2]) @ ax3).max())
        pts = hs + [ponta]
        comp = [float(np.linalg.norm(pts[k + 1] - pts[k])) for k in range(3)]
        eixos = [(pts[k + 1] - pts[k]) / comp[k] for k in range(3)]
        return pts, eixos, comp

    def proporcionar(self, medio=0.445, cascata=None, falanges=(1.0, 0.65, 0.5)):
        """ADENDO 4: médio = `medio` do comprimento da mão, indicador/anelar/mínimo pela `cascata` do médio e falanges
        na razão `falanges`, mantendo o nó (MCP) e a espessura; cada vértice acompanha o seu segmento pelo peso."""
        cascata = cascata or {2: 0.9, 3: 1.0, 4: 0.92, 5: 0.77}
        s = '.' + self.lado
        w = self.cab['wrist' + s][0]
        _, df, _, _ = self.quadro()
        palma = float((self.cab['finger3-1' + s][0] - w) @ df)
        M = medio / (1 - medio) * palma                      # L = palma + médio
        dV = np.zeros_like(self.V)
        for d, c in cascata.items():
            pts, eixos, comp = self.dedo(d)
            alvo = [M * c * f / sum(falanges) for f in falanges]
            novos = [pts[0]]
            for k in range(3):
                novos.append(novos[-1] + eixos[k] * alvo[k])
            for k in range(3):
                b = 'finger%d-%d' % (d, k + 1) + s
                q = self.V - pts[k]
                al = q @ eixos[k]
                desl = novos[k] - pts[k] + np.outer(al * (alvo[k] / comp[k] - 1), eixos[k])
                dV += self.W[:, self.idx[b], None] * desl
                self.cab[b] = (novos[k], novos[k + 1])
        self.V = self.V + dV

    def globais(self):
        G = {}

        def g(b):
            if b in G:
                return G[b]
            R = self.rot.get(b, np.eye(3))
            h = self.cab[b][0]
            M = np.eye(4)
            M[:3, :3] = R
            M[:3, 3] = h - R @ h
            G[b] = (g(self.pai[b]) if b in self.pai else np.eye(4)) @ M
            return G[b]
        for b in self.ossos:
            g(b)
        return G

    def posada(self, so=None):
        out = self._posada(so)
        R = getattr(self, 'ante_R', None)
        if R is not None:                                 # punho: o antebraço dobra em torno da cabeça do punho
            c = self.cab['wrist.' + self.lado][0]
            t = np.clip((0.012 - self.t) / 0.032, 0, 1)
            wa = (t * t * (3 - 2 * t))[:, None]
            if so is not None:
                wa = wa * so[:, None]
            out = out + wa * ((out - c) @ R.T + c - out)
        return out

    def _posada(self, so=None):
        G = self.globais()
        Vh = np.c_[self.V, np.ones(len(self.V))]
        out = np.zeros_like(self.V)
        for b, k in self.idx.items():
            w = self.W[:, k]
            m = w > 0 if so is None else (w > 0) & so
            if m.any():
                out[m] += w[m, None] * (Vh[m] @ G[b].T)[:, :3]
        return out

    def ponto(self, b, qual=0):
        """Cabeça (0) ou cauda (1) do osso na pose atual."""
        G = self.globais()
        return (G[b] @ np.r_[self.cab[b][qual], 1])[:3]

    def girar(self, b, eixo, ang):
        """Gira o osso `b` em torno de `eixo` (direção no espaço de repouso da MÃO INTEIRA) pela cabeça."""
        e = np.asarray(eixo, float)
        e = e / np.linalg.norm(e)
        R = np.array(Matrix.Rotation(ang, 3, Vector(e)))
        self.rot[b] = R @ self.rot.get(b, np.eye(3))

    def girar_mundo(self, b, eixo, ang):
        """Gira `b` em torno de `eixo` dado na POSE atual (o do pai já aplicado), pela cabeça."""
        G = self.globais()
        R = G[self.pai[b]][:3, :3] if b in self.pai else np.eye(3)
        self.girar(b, R.T @ np.asarray(eixo, float), ang)

    # -------------------------------------------------------------------------------------------------- medidas
    def quadro(self):
        """Direção dos dedos, lateral (mínimo → indicador), normal da palma (para o lado palmar)."""
        s = '.' + self.lado
        w = self.cab['wrist' + s][0]
        m3 = self.cab['finger3-1' + s][0]
        df = (m3 - w) / np.linalg.norm(m3 - w)
        lat = self.cab['finger2-1' + s][0] - self.cab['finger5-1' + s][0]
        lat -= df * (lat @ df)
        lat /= np.linalg.norm(lat)
        # palma = oposto ao dorso (as normais do anel das unhas apontam para o dorso; o centroide do anel não serve:
        # ele contorna a ponta e deu o sinal trocado na v1, com os dedos dobrando para trás)
        n = np.cross(df, lat)
        if n @ self._dorso > 0:
            n = -n
        return w, df, lat, n

    def comprimento(self):
        w, df, _, _ = self.quadro()
        return float(((self.V - w) @ df).max())
