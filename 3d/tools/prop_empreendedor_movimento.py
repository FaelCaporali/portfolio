"""Movimento do "Entrepreneur", volta 4 (E13): a composição A com o clip glTF `montagem` bakeado no glb.

Chamado pela receita: blender -b --python 3d/tools/prop_empreendedor.py -- anim=1 [provas=0]
Brief: `.wai/3d/props/empreendedor/FICHA-MOVIMENTO.md`. Saída: `3d/export/props/lab/emp_animado.glb` (Draco).

CONTRATO com o TD (site):
- Um único clip `montagem`, 2,1 s; t do clip = t do relógio da vida (s desde a montagem). O site faz
  `mixer.setTime(min(t, 2.1))` sem tocar sozinho; com movimento reduzido, `setTime(2.1)`.
- O último quadro (t = 2,1) é o estado final = composição A (`empreendedor.glb` de de0f8e3): a malha em repouso É a
  composição A e todo osso termina na identidade. Antes do início de cada peça vale a pose inicial dela.
- Nós na raiz `emp_todos`, como antes: `sup`, `bolo`, `beliche`, `notebook`, `kanban`, `cartoes`, `foguete` (o celular
  esconde `cartoes`, `beliche`, `bolo` pelo nome; tudo que se move é descendente deles).
- Partes que se movem = nós próprios com a origem no pivô (ossos glTF, o que mantém as 13 chamadas de desenho):
  `notebook_tampa`, `bolo_fatia`, `beliche_travesseiro_0/1`, `sup_remo`, `kanban_postit_0..7`, `kanban_postit_mov`,
  `cartoes_0..4`, `foguete_voo` (o foguete inteiro; o nó `foguete` fica parado). Cada peça com ossos ganha
  `<peça>_rig` (armadura) e o osso parado `<peça>_fixo`; as malhas da peça ficam filhas da armadura, com pele.
Aqui só o movimento (curvas e rig); a forma é dos módulos das peças (a fatia nova está em `doces.fatia`).
"""
import math
import os
from collections import defaultdict

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

import prop_empreendedor_cena as cena
import prop_empreendedor_doces as doces
import prop_empreendedor_kanban as KB
import prop_financeiro_v6 as v6

FPS, DUR, CLIP = 30, 2.1, 'montagem'
FIM = round(DUR * FPS)
X, Z = Vector((1, 0, 0)), Vector((0, 0, 1))


# ---- curvas (u ∈ [0, 1]; linear só em máquina) ----
def U(t, t0, t1):
    return min(1.0, max(0.0, (t - t0) / (t1 - t0)))


def e_out(u):                                   # desacelera (chega)
    return 1 - (1 - u) ** 3


def e_inout(u):                                 # acelera e desacelera
    return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2


def e_back(u, s=0.6):                           # easeOut com passagem de 1,25 % que volta amortecida
    return 1 + (s + 1) * (u - 1) ** 3 + s * (u - 1) ** 2


def giro(pivo, eixo, graus):                    # rotação em torno do eixo que passa pelo pivô (espaço da peça)
    R = Quaternion(eixo, math.radians(graus)).to_matrix().to_4x4()
    return Matrix.Translation(pivo) @ R @ Matrix.Translation(-pivo)


def ilhas(me):
    pai = list(range(len(me.vertices)))

    def raiz(i):
        while pai[i] != i:
            pai[i] = pai[pai[i]]
            i = pai[i]
        return i
    for e in me.edges:
        a, b = raiz(e.vertices[0]), raiz(e.vertices[1])
        if a != b:
            pai[a] = b
    g = defaultdict(list)
    for i in range(len(pai)):
        g[raiz(i)].append(i)
    return [(v, sum((me.vertices[i].co for i in v), Vector()) / len(v)) for v in g.values()]


# ---- as partes de cada peça: (osso, {malha: [vértices]}, pivô, D(t) → Matrix, janela (t0, t1)) ----
def notebook(m):
    dob = Vector((0, -0.068 / 2 + 0.0022, 0.0045 + 0.0012))          # eixo da dobradiça (tech.notebook)
    sel = {o: [i for v, c in ilhas(o.data) if c.z > 0.009 for i in v] for o in m.values()}
    return [('notebook_tampa', sel, dob, lambda t: giro(dob, X, -70 * (1 - e_back(U(t, 0.55, 0.95)))), (0.55, 0.95))]


def bolo(m):
    """Fatia (doces.fatia) do vão ao prato: 7 mm para fora, 6° de giro, sem tocar o bolo, r ≤ 36,6 < 37,2 mm."""
    c = Vector((0, -0.018, 0.0314))                                  # centro da base da fatia no vão
    passo, sobe = Vector((0, -0.007, 0.0002)), 0.0015

    def pose(p, g, h=0.0):
        return Matrix.Translation(passo * p + Vector((0, 0, h))) @ giro(c, Z, 6 * g)
    F = pose(1, 1)
    sel = {}
    for o, bm in zip((m['bolo_cobertura'], m['bolo_massa']), doces.fatia()):
        bm.transform(F)
        tmp = bpy.data.meshes.new('fatia_tmp')
        bm.to_mesh(tmp)
        b = bmesh.new()
        b.from_mesh(o.data)
        b.from_mesh(tmp)
        b.to_mesh(o.data)
        bpy.data.meshes.remove(tmp)
        sel[o] = list(range(len(o.data.vertices) - len(bm.verts), len(o.data.vertices)))
        v6.shade(o, 45 if o.name.endswith('cobertura') else 30)
    Fi = F.inverted()

    def D(t):
        u = U(t, 0.60, 1.00)
        return pose(e_out(u), e_inout(u), sobe * math.sin(math.pi * u)) @ Fi
    return [('bolo_fatia', sel, F @ c, D, (0.60, 1.00))]


def beliche(m):
    o, out = m['beliche_tecido'], []
    ils = ilhas(o.data)
    for i, zc in enumerate((0.021 + 0.0122, 0.063 + 0.0122)):       # travesseiros (hostel.beliche)
        alvo = Vector((-0.060 + 0.0058 + 0.013, 0, zc))
        v = min(ils, key=lambda il: (il[1] - alvo).length)
        assert (v[1] - alvo).length < 0.002, 'travesseiro %d não achado' % i
        pv, t0 = alvo - Vector((0, 0, 0.0031)), 0.70 + 0.08 * i

        def D(t, pv=pv, t0=t0):
            u = U(t, t0, t0 + 0.27)
            h = 0.018 * (1 - (u / 0.7) ** 2) if u < 0.7 else 0.0006 * math.sin(math.pi * (u - 0.7) / 0.3)
            return Matrix.Translation((0, 0, h)) @ giro(pv, X, 9 * (1 - e_inout(u)))
        out.append(('beliche_travesseiro_%d' % i, {o: v[0]}, pv, D, (t0, t0 + 0.27)))
    return out


def sup(m):
    o = m['sup_casco']
    P0, eixo = Vector((-(0.047 / 2 + 0.0105), -0.009, 0.0)), Vector((0.13, 0.05, 1)).normalized()   # sup.remo
    sel = [i for v, c in ilhas(o.data) if c.x < -0.028 and (c - P0).cross(eixo).length < 0.005 for i in v]
    q0 = eixo.rotation_difference(Z)                                  # em pé

    def D(t):
        u = U(t, 0.75, 1.10)                                           # tomba acelerando, bate e assenta
        f = (u / 0.8) ** 2 if u < 0.8 else 1 - 0.07 * math.sin(math.pi * (u - 0.8) / 0.2)
        R = q0.slerp(Quaternion(), f).to_matrix().to_4x4()
        return Matrix.Translation(P0) @ R @ Matrix.Translation(-P0)
    return [('sup_remo', {o: sel}, P0, D, (0.75, 1.10))]


def kanban(m):
    o, out = m['kanban_papel'], []
    vs, n = o.data.vertices, len(o.data.vertices)
    frente = (KB.INCL.to_3x3() @ Vector((0, -1, 0))).normalized()
    base0 = n - 20 * (len(KB.POSTITS) + 1)                             # post-its: as últimas folhas 4 × 5
    for i in range(len(KB.POSTITS) + 1):
        idx = list(range(base0 + 20 * i, base0 + 20 * (i + 1)))
        topo = [vs[j].co for j in idx[:4]]
        pv, eixo = sum(topo, Vector()) / 4, (topo[3] - topo[0]).normalized()
        pe = sum((vs[j].co for j in idx[16:]), Vector()) / 4
        s = 1 if (giro(pv, eixo, 30) @ pe).y < (giro(pv, eixo, -30) @ pe).y else -1   # a base levanta para a câmera
        if i < len(KB.POSTITS):
            t0 = 0.95 + 0.06 * i

            def D(t, pv=pv, eixo=eixo, s=s, t0=t0):
                u = U(t, t0, t0 + 0.23)                                # chega descolado e COLA (a base bate depois)
                return Matrix.Translation(frente * 0.003 * (1 - e_out(min(1, 1.4 * u)))) @ \
                    giro(pv, eixo, s * 50 * (1 - e_inout(u)))
            out.append(('kanban_postit_%d' % i, {o: idx}, pv, D, (t0, t0 + 0.23)))
        else:
            dx = KB.COL[1] - (KB.LINHAS[1] + 0.0012)                   # de "fazendo" para "feito"
            cima = KB.INCL.to_3x3() @ Z

            def D(t, pv=pv, eixo=eixo, s=s):
                u = U(t, 1.60, 1.95)
                v = X * dx * (1 - e_inout(u)) + cima * 0.0008 * math.sin(math.pi * u) + \
                    frente * 0.001 * (1 - e_out(U(u, 0.6, 1.0)))
                return Matrix.Translation(v) @ giro(pv, eixo, s * 15 * (1 - e_inout(U(u, 0.55, 1.0))))
            out.append(('kanban_postit_mov', {o: idx}, pv, D, (1.60, 1.95)))
    return out


def cartoes(m):
    o = m['cartoes_leque']
    P = Vector(o.pop('pivo'))
    n = len(o.data.vertices) // 5
    assert n * 5 == len(o.data.vertices)
    Ri = Matrix.Rotation(math.radians(-12), 4, 'X')                    # cartoes.INCLINA
    eixo = (Ri.to_3x3() @ Vector((0, -1, 0))).normalized()             # normal do plano do leque
    out = []
    for k in range(5):
        t0, a = 1.05 + 0.05 * k, (4 - k) * 12.0                        # fechado = todos no ângulo do da frente

        def D(t, t0=t0, a=a):
            return giro(P, eixo, a * (1 - e_back(U(t, t0, t0 + 0.30))))
        out.append(('cartoes_%d' % k, {o: list(range(k * n, (k + 1) * n))}, P, D, (t0, t0 + 0.30)))
    return out


def foguete_D(t):
    """Escala ~0 até 1,2 s; de 1,20 a 1,70 cresce e sobe junto (a base sai da borda de cima da tampa, 20 mm abaixo →
    0), quase vertical, com giro lateral residual ≤ 8° que amortece a zero em 2,1 s."""
    u = e_out(U(t, 1.20, 1.70))                    # volta 4b (orquestrador): cresce JUNTO com a subida, quase vertical
    w = 8.0 * math.cos(2 * math.pi * (t - 1.20) / 0.7) * (1 - U(t, 1.20, 2.10)) ** 2    # giro residual ≤ 8°
    return Matrix.Translation((0, 0, -0.02 * (1 - u))) @ Matrix.Rotation(math.radians(w), 4, 'Y') @ \
        Matrix.Scale(max(0.001, u), 4)


def foguete(m):                                 # volta 4c: osso `foguete_voo` (o nó `foguete` fica parado)
    return [('foguete_voo', {o: list(range(len(o.data.vertices))) for o in m.values()}, Vector(), foguete_D,
             (1.20, 2.10))]


PARTES = {'notebook': notebook, 'bolo': bolo, 'beliche': beliche, 'sup': sup, 'kanban': kanban, 'cartoes': cartoes,
          'foguete': foguete}


def rigar(raiz, partes):
    arm = bpy.data.armatures.new(raiz.name + '_rig')
    ob = bpy.data.objects.new(raiz.name + '_rig', arm)
    raiz.users_collection[0].objects.link(ob)
    ob.parent = raiz
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    for nome, _, pv, _, _ in [(raiz.name + '_fixo', None, Vector(), None, None)] + partes:
        eb = arm.edit_bones.new(nome)
        eb.head, eb.tail, eb.roll = pv, pv + Vector((0, 0, 0.01)), 0.0
    bpy.ops.object.mode_set(mode='OBJECT')
    for me in [c for c in raiz.children if c.type == 'MESH']:
        usados = set()
        for nome, sel, _, _, _ in partes:
            if sel.get(me):
                me.vertex_groups.new(name=nome).add(sel[me], 1.0, 'REPLACE')
                usados |= set(sel[me])
        resto = [i for i in range(len(me.data.vertices)) if i not in usados]
        me.vertex_groups.new(name=raiz.name + '_fixo').add(resto, 1.0, 'REPLACE')
        me.parent = ob
        md = me.modifiers.new('Esqueleto', 'ARMATURE')
        md.object = ob
        me.modifiers.move(len(me.modifiers) - 1, 0)
    return ob


def animar(pecas):
    sc = bpy.context.scene
    sc.render.fps, sc.frame_start, sc.frame_end = FPS, 0, FIM
    ossos = {}
    for cid, fn in PARTES.items():
        raiz = pecas[cid]['raiz']
        partes = fn({o.name: o for o in pecas[cid]['objs']})
        arm = rigar(raiz, partes)
        for nome, _, _, D, (t0, t1) in partes:
            pb, rest = arm.pose.bones[nome], arm.data.bones[nome].matrix_local
            for f in range(math.floor(t0 * FPS), min(FIM, math.ceil(t1 * FPS)) + 1):
                pb.matrix = D(f / FPS) @ rest
                for p in ('location', 'rotation_quaternion', 'scale'):
                    pb.keyframe_insert(p, frame=f, group=nome)
            ossos[nome] = (cid, t0, t1)
        _nla(arm)
    bpy.context.scene.frame_set(FIM)               # o exportador grava o repouso dos nós no quadro corrente: o final
    return ossos


def _nla(ob):
    ad = ob.animation_data
    tr = ad.nla_tracks.new()
    tr.name = CLIP
    tr.strips.new(CLIP, int(ad.action.frame_range[0]), ad.action)
    ad.action = None


def exportar(raiz_t, saida, draco=True):
    objs = [raiz_t] + list(raiz_t.children_recursive)
    for o in bpy.context.scene.objects:
        o.select_set(o in set(objs))
    bpy.ops.export_scene.gltf(
        filepath=saida, export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_extras=True,
        export_cameras=False, export_lights=False, export_draco_mesh_compression_enable=draco,
        export_draco_mesh_compression_level=6, export_draco_position_quantization=14,
        export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True,
        export_optimize_animation_size=True, export_optimize_animation_keep_anim_armature=False,
        export_skins=True, export_def_bones=False, export_frame_range=False)
    return saida


def rodar(construir, tris, pasta_glb, com_provas=True):
    v6.reset()
    if bpy.context.scene.world is None:
        bpy.context.scene.world = bpy.data.worlds.new('Mundo')
    raiz_t, pecas = cena.montar('a', construir)
    ossos = animar(pecas)
    arq = exportar(raiz_t, os.path.join(pasta_glb, 'emp_animado.glb'))
    cru = exportar(raiz_t, '/data/tmp/emp_animado_sem_draco.glb', draco=False)
    malhas = [o for p in pecas.values() for o in p['objs']]
    orc = {'glb': os.path.relpath(arq, v6.ROOT), 'kB': round(os.path.getsize(arq) / 1024, 1),
           'kB_sem_draco': round(os.path.getsize(cru) / 1024, 1), 'tris': tris(malhas),
           'chamadas': sum(len(o.data.materials) for o in malhas), 'ossos': sorted(ossos)}
    print('ORCAMENTO', orc)
    import prop_empreendedor_movimento_prova as prova
    prova.prova_json(arq)                          # volta 4c: última chave de cada canal == repouso do nó (JSON)
    if com_provas:
        prova.rodar(pecas, raiz_t, arq, orc, ossos)
