"""Caso ruim conhecido para provar o laboratório e os portões: a v6 do financeiro POSTA no espaço do busto, com as
mesmas transformações que o componente da v6 aplicava no site (ledger/Ledger.tsx: painel atrás da orelha, girado,
escala 0,9; mastro e pilha de 5 moedas no topo da coluna D, em repouso). Sem a linha de tendência, o cursor e a
textura da planilha, que o site gerava em código. Exporta sem compressão, como a v6.

Uso: blender -b --python 3d/tools/props/caso_ruim_v6.py
Saída: 3d/export/props/lab/financeiro_v6_posta.glb
(abrir com ?slot=financeiro&d=0&lab=3d/export/props/lab/financeiro_v6_posta.glb)
"""

import os
import sys

import bpy
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comum  # noqa: E402

V6 = os.path.join(comum.RAIZ, '3d/export/props/financeiro_v6.glb')
SAIDA = os.path.join(comum.RAIZ, '3d/export/props/lab/financeiro_v6_posta.glb')

# Constantes de ledger/Ledger.tsx e ledger/sheet.ts (espaço do glb, Y para cima).
PANEL_POS = (0.15, 0.165, -0.22)
PANEL_ROT = (0.06, -0.3, 0.0)
PANEL_SCALE = 0.9
COL_D = ((52 + (768 - 52) / 4 * 3.5) / 768 - 0.5) * 0.165
FLAG = (COL_D, 0.1, -0.008)
STACK = (COL_D, 0.094, 0.009)
STACK_TILT = 0.32
COIN_T = 0.0036
COIN_JITTER = [(0, 0, 0), (0.0007, -0.0005, 0.3), (-0.0006, 0.0006, 0.72), (0.0009, 0.0003, 1.15),
               (-0.0004, -0.0006, 1.54)]

T = Matrix.Translation
R = lambda a, eixo: Matrix.Rotation(a, 4, eixo)  # noqa: E731
# Euler XYZ do three.js = Rx · Ry · Rz.
painel = (T(PANEL_POS) @ R(PANEL_ROT[0], 'X') @ R(PANEL_ROT[1], 'Y') @ R(PANEL_ROT[2], 'Z')
          @ Matrix.Scale(PANEL_SCALE, 4))
mastro = painel @ T(FLAG)
pilha = painel @ T(STACK) @ R(STACK_TILT, 'X')

comum.cena_nova()
objs = {o.name: o for o in comum.importar_glb(V6, 'Peca')}
C = comum.GL_PARA_BL
colocar = {
    'Frame': painel,
    'Glass': painel,
    'Pole': mastro,
    'Finial': mastro,
    'Pennant': mastro @ R(-0.5, 'Y'),
}
for nome, m in colocar.items():
    o = objs[nome]
    o.matrix_world = C @ m @ C.inverted() @ o.matrix_world
moeda = objs['Coin']
base = moeda.matrix_world.copy()
for i, (jx, jz, giro) in enumerate(COIN_JITTER):
    o = moeda if i == 0 else moeda.copy()
    if i:
        o.name = f'Coin.{i}'
        moeda.users_collection[0].objects.link(o)
    local = T((jx, COIN_T * (i + 0.5) * 1.004, jz)) @ R(giro, 'Y')
    o.matrix_world = C @ pilha @ local @ C.inverted() @ base

os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
for o in bpy.data.objects:
    o.select_set(o.users_collection[0].name == 'Peca')
bpy.ops.export_scene.gltf(filepath=SAIDA, export_format='GLB', use_selection=True, export_yup=True,
                          export_apply=True, export_cameras=False, export_lights=False)
print('CASO_RUIM', SAIDA)
