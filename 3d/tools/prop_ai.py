"""Adereço da vida `ai` ("AI Product Engineer"), volta 1: receita ÚNICA forma + material + provas do robô de mesa
(FICHA-PRODUCAO §1; REQUISITOS, VERSÃO FINAL 3.1: o agente do produto que o Fael constrói, montado peça a peça, que
ganha rosto na tela e vira a cabeça para o produto e para o Fael no handoff).

Headless (fonte de verdade, reprodutível):
    blender -b --python 3d/tools/prop_ai.py -- [glb=3d/export/props/ai.glb]
        [blend=3d/blend/props/ai_v1_modelagem.blend|0] [provas=3d/captura/props/ai/v1/blender|0] [folha=1|0]

glb (espaço do S13: Y para cima, +Z para a câmera, +X = esquerda do Fael; escala do scan = real × 1,2):
  `ai` (EMPTY) → `ai_robo` (EMPTY: centro da base NO PLANO DA MESA; guinada em Y = o corpo de 3/4 para a câmera)
    → `ai_base`, `ai_corpo`, `ai_tampa`, `ai_placa` (malhas; origem no encaixe; só translação)
    → `ai_pescoco` (EMPTY no eixo do servo de giro; gira em Y local) → `ai_suporte` (malha: chifre, suporte, servo
       de inclinação) e `ai_cabeca` (EMPTY no eixo do servo de inclinação; gira em X local) → `ai_moldura`, `ai_tela`
  Repouso do glb = olhar para a câmera (extras `olhar_camera_graus`); ângulos ABSOLUTOS do servo a partir do zero
  mecânico (rotação identidade): pescoço quaternion = Ry(giro), cabeça quaternion = Rx(−inclinação).
Segunda UV `Fade` (TEXCOORD_1.x): 1 acima da mesa, 0 a 30 mm abaixo (só o cabo desce).
"""
import math
import os
import subprocess
import sys

import bpy
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [AQUI, os.path.join(AQUI, 'props')]
import comum  # noqa: E402
import prop_ai_cabeca as H  # noqa: E402
import prop_ai_corpo as K  # noqa: E402
import prop_ai_funcao as F  # noqa: E402
import prop_ai_geo as G  # noqa: E402
import prop_ai_material as MT  # noqa: E402
import prop_financeiro_v6 as v6  # noqa: E402
import prop_vela_base as B  # noqa: E402

ROOT, ARGS = v6.ROOT, v6.ARGS
GLB = os.path.join(ROOT, ARGS.get('glb', '3d/export/props/ai.glb'))
BLEND = ARGS.get('blend', '3d/blend/props/ai_v1_modelagem.blend')
PROVAS = ARGS.get('provas', '3d/captura/props/ai/v1/blender')
TEX = os.path.join(ROOT, '3d/captura/props/ai/v1/blender/texturas')
# Mesa comum: a borda de apoio da prancheta do Solutions Architect como o site a mostra (arq_mesa, largo: pivô y 0,0550,
# mesa_y_glb −0,1103, escala 0,615, desloc y −0,0017 → −0,0484). O notebook do FullStack fica em −0,135 no site (fora
# do quadro no 1440); a do SA é a mesa que se vê.
MESA_Y = -0.0484
POS_XZ = (0.130, 0.060)                      # centro da base no glb: +X = esquerda do Fael (direita da tela)
FADE_RAMPA = 0.030
CABO_DIR_MUNDO = (0.45, -0.89)               # cabo na mesa: para trás e para a direita da tela (longe do busto)


def lista(v, k=4):
    return [round(float(x), k) for x in v]


def vazio(nome, pai=None, loc=(0, 0, 0)):
    o = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(o)
    o.empty_display_size = 0.01
    o.parent = pai
    o.location = G.bl(loc)
    return o


def malha(P, nome_pai, pai, origem, mats):
    ob = P.objeto(origem, mats)
    ob.parent = pai
    ob.location = G.bl(origem) - G.bl(nome_pai)
    return ob


def construir():
    comum.cena_nova()
    busto = B.Busto(comum.importar_busto())
    busto.pose()
    K.C.update(MT.COR)
    rig, m_tampa, m_tela = MT.materiais(TEX)
    sol = F.resolver(POS_XZ, MESA_Y)
    psi = sol['guinada']
    raiz = vazio('ai')
    robo = vazio('ai_robo', raiz, (POS_XZ[0], MESA_Y, POS_XZ[1]))
    robo.rotation_euler = (0, 0, math.radians(psi))
    a = math.radians(-psi)                    # direção do cabo no quadro local
    dx, dz = CABO_DIR_MUNDO
    cabo = (dx * math.cos(a) + dz * math.sin(a), -dx * math.sin(a) + dz * math.cos(a))
    P = {n: G.Pecas(n) for n in ('ai_base', 'ai_corpo', 'ai_tampa', 'ai_placa', 'ai_suporte', 'ai_moldura')}
    K.base(P['ai_base'], K.trajeto_cabo(cabo))
    K.corpo(P['ai_corpo'])
    K.tampa(P['ai_tampa'])
    K.placa(P['ai_placa'])
    H.suporte(P['ai_suporte'])
    H.moldura(P['ai_moldura'])
    zero = (0.0, 0.0, 0.0)
    o_corpo = (0.0, G.R(K.Y_BASE), 0.0)
    o_pesc = (0.0, G.R(K.Y_EIXO_GIRO), 0.0)
    o_cab = (0.0, G.R(H.Y_EIXO_INCL), 0.0)
    obs = {'ai_base': malha(P['ai_base'], zero, robo, zero, [rig]),
           'ai_corpo': malha(P['ai_corpo'], zero, robo, o_corpo, [rig]),
           'ai_tampa': malha(P['ai_tampa'], zero, robo, P['ai_tampa'].pontos['encaixe_tampa'], [rig, m_tampa]),
           'ai_placa': malha(P['ai_placa'], zero, robo, P['ai_placa'].pontos['encaixe_placa'], [rig])}
    pesc = vazio('ai_pescoco', robo, o_pesc)
    obs['ai_suporte'] = malha(P['ai_suporte'], o_pesc, pesc, o_pesc, [rig])
    cab = vazio('ai_cabeca', pesc, np.subtract(o_cab, o_pesc))
    obs['ai_moldura'] = P['ai_moldura'].objeto(zero, [rig])
    obs['ai_moldura'].parent = cab
    tela, centro = H.tela(m_tela)
    tela.parent = cab
    tela.location = G.bl(centro)
    obs['ai_tela'] = tela
    ctx = {'busto': busto, 'P': P, 'obs': obs, 'robo': robo, 'pescoco': pesc, 'cabeca': cab, 'raiz': raiz,
           'sol': sol, 'psi': psi, 'centro_tela_cab': centro}
    F.pose(ctx, *sol['camera'])
    bpy.context.view_layer.update()
    mesa_bl = MESA_Y
    for o in obs.values():
        MT.fade(o, mesa_bl, FADE_RAMPA)
    ctx['objs'] = [raiz, robo, pesc, cab] + list(obs.values())
    return ctx


def extras(ctx, med):
    s, obs = ctx['sol'], ctx['obs']
    raiz, robo, pesc, cab = ctx['raiz'], ctx['robo'], ctx['pescoco'], ctx['cabeca']
    raiz['escala_scan_por_real'] = G.ESC
    raiz['fade'] = {'uv': 'Fade (TEXCOORD_1.x)', 'y_glb': [round(MESA_Y - FADE_RAMPA, 4), MESA_Y],
                    'acima_da_mesa': 1}
    raiz['altura_real_mm'] = round(med['geometria']['altura_real_mm'], 1)
    robo['origem'] = 'centro da base no plano da mesa (sola dos pés)'
    robo['mesa_y_glb'] = MESA_Y
    robo['posicao_sugerida_glb'] = [POS_XZ[0], MESA_Y, POS_XZ[1]]
    robo['guinada_graus'] = round(ctx['psi'], 2)
    robo['mesa_referencia'] = 'mesa do Solutions Architect como o site a mostra (arq_mesa, largo)'
    robo['lado_tampa'] = '+x local do robô (a lateral que a câmera vê)'
    pesc['eixo'] = 'Y local (vertical); servo de giro'
    pesc['giro_graus'] = [-60, 60]
    pesc['olhar_camera_graus'] = lista(s['camera'], 2)
    pesc['olhar_fael_graus'] = lista(s['fael'], 2)
    pesc['convencao'] = '[giro, inclinação] absolutos: pescoco.quaternion = Ry(giro); cabeca.quaternion = Rx(−incl)'
    pesc['alcance_guinada_mundo_graus'] = [round(ctx['psi'] - 60, 1), round(ctx['psi'] + 60, 1)]
    cab['eixo'] = 'X local (horizontal); servo de inclinação; + = tela para cima'
    cab['inclinacao_graus'] = [-15, 30]
    cab['montagem_graus'] = H.INCL_MONTAGEM
    obs['ai_tela']['uv'] = 'UVMap 0–1 = área útil; u 0 = esquerda NA TELA → 1; v 0 = baixo → 1'
    obs['ai_tela']['area_util_mm_real'] = list(H.TELA[:2])
    obs['ai_tela']['origem'] = 'centro da área útil'
    n = ctx['P']['ai_moldura'].pontos['normal_tela']
    obs['ai_tela']['normal_local'] = lista(n)                  # +Z girado 15° para cima (montagem nos vértices)
    for nome, e in med['explodido'].items():
        o = obs.get(nome) or pesc
        o['explodido_m'] = e['explodido_m']
        o['explodido_glb_m'] = e['explodido_glb_m']
        o['ordem_montagem'] = e['ordem']
    for nome, txt in (('ai_base', 'centro da base no plano da mesa'), ('ai_corpo', 'centro do pé do corpo'),
                      ('ai_tampa', 'centro da face de dentro da tampa'), ('ai_placa', 'centro da face de trás'),
                      ('ai_suporte', 'eixo de giro (topo da estria)'), ('ai_moldura', 'eixo de inclinação')):
        obs[nome]['origem'] = txt


def main():
    import prop_ai_medidas as MD
    ctx = construir()
    med = MD.medir(ctx)
    extras(ctx, med)
    comum.exportar_glb(ctx['objs'], GLB, otimizar=False)
    subprocess.run(['node', os.path.join(ROOT, '3d/tools/props/otimizar.mjs'), GLB, '--malha-em-filho'], check=True,
                   cwd=ROOT)
    txt = subprocess.run(['node', os.path.join(ROOT, '3d/tools/props/glb.mjs'), GLB], cwd=ROOT, capture_output=True,
                         text=True).stdout
    print(txt)
    med['glb'] = txt.splitlines()[0] if txt else 'não obtido'
    if BLEND != '0':
        os.makedirs(os.path.dirname(os.path.join(ROOT, BLEND)), exist_ok=True)
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, BLEND))
        print('BLEND', BLEND)
    if PROVAS != '0':
        import prop_ai_prova as prova
        prova.rodar(ctx, med, os.path.join(ROOT, PROVAS))


if __name__ == '__main__':
    main()
