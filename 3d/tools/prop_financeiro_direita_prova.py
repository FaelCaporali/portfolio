"""Provas da modelagem do lado direito do financeiro (chamado por prop_financeiro_direita.py com provas=<pasta>).

1. Medida: caixa de cada malha e do busto em px CSS nas 3 telas, pela câmera do site (comum.camera_site).
2. Argila (Workbench, cavidade) em 7 vistas + composição em argila na câmera do 1440 com o busto.
3. Um close de estúdio em Cycles com os materiais (o mesmo estúdio dos renders da v6).
"""
import json
import math
import os

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

import comum
import prop_financeiro_v6 as v6


def caixa_px(cam, objs, amostra=1):
    cena = bpy.context.scene
    W, H = cena.render.resolution_x, cena.render.resolution_y
    xs, ys = [], []
    for o in objs:
        mw = o.matrix_world
        vs = o.data.vertices
        for i in range(0, len(vs), amostra):
            p = world_to_camera_view(cena, cam, mw @ vs[i].co)
            xs.append(p.x * W)
            ys.append((1 - p.y) * H)
    return min(xs), min(ys), max(xs), max(ys)


def medir(objs, busto):
    malhas = [o for o in busto if o.type == 'MESH']
    for tela in comum.TELAS:
        cam = comum.camera_site(tela, escala=1)
        bpy.context.view_layer.update()
        linhas, caixas = [], {}
        for nome, grupo in (('busto', malhas), ('calc', [o for o in objs if o.name in ('carcaca', 'teclas', 'cabecote')]),
                            ('bobina', [o for o in objs if o.name == 'bobina']),
                            ('fita', [o for o in objs if o.name == 'fita']),
                            ('boleto', [o for o in objs if o.name == 'boleto'])):
            x0, y0, x1, y1 = caixa_px(cam, grupo, 7 if nome == 'busto' else 1)
            linhas.append('%s x %.0f-%.0f y %.0f-%.0f' % (nome, x0, x1, y0, y1))
            caixas[nome] = (x0, y0, x1, y1)
        # Borda esquerda da cabeça na altura da fita (o que pode esconder a fita impressa).
        _, fy0, _, fy1 = caixas['fita']
        cena = bpy.context.scene
        cab = min(world_to_camera_view(cena, cam, o.matrix_world @ v.co).x * cena.render.resolution_x
                  for o in malhas for v in o.data.vertices[:]
                  if fy0 <= (1 - world_to_camera_view(cena, cam, o.matrix_world @ v.co).y) * cena.render.resolution_y <= fy1)
        caixas['cabeca_na_fita'] = cab
        print('MEDIDA', tela, ' | '.join(linhas), '| cabeça na altura da fita x %.0f' % cab)
        print('MEDIDA_JSON', json.dumps({'tela': tela, **caixas}))


def rodar(raiz, objs, pasta, tag):
    pasta_abs = os.path.join(v6.ROOT, pasta)
    os.makedirs(pasta_abs, exist_ok=True)
    if bpy.context.scene.world is None:
        bpy.context.scene.world = bpy.data.worlds.new('Mundo')
    busto = comum.importar_busto()
    medir(objs, busto)
    if tag == 'medida':
        return
    comum.vistas_argila(objs, pasta_abs, tag)
    cam = comum.camera_site('1440x900', escala=1)
    comum.render_argila(os.path.join(pasta_abs, '%s-argila-site1440.png' % tag), objs + [o for o in busto
                                                                                      if o.type == 'MESH'])
    bpy.context.scene.camera = None
    bpy.data.objects.remove(cam)
    # Close de estúdio (Cycles), frente da peça: o giro da raiz entra no azimute.
    v6.RENDERS, v6.TAG = pasta, tag
    v6.studio()
    bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = 800, 1000
    alvo = raiz.matrix_world @ Vector((-0.004, 0.02, 0.075))
    v6.camera_on(alvo, 0.62, math.degrees(raiz.rotation_euler.z) - 12, 10, lens=85)
    v6.only({o.name for o in objs})
    v6.shoot('estudio-close')
