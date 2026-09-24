"""Controle sintético do portão arte ↔ cena: uma placa que, no 1440×900, cai sobre o título do herói. Não há caso real
conhecido de adereço sobre o texto; este prova que o portão reprova quando acontece.

Uso: blender -b --python 3d/tools/props/controle_ui.py → 3d/export/props/lab/controle_ui.glb
"""

import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comum  # noqa: E402

comum.cena_nova()
bpy.ops.mesh.primitive_cube_add(size=1, location=comum.gl_para_bl((-0.33, 0.19, 0.0)))
placa = bpy.context.active_object
placa.name = 'ControleUi'
placa.scale = (0.08, 0.01, 0.05)
saida = os.path.join(comum.RAIZ, '3d/export/props/lab/controle_ui.glb')
bpy.ops.export_scene.gltf(filepath=saida, export_format='GLB', export_yup=True, export_apply=True)
print('CONTROLE', saida)
