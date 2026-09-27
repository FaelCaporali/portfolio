"""Adereço da vida `techlead` ("Tech Lead"), volta 1: receita ÚNICA forma + material + provas do headset de call
vestível no busto S13 (FICHA-PRODUCAO, FECHAMENTO, "Frente (glb, modelador)"; REQUISITOS T1–T6).

Headless (fonte de verdade, reprodutível):
    blender -b --python 3d/tools/prop_techlead.py -- [glb=3d/export/props/techlead.glb]
        [blend=3d/blend/props/techlead_v1_modelagem.blend|0] [provas=3d/captura/props/techlead/v1/blender|0]

glb (espaço do S13: Y para cima, +Z para a câmera, +X = esquerda do Fael; escala do scan = real × 1,2):
  `techlead` (EMPTY, raiz) → `tl_headset` (EMPTY, só translação; ORIGEM no ponto médio entre os centros das conchas =
  as articulações do garfo) →
    `tl_arco` (aço escovado + almofada de couro + marcas do ajuste; origem no ápice)
    `tl_concha_d`, `tl_concha_e` (almofada, casco, garfo, pinos, deslizador; origem na articulação do garfo)
    `tl_haste` (cubo giratório + braço + haste flexível; ORIGEM no pivô = centro da tampa da concha E; gira em volta do
      eixo da concha, extra `eixo_giro_glb`)
    `tl_mic` (colar + espuma; origem no centro da espuma)
    `tl_led` (anel de LED no chanfro da concha E; malha e material próprios; origem no centro do anel)
    `tl_cabo` (alívio + cabo atrás do pescoço; malha própria para o neckFade; origem na saída da concha)
Todos os filhos só com translação (eixos do glb). Sem 2º UV: o site só lê `uv1` para o degradê se ele existir.
"""
import os
import subprocess
import sys

import bpy
from mathutils import Matrix

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [AQUI, os.path.join(AQUI, 'props')]
import comum  # noqa: E402
import prop_financeiro_v6 as v6  # noqa: E402
import prop_techlead_arco as A  # noqa: E402
import prop_techlead_concha as C  # noqa: E402
import prop_techlead_encaixe as E  # noqa: E402
import prop_techlead_geo as G  # noqa: E402
import prop_techlead_haste as H  # noqa: E402
import prop_techlead_material as MT  # noqa: E402
import prop_vela_base as B  # noqa: E402

ROOT, ARGS = v6.ROOT, v6.ARGS
GLB = os.path.join(ROOT, ARGS.get('glb', '3d/export/props/techlead.glb'))
BLEND = ARGS.get('blend', '3d/blend/props/techlead_v1_modelagem.blend')
PROVAS = ARGS.get('provas', '3d/captura/props/techlead/v1/blender')
TEX = os.path.join(ROOT, '3d/captura/props/techlead/v1/blender/texturas')


def lista(v, k=4):
    return [round(float(x), k) for x in v]


def vazio(nome, origem, pai=None, po=(0, 0, 0)):
    o = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(o)
    o.empty_display_size = 0.01
    pendurar(o, origem, pai, po)
    return o


def pendurar(o, origem, pai, po):
    """Filho só com translação: local = origem − origem do pai (no Blender), sem inversa."""
    o.parent = pai
    o.matrix_parent_inverse.identity()
    o.location = G.bl(origem) - G.bl(po)


def construir():
    comum.cena_nova()
    busto = B.Busto(comum.importar_busto())
    busto.pose()
    enc = E.Encaixe(busto)
    mats = MT.materiais(TEX)
    rel = {}
    q = {s: enc.copa(s) for s in (-1, 1)}
    conchas, obs = {}, {}
    for s in (-1, 1):
        os_, k = C.construir(q[s], enc, mats, com_led=s > 0)
        conchas[s] = k
        for o in os_:
            obs[o.name] = o
    arco, ka = A.construir(enc, conchas, mats, rel)
    obs['tl_arco'] = arco
    obs['tl_haste'], kh = H.haste(enc, q[1], conchas[1], mats, rel)
    obs['tl_mic'], km = H.mic(mats)
    obs['tl_cabo'], kc = H.cabo(enc, q[1], mats, rel)
    meio = (conchas[-1]['pivo'] + conchas[1]['pivo']) / 2
    raiz = vazio('techlead', (0, 0, 0))
    hs = vazio('tl_headset', meio, raiz)
    anel = conchas[1]['tampa'] - q[1]['n'] * G.R(2.9)
    origens = {'tl_arco': ka['apice'], 'tl_concha_d': conchas[-1]['pivo'], 'tl_concha_e': conchas[1]['pivo'],
               'tl_haste': kh['pivo'], 'tl_mic': km['centro'], 'tl_led': anel, 'tl_cabo': kc['saida']}
    for nome, o in obs.items():
        desl = G.bl(origens[nome]) - o.location     # recentra a malha na origem do contrato (location: a matriz
        o.data.transform(Matrix.Translation(-desl))  # de mundo só vale depois de avaliar a cena)
        pendurar(o, origens[nome], hs, meio)
    # extras (glTF extras): contrato para TD e animador
    raiz['escala_scan_por_real'] = G.ESC
    raiz['lado_microfone'] = '+X = esquerda do Fael (direita na tela)'
    hs['origem'] = 'ponto médio entre as articulações do garfo das duas conchas'
    hs['meio_glb'] = lista(meio)
    for s, nome in ((-1, 'tl_concha_d'), (1, 'tl_concha_e')):
        o = obs[nome]
        o['origem'] = 'articulação do garfo (eixo dos pinos, frente-trás)'
        o['eixo_glb'], o['frente_glb'], o['cima_glb'] = lista(q[s]['n']), lista(q[s]['fr']), lista(q[s]['up'])
        o['centro_orelha_pele_glb'] = lista(q[s]['c_pele'])
        o['compressao_espuma_mm'] = conchas[s]['compressao_mm']
    obs['tl_haste']['eixo_giro_glb'] = lista(kh['eixo'])
    obs['tl_haste']['origem'] = 'pivô: centro da tampa da concha E; girar tl_haste e tl_mic juntos neste eixo'
    obs['tl_mic']['eixo_glb'] = lista(km['eixo'])
    obs['tl_mic']['ponta_glb'] = lista(km['ponta'])
    obs['tl_mic']['pivo_haste_glb'] = lista(kh['pivo'])
    obs['tl_led']['origem'] = 'centro do anel (eixo da concha E); material tl_led, emissão animada pelo site'
    obs['tl_led']['eixo_glb'] = lista(q[1]['n'])
    obs['tl_cabo']['sugestao_site'] = 'neckFade do busto (y 0,012 → 0,075): o cabo termina atrás do pescoço'
    obs['tl_arco']['folga_alvo_mm'] = ka['folga_alvo_mm']
    ctx = {'busto': busto, 'enc': enc, 'q': q, 'conchas': conchas, 'arco': ka, 'haste': kh, 'mic': km, 'cabo': kc,
           'rel': rel, 'objs': [raiz, hs] + list(obs.values()), 'malhas': obs}
    return ctx


def main():
    ctx = construir()
    bpy.context.view_layer.update()
    print('REL', ctx['rel'])
    for s in (-1, 1):
        q = ctx['q'][s]
        print('CONCHA', s, 'pele', lista(q['c_pele']), 'eixo', lista(q['n'], 3), 'incl', round(q['ang_graus'], 1),
              'contato', round(q['contato'] * 1000, 2), 'compr', ctx['conchas'][s]['compressao_mm'])
    # --malha-em-filho: a desquantização da posição iria para o TRS do nó e tiraria o pivô do lugar (tl_haste gira no
    # pivô da concha); com a opção a malha vai para `<nó>_malha` e os nós do contrato ficam só com a translação.
    comum.exportar_glb(ctx['objs'], GLB, otimizar=False)
    subprocess.run(['node', os.path.join(ROOT, '3d/tools/props/otimizar.mjs'), GLB, '--malha-em-filho'], check=True,
                   cwd=ROOT)
    print('GLB', GLB, round(os.path.getsize(GLB) / 1024, 1), 'kB')
    subprocess.run(['node', os.path.join(ROOT, '3d/tools/props/glb.mjs'), GLB], cwd=ROOT)
    if BLEND != '0':
        os.makedirs(os.path.dirname(os.path.join(ROOT, BLEND)), exist_ok=True)
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, BLEND))
        print('BLEND', BLEND)
    if PROVAS != '0':
        import prop_techlead_prova as prova
        prova.rodar(ctx, PROVAS, GLB)


if __name__ == '__main__':
    main()
