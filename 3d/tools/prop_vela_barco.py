"""Ferramentas comuns dos dois barcos (Laser e Optimist) da vida `vela`.

Espaço local de cada barco em METROS REAIS (a escala S entra no fim, em `finalizar`): X para a proa, Y para bombordo,
Z para cima, origem no centro de giro do casco (linha d'água, na bolina). O nó do aparelho (retranca/vela) tem origem
no EIXO DO MASTRO, na altura da garlindéu, e gira em torno de Z (contrato do ADENDO 1).
Estado exportado = o FINAL da virada de bordo: amuras a bombordo, vento de través-proa por bombordo, vela e retranca
a boreste (−Y), adernado para boreste. A chave de forma `bordo` (0 → 1) leva o bojo da vela para o outro bordo, para o
estado inicial da virada (o site anima: rumo ψ, adernamento φ, retranca δ e `bordo`, ver LOG).
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

import prop_vela_base as B
import prop_empreendedor_base as EB


def casco_estacoes(bm, xs, anel, fechar_popa=True, fechar_proa=False):
    """Casco por estações: anel(x) → lista de pontos (mesmo número em todas). Liga anéis vizinhos em quads; tampa a
    popa (espelho) e, se pedido, a proa (Optimist). Devolve (faces, anéis de vértices)."""
    aneis = [[bm.verts.new(p) for p in anel(x)] for x in xs]
    n = len(aneis[0])
    faces = []
    for A, C in zip(aneis, aneis[1:]):
        for k in range(n - 1):
            faces.append(bm.faces.new((A[k], A[k + 1], C[k + 1], C[k])))
    if fechar_popa:
        faces.append(bm.faces.new(aneis[0]))
    if fechar_proa:
        faces.append(bm.faces.new(list(reversed(aneis[-1]))))
    return faces, aneis


def perfil_foil(corda, esp, n=10):
    """Seção NACA 00xx aproximada (x 0..corda, ±y): contorno fechado."""
    topo = []
    for i in range(n + 1):
        x = (1 - math.cos(math.pi * i / n)) / 2
        y = 5 * esp * (0.2969 * math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1036 * x ** 4)
        topo.append((x * corda, y * corda))
    return topo + [(x, -y) for x, y in reversed(topo[1:-1])]


def lamina(bm, corda, envergadura, esp, lugar, afina=0.75, ponta=0.35):
    """Lâmina (bolina/leme) com seção de perfil, afinando para a ponta e ponta arredondada; lugar(p) com p em
    (x ao longo da corda, y espessura, z de 0 no topo a −envergadura)."""
    sec = perfil_foil(1.0, esp)
    nz = 8
    aneis = []
    for j in range(nz + 1):
        t = j / nz
        c = corda * (1 - (1 - afina) * t)
        if t > 1 - ponta * 0.3:
            c *= math.sqrt(max(0.05, 1 - ((t - (1 - ponta * 0.3)) / (ponta * 0.3)) ** 2))
        aneis.append([bm.verts.new(lugar(Vector((x * c - c * 0.3, y * c, -t * envergadura)))) for x, y in sec])
    faces = []
    m = len(sec)
    for A, C in zip(aneis, aneis[1:]):
        for k in range(m):
            faces.append(bm.faces.new((A[k], A[(k + 1) % m], C[(k + 1) % m], C[k])))
    faces.append(bm.faces.new(aneis[0]))
    faces.append(bm.faces.new(list(reversed(aneis[-1]))))
    return faces


def tubo(bm, pts, raio, seg=8):
    return B.tubo_pts(bm, pts, raio, seg)


def cabo(bm, a, b, raio, seca=0.0, n=6):
    """Cabo reto (ou com leve catenária `seca`) de a até b."""
    a, b = Vector(a), Vector(b)
    pts = [a + (b - a) * (i / n) - Vector((0, 0, seca * math.sin(math.pi * i / n))) for i in range(n + 1)]
    return B.tubo_pts(bm, pts, raio, 6)


def vela(bm, luff, leech, nc, nh, bojo, torcao, uv_ilha, lado=-1.0, pos_bojo=0.42):
    """Vela como grade (corda c × altura h) do gurutil luff(h) à valuma leech(h), com bojo (fração da corda, por h)
    para o `lado` (±Y local do aparelho) e torção (rad, por h) em torno do gurutil. Devolve (faces, vértices em
    grade, função que dá a posição com o bojo do outro lado) para a chave `bordo`."""
    u0, v0, u1, v1 = uv_ilha

    def ponto(c, h, sinal):
        L, E = luff(h), leech(h)
        corda = E - L
        tw = Matrix.Rotation(torcao(h) * sinal, 4, 'Z')
        corda = tw @ corda
        nrm = Vector((0, 0, 1)).cross(corda).normalized()      # horizontal, perpendicular à corda
        if nrm.y * lado < 0:
            nrm = -nrm                                           # aponta para o lado do bojo
        prof = bojo(h) * corda.length * (math.sin(math.pi * c ** (math.log(0.5) / math.log(pos_bojo))))
        return L + corda * c + nrm * prof * sinal

    P = [[ponto(i / nc, j / nh, 1.0) for j in range(nh + 1)] for i in range(nc + 1)]
    Q = [[ponto(i / nc, j / nh, -1.0) for j in range(nh + 1)] for i in range(nc + 1)]
    faces = B.grade(bm, P, uv=lambda i, j: (u0 + (u1 - u0) * i / nc, v0 + (v1 - v0) * j / nh))
    return faces, P, Q


def objeto_aparelho(nome, bm_rigido, bm_vela, mat_rigido, mat_vela, chave=None):
    """Um objeto com duas primitivas (rígido + vela) e, se `chave` = lista (vértice da vela → posição no outro
    bordo), a chave de forma `bordo`."""
    n_rig = len(bm_rigido.verts)
    me = bpy.data.meshes.new('_v')
    EB.pintar(bm_vela, bm_vela.faces, '#ffffff')          # cor por vértice neutra (o glTF pode levar COLOR_0)
    bm_vela.to_mesh(me)
    for p in me.polygons:
        p.material_index = 1
    bm_rigido.faces.ensure_lookup_table()
    bm_rigido.from_mesh(me)
    bpy.data.meshes.remove(me)
    bm_vela.free()
    bmesh.ops.recalc_face_normals(bm_rigido, faces=[f for f in bm_rigido.faces if f.material_index == 0])
    obj = B.objeto(nome, bm_rigido, mat_rigido, ang=45)
    obj.data.materials.append(mat_vela)
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_apply(modifier='Normais')      # antes das chaves (glTF não aplica com chave)
    if chave:
        obj.shape_key_add(name='Basis')
        k = obj.shape_key_add(name='bordo')
        for i, p in chave.items():
            k.data[n_rig + i].co = p
    return obj


def finalizar(obj, S, origem_local=Vector()):
    """Escala a malha (e as chaves) por S em torno de `origem_local` (m reais) e deixa a origem do objeto ali."""
    M = Matrix.Scale(S, 4) @ Matrix.Translation(-origem_local)
    obj.data.transform(M)                      # só os vértices (medido: as chaves ficam; transformadas abaixo)
    if obj.data.shape_keys:
        for kb in obj.data.shape_keys.key_blocks:
            for d in kb.data:
                d.co = M @ d.co
        kb = obj.data.shape_keys.key_blocks[0]
        assert (kb.data[0].co - obj.data.vertices[0].co).length < 1e-7, 'chaves fora da malha'
    obj.data.update()
    return obj


def pintar_reg(bm, faces, cor, reg, escala=6.0):
    EB.pintar(bm, faces, cor)
    B.uv_reg(bm, faces, reg, escala)
    return faces
