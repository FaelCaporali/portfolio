"""Adereço da vida `uber` ("Uber Driver"), volta 1: receita ÚNICA forma + material (FICHA-PRODUCAO + REQUISITOS U1–U10).

Headless (fonte de verdade, reprodutível):
    blender -b --python 3d/tools/prop_uber.py -- [glb=3d/export/props/uber.glb] [blend=3d/blend/props/uber_v1.blend|0]
        [provas=3d/captura/props/uber/v1/blender|0]

glb (espaço do S13: Y para cima, rosto +Z; direito/esquerdo = do Fael): raiz `uber` →
  `uber_volante` (ORIGEM no centro do aro; +Z local = eixo da coluna para o painel/câmera, +Y = 12 h)
      → `uber_volante_malha`, `uber_mao_esq` → `uber_mao_esq_malha`, `uber_mao_dir` → `uber_mao_dir_malha`
  `uber_lagrima_esq|dir` → `_rastro` (UV v 0 pálpebra → 1 ponta) e `_gota` (centro) → `_gota_malha`
  `uber_celular` → `uber_celular_corpo`, `uber_celular_tela` (UV 0–1)
Segunda UV `Fade` (TEXCOORD_1, u) no volante e nas mãos: 1 = visível, 0 = fundo (punho/antebraço e metade de baixo do
volante somem em degradê, como o pescoço). Expressão da vida: browInnerUp 0,8 (as lágrimas colam na pele triste).
"""
import os
import subprocess
import sys

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [AQUI, os.path.join(AQUI, 'props')]
import comum  # noqa: E402
import prop_financeiro_v6 as v6  # noqa: E402
import prop_uber_celular as CE  # noqa: E402
import prop_uber_lagrima as LG  # noqa: E402
import prop_uber_pega as PG  # noqa: E402
import prop_uber_pele as PL  # noqa: E402
import prop_uber_unha as UN  # noqa: E402
import prop_uber_volante as VO  # noqa: E402
import prop_vela_base as B  # noqa: E402

ROOT, ARGS = v6.ROOT, v6.ARGS
GLB = os.path.join(ROOT, ARGS.get('glb', '3d/export/props/uber.glb'))
BLEND = ARGS.get('blend', '3d/blend/props/uber_v1.blend')
TEX = os.path.join(ROOT, '3d/captura/props/uber/v1/blender/texturas')
TRISTE = dict(browInnerUp=0.8)
FADE_MAO = (-0.012, 0.018)                 # t (m além da prega do punho): 0 → fundo, 1 → visível
FADE_VOLANTE = (-0.046, -0.016)            # altura no glb (y): o aro some logo abaixo das mãos, com coluna e cubo


def vazio(nome, pai=None, mw=None):
    o = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(o)
    if pai is not None:
        o.parent = pai
    if mw is not None:
        o.matrix_world = mw
    return o


def pendurar(filho, pai):
    """Parenta mantendo a posição de mundo, com a inversa embutida na local (o glTF recebe TRS limpo)."""
    bpy.context.view_layer.update()
    mw = filho.matrix_world.copy()
    filho.parent = pai
    filho.matrix_parent_inverse.identity()
    filho.matrix_world = mw


def uv_fade(ob, valores):
    """Segunda UV `Fade`: u = valor por vértice (0..1), v = 0,5."""
    me = ob.data
    lay = me.uv_layers.get('Fade') or me.uv_layers.new(name='Fade')
    for p in me.polygons:
        for li, vi in zip(p.loop_indices, p.vertices):
            lay.data[li].uv = (float(valores[vi]), 0.5)
    me.uv_layers.active = me.uv_layers['UVMap']


def _sm(e0, e1, x):
    t = np.clip((np.asarray(x) - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def construir():
    comum.cena_nova()
    busto = B.Busto(comum.importar_busto())
    busto.pose(**TRISTE)
    rig = VO.material(TEX)
    raiz = vazio('uber')
    raiz['fade'] = {'uv': 'Fade (TEXCOORD_1.x)', 'mao_t': list(FADE_MAO), 'volante_y_glb': list(FADE_VOLANTE)}
    vol = vazio('uber_volante', raiz, VO.matriz())
    vm = VO.construir(rig)
    vm.parent = vol
    bpy.context.view_layer.update()
    uv_fade(vm, _sm(*FADE_VOLANTE, [(vm.matrix_world @ v.co).z for v in vm.data.vertices]))
    objs = [raiz, vol, vm]
    # U2/U3/U5 mãos: pegada por contato no aro, relevo, UV, oclusão, pele da fonte do S13
    dados = []
    for nome in ('esq', 'dir'):
        ob, d = PG.construir(nome, busto=busto)
        n0 = len(ob.data.polygons)
        PG.reduzir(d)
        print('REDUZIR', nome, n0, '→', len(ob.data.polygons), 'faces')
        dados.append(d)
        print('FOLGA_DEDOS_MM', nome, d['folga_mm'])
    obs = [d['ob'] for d in dados]
    PL.uv_maos(obs)
    import bmesh
    bpy.context.view_layer.update()
    bmw = bmesh.new()
    for o in obs + [vm]:
        t = bmesh.new()
        t.from_object(o, bpy.context.evaluated_depsgraph_get())
        t.transform(o.matrix_world)
        me = bpy.data.meshes.new('_oc')
        t.to_mesh(me)
        bmw.from_mesh(me)
        bpy.data.meshes.remove(me)
        t.free()
    bvh = BVHTree.FromBMesh(bmw)
    for d in dados:
        d['ao'] = PL.oclusao(d['ob'], bvh)
    cor, orm, nrm = PL.texturas(dados, busto, TEX)
    pele = PL.material(TEX, cor, orm, nrm)
    unha = UN.material()
    for nome, d in zip(('esq', 'dir'), dados):
        ob = d['ob']
        ob.data.materials.append(pele)
        uv_fade(ob, _sm(*FADE_MAO, d['mao'].t))
        mw = VO.matriz().copy()
        mw.translation = VO.pega(nome)[0]                 # nó no ponto da pegada, eixos do volante
        no = vazio('uber_mao_' + nome, vol, mw)
        pendurar(ob, no)
        un = UN.construir(d, 'uber_mao_%s_unhas' % nome, unha)          # placa própria, material próprio
        uv_fade(un, np.ones(len(un.data.vertices)))
        pendurar(un, no)
        objs += [no, ob, un]
    # U4 lágrimas (na pele triste)
    mats = LG.materiais(TEX)
    for lado in ('esq', 'dir'):
        objs += LG.construir(busto, raiz, lado, mats, vazio)
    # U7 celular (teste)
    cel = vazio('uber_celular', raiz, CE.matriz())
    corpo, tela = CE.construir(rig, CE.material_tela())
    for o in (corpo, tela):
        o.parent = cel
    uv_fade(corpo, np.ones(len(corpo.data.vertices)))
    objs += [cel, corpo, tela]
    bmw.free()
    return busto, objs, dados


def main():
    busto, objs, dados = construir()
    bpy.context.view_layer.update()
    comum.exportar_glb(objs, GLB, otimizar=True)
    print('GLB', GLB, round(os.path.getsize(GLB) / 1024, 1), 'kB')
    subprocess.run(['node', os.path.join(ROOT, '3d/tools/props/glb.mjs'), GLB], cwd=ROOT)
    if BLEND != '0':
        os.makedirs(os.path.dirname(os.path.join(ROOT, BLEND)), exist_ok=True)
        busto.pose()                                      # .blend no neutro
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, BLEND))
        print('BLEND', BLEND)
        busto.pose(**TRISTE)
    if ARGS.get('provas', '0') != '0':
        import prop_uber_prova as prova
        prova.rodar(busto, objs, dados, ARGS['provas'], GLB)


if __name__ == '__main__':
    main()
