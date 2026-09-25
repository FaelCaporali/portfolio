"""Adereço da vida "Entrepreneur", volta 1: MOSTRUÁRIO DE CANDIDATOS (um glb por candidato, raiz já na vitrine).

Headless (fonte de verdade, reprodutível):
    blender -b --python 3d/tools/prop_empreendedor.py -- [glb=3d/export/props/lab] [so=sup,bolo]
        [provas=3d/captura/props/empreendedor/v1/mostruario|0] [blend=3d/blend/props/empreendedor_v1_mostruario.blend|0]

Forma e material na mesma receita (padrão que entregou no financeiro). Candidatos registrados por id em CANDIDATOS;
a parte 2 (gerais E5 e emp_todos.glb) registra os seus aqui. Cada candidato: coleção `emp_<id>`, raiz vazia `emp_<id>`
na vitrine da ficha (lugar medido da calculadora do financeiro), ≤ 2 materiais, ≤ 3 malhas, sem textura, sem Draco.
Unidades: metros na escala do scan do S13. Espaço local de cada peça: Z para cima, frente para −Y, +X para a cabeça.
"""
import os
import sys

import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [AQUI, os.path.join(AQUI, 'props')]
import comum  # noqa: E402
import prop_financeiro_v6 as v6  # noqa: E402
import prop_empreendedor_base as B  # noqa: E402
import prop_empreendedor_chaves as chaves  # noqa: E402
import prop_empreendedor_cartoes as cartoes  # noqa: E402
import prop_empreendedor_chaveiros as chaveiros  # noqa: E402
import prop_empreendedor_doces as doces  # noqa: E402
import prop_empreendedor_doces2 as doces2  # noqa: E402
import prop_empreendedor_hostel as hostel  # noqa: E402
import prop_empreendedor_kanban as kanban  # noqa: E402
import prop_empreendedor_prova as prova  # noqa: E402
import prop_empreendedor_sup as sup  # noqa: E402
import prop_empreendedor_tech as tech  # noqa: E402

ROOT, ARGS = v6.ROOT, v6.ARGS
PASTA_GLB = os.path.normpath(os.path.join(ROOT, ARGS.get('glb', '3d/export/props/lab')))
assert PASTA_GLB.startswith(os.path.join(ROOT, '3d/export/props/lab')), 'glb só em 3d/export/props/lab/'
BLEND = ARGS.get('blend', '3d/blend/props/empreendedor_v1_mostruario.blend')

# Vitrine: o lugar medido da calculadora (prop_financeiro_direita.RAIZ_GL/GIRO), espaço do glb (Y para cima).
VITRINE, GIRO = (-0.165, 0.06, -0.26), 0.6
# id → (E#, construtor(mats) → [malhas], raiz no glb, giro Y, altura-alvo em cabeças no 1440). A escala e o x finais
# saem de prova.ajustar (medidos contra as faixas livres das 3 telas) e ficam impressos em AJUSTE e no medidas.json.
CANDIDATOS = {
    'sup': ('E1', sup.construir, (-0.165, 0.02, -0.26), 0.45, 0.62),
    'bolo': ('E2', doces.bolo, VITRINE, GIRO, 0.45),
    'brigadeiros': ('E2', doces.brigadeiros, VITRINE, GIRO, 0.45),
    'cupcake': ('E2', doces2.cupcake, VITRINE, GIRO, 0.5),     # volta 2: candidatos ao lado do bolo (Fael)
    'muffin': ('E2', doces2.muffin, VITRINE, GIRO, 0.5),
    'beliche': ('E3', hostel.beliche, VITRINE, 1.2, 0.45),
    'chave_quarto': ('E3', hostel.chave_quarto, VITRINE, GIRO, 0.45),
    'foguete': ('E4', tech.foguete, VITRINE, GIRO, 0.5),
    'notebook': ('E4', tech.notebook, VITRINE, 1.1, 0.45),
    # Parte 2 (E5): gerais. 'cartoes' aguarda o Fael (E8); emp_todos aguarda a escolha dele.
    'kanban': ('E5', kanban.kanban, VITRINE, GIRO, 0.5),
    'chaves': ('E5', chaves.chaves, VITRINE, GIRO, 0.5),
    'chaves_negocios': ('E5/E9', chaveiros.chaves_negocios, VITRINE, GIRO, 0.5),
    'cartoes': ('E8', cartoes.leque, VITRINE, 1.0, 0.45),   # volta 2: leque de cartões (giro medido na prova)
}
# Parte 2 em diante: tamanho ajustado só pelas faixas do 1440 e do 1024 (orquestrador, 25/09: a interseção com o 360
# encolhia as peças largas a 0,10–0,19 da cabeça). O 360 fica medido no json, para o layout próprio dele.
SO_DESKTOP = {'cartoes': ('1440x900', '1024x768'), 'kanban': ('1440x900', '1024x768'), 'chaves': ('1440x900', '1024x768'),
              'chaves_negocios': ('1440x900', '1024x768'),
              'cupcake': ('1440x900', '1024x768'), 'muffin': ('1440x900', '1024x768')}


def construir(cid):
    _, fn, raiz_gl, giro, _ = CANDIDATOS[cid]
    col = B.colecao('emp_' + cid)

    def mats(nome, metal, rug, double=False):
        return B.material('%s_%s' % (cid, nome), metal, rug, double)

    objs = fn(mats)
    assert len(objs) <= 3 and len({m.name for o in objs for m in o.data.materials}) <= 2, cid
    raiz = bpy.data.objects.new('emp_' + cid, None)
    col.objects.link(raiz)
    raiz.location = comum.gl_para_bl(raiz_gl)
    raiz.rotation_euler = (0, 0, giro)
    for o in objs:
        o.parent = raiz
    B.mover(objs, col)
    return raiz, objs


def tris(objs):
    n = 0
    for o in objs:
        o.data.calc_loop_triangles()
        n += len(o.data.loop_triangles)
    return n


def main():
    v6.reset()
    ids = ARGS['so'].split(',') if ARGS.get('so') else list(CANDIDATOS)
    feitos = {}
    for cid in ids:
        raiz, objs = construir(cid)
        escala, x = prova.ajustar(raiz, objs, CANDIDATOS[cid][4], SO_DESKTOP.get(cid))
        print('AJUSTE', cid, 'escala', escala, 'raiz_gl', (x, *CANDIDATOS[cid][2][1:]),
              'giro', CANDIDATOS[cid][3])
        arq = os.path.join(PASTA_GLB, 'emp_%s.glb' % cid)
        comum.exportar_glb([raiz] + objs, arq, draco=False)
        feitos[cid] = {'e': CANDIDATOS[cid][0], 'raiz': raiz, 'escala': escala, 'x': x, 'objs': objs,
                       'telas': SO_DESKTOP.get(cid),
                       'glb': os.path.relpath(arq, ROOT), 'kB': round(os.path.getsize(arq) / 1024, 1), 'tris': tris(objs)}
        print('EXPORT', cid, feitos[cid]['kB'], 'kB', feitos[cid]['tris'], 'tris',
              {o.name: len(o.data.vertices) for o in objs})
    bpy.context.view_layer.update()
    if BLEND != '0' and not ARGS.get('so'):
        os.makedirs(os.path.dirname(os.path.join(ROOT, BLEND)), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, BLEND))
        print('BLEND', BLEND)
    if ARGS.get('provas', '0') != '0':
        prova.rodar(feitos, ARGS['provas'], ARGS.get('folha', 'folha-mostruario-e1e4.png'))


if __name__ == '__main__':
    main()
