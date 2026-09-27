"""Adereço da vida `fullstack` ("FullStack Dev"), volta 1: receita ÚNICA forma + material (FICHA-PRODUCAO, FECHAMENTO;
REQUISITOS F1–F9). Notebook de 14" genérico aberto na frente do Fael, costas da tampa para a câmera, com os 12 adesivos
de vinil das stacks dele (tamanho, posição e desgaste = nível).

Headless (fonte de verdade, reprodutível):
    blender -b --python 3d/tools/prop_fullstack.py -- [glb=3d/export/props/fullstack.glb]
        [blend=3d/blend/props/fullstack_v1.blend|0] [provas=3d/captura/props/fullstack/v1/blender|0]

glb (espaço do S13: Y para cima, +Z para a câmera, +X = esquerda do Fael): raiz `fullstack` →
  `fs_notebook` (ORIGEM no centro da borda de cima da tampa, eixos do glb)
      → `fs_notebook_tampa` (origem no eixo da dobradiça; +Y ao longo da tampa, +Z = costas): fs_rigido + fs_tela
      → `fs_notebook_base` (origem no eixo da dobradiça, eixos do glb), fs_rigido
      → `fs_notebook_tela` (EMPTY no centro da área ativa, −Z local para o rosto: a luz do site)
      → `fs_adesivos` (EMPTY nas costas, centro da borda de cima) → `fs_adesivos_malha` (malha única dos 12, material
        fs_vinil com atlas, 1 chamada) e `fs_adesivo_<slug>` (EMPTY no centro de cada adesivo, extras nivel/lado_cm)
Segunda UV `Fade` (TEXCOORD_1.x): 1 visível → 0 no fundo, pela altura no glb (tampa e base); adesivos = 1.
"""
import os
import subprocess
import sys

import bpy
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [AQUI, os.path.join(AQUI, 'props')]
import comum  # noqa: E402
import prop_financeiro_v6 as v6  # noqa: E402
import prop_fullstack_adesivos as AD  # noqa: E402
import prop_fullstack_notebook as NB  # noqa: E402
import prop_vela_base as B  # noqa: E402

ROOT, ARGS = v6.ROOT, v6.ARGS
GLB = os.path.join(ROOT, ARGS.get('glb', '3d/export/props/fullstack.glb'))
BLEND = ARGS.get('blend', '3d/blend/props/fullstack_v1.blend')
TEX = os.path.join(ROOT, '3d/captura/props/fullstack/v1/blender/texturas')
FADE_Y = (-0.050, -0.034)                   # altura no glb: 0 abaixo de −0,050, 1 acima de −0,034 (adesivos acima)
PY_CV = '/data/venv-face/bin/python'


def vazio(nome, pai=None, mw=None):
    o = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(o)
    o.empty_display_size = 0.01
    if pai is not None:
        o.parent = pai
    if mw is not None:
        bpy.context.view_layer.update()
        o.matrix_world = mw
    return o


def pendurar(filho, pai):
    """Parenta mantendo a posição de mundo, com a inversa embutida na local (o glTF recebe TRS limpo)."""
    bpy.context.view_layer.update()
    mw = filho.matrix_world.copy()
    filho.parent = pai
    filho.matrix_parent_inverse.identity()
    filho.matrix_world = mw


def fade_por_altura(ob):
    """UV `Fade`: x = suave(altura no glb), y = 0,5."""
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    y = np.array([(mw @ v.co).z for v in ob.data.vertices])
    t = np.clip((y - FADE_Y[0]) / (FADE_Y[1] - FADE_Y[0]), 0, 1)
    f = t * t * (3 - 2 * t)
    me = ob.data
    lay = me.uv_layers.get('Fade') or me.uv_layers.new(name='Fade')
    for p in me.polygons:
        for li, vi in zip(p.loop_indices, p.vertices):
            lay.data[li].uv = (float(f[vi]), 0.5)
    me.uv_layers.active = me.uv_layers['UVMap']


def construir():
    comum.cena_nova()
    busto = B.Busto(comum.importar_busto())
    busto.pose()
    subprocess.run([PY_CV, os.path.join(AQUI, 'prop_fullstack_logos.py'), TEX], check=True, cwd=ROOT)
    import json
    with open(os.path.join(TEX, 'adesivos.json'), encoding='utf-8') as f:
        dados = json.load(f)
    rigido, tela = NB.material(TEX), NB.material_tela()
    raiz = vazio('fullstack')
    raiz['fade'] = {'uv': 'Fade (TEXCOORD_1.x)', 'y_glb': list(FADE_Y), 'adesivos': 'x = 1; y = índice / 11'}
    raiz['escala_scan_por_real'] = NB.ESC
    raiz['abertura_graus'] = NB.ABERTURA
    nb = vazio('fs_notebook', raiz, NB.para_bl(NB.m_gl('topo')))
    tampa = NB.construir_tampa(rigido, tela)
    base = NB.construir_base(rigido)
    tampa.matrix_world = NB.para_bl(NB.m_gl('tampa'))
    base.matrix_world = NB.para_bl(NB.m_gl('base'))
    for o in (tampa, base):
        pendurar(o, nb)
        fade_por_altura(o)
    luz = vazio('fs_notebook_tela', nb, NB.para_bl(NB.m_gl('tela')))
    luz['luz'] = 'centro da área ativa; −Z local aponta para o rosto'
    # `fs_adesivos` é EMPTY: a quantização do otimizar.mjs não aceita malha em nó com filhos (criaria um nó sem nome)
    ad = vazio('fs_adesivos', nb, NB.para_bl(NB.m_gl('adesivos')))
    malha, med = AD.construir(dados, AD.material(TEX))
    malha.matrix_world = NB.para_bl(NB.m_gl('adesivos'))
    pendurar(malha, ad)
    filhos = [malha] + AD.vazios(dados, vazio)
    for e in filhos[1:]:
        pendurar(e, ad)
    objs = [raiz, nb, tampa, base, luz, ad] + filhos
    return busto, objs, dados, med


def main():
    busto, objs, dados, med = construir()
    bpy.context.view_layer.update()
    comum.exportar_glb(objs, GLB, otimizar=True)
    print('GLB', GLB, round(os.path.getsize(GLB) / 1024, 1), 'kB')
    subprocess.run(['node', os.path.join(ROOT, '3d/tools/props/glb.mjs'), GLB], cwd=ROOT)
    if BLEND != '0':
        os.makedirs(os.path.dirname(os.path.join(ROOT, BLEND)), exist_ok=True)
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, BLEND))
        print('BLEND', BLEND)
    print('SOBREPOSICAO', med['sobreposicao_mm2_scan'], 'CAMADAS', med['camada'])
    if ARGS.get('provas', '0') != '0':
        import prop_fullstack_prova as prova
        prova.rodar(busto, objs, dados, med, ARGS['provas'], GLB, FADE_Y)


if __name__ == '__main__':
    main()
