"""Adereço da vida `devops` ("Solutions Architect"), volta 1: receita ÚNICA forma + material da FRENTE (FICHA-PRODUCAO,
FECHAMENTO; REQUISITOS D1–D16). Prancheta portátil de arquiteto na mesa, na frente do rosto, de frente para a câmera:
tampo de madeira clara inclinado, régua paralela de alumínio com cabos de aço, folha de planta azul presa com fita crepe
nos cantos, escalímetro e lapiseira apoiados. A planta (monólito → serviços) é desenho de CANVAS do site na UV da folha.

Headless (fonte de verdade, reprodutível):
    blender -b --python 3d/tools/prop_devops.py -- [glb=3d/export/props/devops.glb]
        [blend=3d/blend/props/devops_v1_modelagem.blend|0] [provas=3d/captura/props/devops/v1/blender|0] [rapido=1]

glb (espaço do S13: Y para cima, +Z para a câmera, +X = esquerda do Fael): raiz `devops` →
  `arq_prancheta` (EMPTY; ORIGEM no centro da borda de cima da folha, eixos do glb; extras: mesa, inclinação, medidas)
      → `arq_tampo` (malha, arq_rigido: tampo, perfil de pé, cabos, esticadores, cavalete, fitas crepe)
      → `arq_folha` (malha, arq_papel azul-blueprint; UVMap 0–1 = a folha inteira: u → direita da tela, v = 1 em cima)
      → `arq_regua` (malha, arq_rigido: régua paralela + lapiseira na calha; origem na borda de trabalho, desliza em
        Y local; extras: curso)
      → `arq_escalimetro` (malha, arq_rigido: escalímetro de bolso; origem na ponta de baixo, apoiada na régua)
  Os quatro filhos têm o quadro do tampo: +X = glb X, +Y = subindo o tampo (para o Fael), +Z = normal da folha.
Segunda UV `Fade` (TEXCOORD_1.x): 1 visível → 0 no fundo, pela altura no glb; a folha inteira (e as fitas) em 1.
"""
import os
import subprocess
import sys

import bpy
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [AQUI, os.path.join(AQUI, 'props')]
import comum  # noqa: E402
import prop_devops_material as MT  # noqa: E402
import prop_devops_prancheta as P  # noqa: E402
import prop_devops_regua as RG  # noqa: E402
import prop_financeiro_v6 as v6  # noqa: E402
import prop_vela_base as B  # noqa: E402

ROOT, ARGS = v6.ROOT, v6.ARGS
GLB = os.path.join(ROOT, ARGS.get('glb', '3d/export/props/devops.glb'))
BLEND = ARGS.get('blend', '3d/blend/props/devops_v1_modelagem.blend')
TEX = os.path.join(ROOT, '3d/captura/props/devops/v1/blender/texturas')
FADE_RAMPA = 0.030                           # m do glb entre Fade 1 (logo abaixo da folha) e Fade 0


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


def y_glb(ob):
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    return np.array([(mw @ v.co).z for v in ob.data.vertices])


def faixa_fade(folha):
    """(y0, y1) no glb: 1 acima de y1 = 2 mm abaixo do ponto mais baixo da folha e das fitas (a fita de baixo desce
    ~16 mm além do canto, medido no plano); 0 abaixo de y0."""
    y1 = min(y_glb(folha).min(), P.glb((0, -P.R(P.FOLHA_MM[1] + 18), 0)).y) - 0.002
    return (y1 - FADE_RAMPA, y1)


def fade_por_altura(ob, faixa):
    y = y_glb(ob)
    t = np.clip((y - faixa[0]) / (faixa[1] - faixa[0]), 0, 1)
    f = t * t * (3 - 2 * t)
    me = ob.data
    lay = me.uv_layers.get('Fade') or me.uv_layers.new(name='Fade')
    for p in me.polygons:
        for li, vi in zip(p.loop_indices, p.vertices):
            lay.data[li].uv = (float(f[vi]), 0.5)
    me.uv_layers.active = me.uv_layers['UVMap']
    return f


def construir():
    comum.cena_nova()
    busto = B.Busto(comum.importar_busto())
    busto.pose()
    rig, papel = MT.materiais(TEX)
    raiz = vazio('devops')
    pr = vazio('arq_prancheta', raiz, P.para_bl(P.m_gl('prancheta')))
    tampo = P.construir_tampo(rig)
    esc = RG.construir_escalimetro(rig)
    folha = P.construir_folha(papel)
    regua = RG.construir_regua(rig)
    for o, q in ((tampo, 'quadro'), (folha, 'quadro'), (regua, 'regua'), (esc, 'escalimetro')):
        o.matrix_world = P.para_bl(P.m_gl(q))
        pendurar(o, pr)
    faixa = faixa_fade(folha)
    fades = {o.name: fade_por_altura(o, faixa) for o in (tampo, folha, regua, esc)}
    assert fades['arq_folha'].min() >= 0.999, 'folha fora da faixa Fade = 1'
    raiz['fade'] = {'uv': 'Fade (TEXCOORD_1.x)', 'y_glb': [round(v, 4) for v in faixa], 'folha': 1}
    raiz['escala_scan_por_real'] = P.ESC
    pr['origem'] = 'centro da borda de cima da folha (face do papel)'
    pr['inclinacao_graus'] = P.INCL
    pr['mesa_y_glb'] = round(P.y_mesa(), 4)
    pr['folha_mm_real'] = list(P.FOLHA_MM)
    pr['folha_scan_m'] = [round(P.R(v), 4) for v in P.FOLHA_MM]
    pr['tampo_mm_real'] = list(P.TAMPO_MM)
    pr['quadro'] = '+X glb X; +Y sobe o tampo (para o Fael); +Z normal da folha'
    folha['uv'] = 'UVMap 0–1: u 0 = borda esquerda na tela (−X) → 1; v 1 = borda de cima (origem) → 0'
    curso = (P.R(-162.0 - P.REGUA_Y_MM), P.R(19.0 - P.REGUA_Y_MM))
    regua['desliza'] = 'eixo Y local (sobe/desce o tampo); a lapiseira vai junto; para subir, o escalímetro sobe junto'
    regua['curso_y_m'] = [round(v, 4) for v in curso]
    esc['apoio'] = 'ponta de baixo na cabeça direita da régua; acompanha a régua em Y local'
    objs = [raiz, pr, tampo, folha, regua, esc]
    return busto, objs, faixa


def main():
    busto, objs, faixa = construir()
    bpy.context.view_layer.update()
    comum.exportar_glb(objs, GLB, otimizar=True)
    print('GLB', GLB, round(os.path.getsize(GLB) / 1024, 1), 'kB')
    subprocess.run(['node', os.path.join(ROOT, '3d/tools/props/glb.mjs'), GLB], cwd=ROOT)
    if BLEND != '0':
        os.makedirs(os.path.dirname(os.path.join(ROOT, BLEND)), exist_ok=True)
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, BLEND))
        print('BLEND', BLEND)
    if ARGS.get('provas', '0') != '0':
        import prop_devops_prova as prova
        prova.rodar(busto, objs, ARGS['provas'], GLB, faixa)


if __name__ == '__main__':
    main()
