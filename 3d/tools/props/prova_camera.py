"""Prova da câmera do Blender (ESTUDIO §5): o busto renderizado pela câmera do site (comum.camera_site) tem de
coincidir no contorno com a máscara do busto que o site renderiza (portoes.mjs grava <rótulo>-<tela>-busto.png).

Uso: blender -b --python 3d/tools/props/prova_camera.py -- <pasta de saída>
Depois: /data/venv-face/bin/python 3d/tools/props/compara_mascaras.py <pasta> <prefixo do site>
Grava blender-<tela>-busto.png (silhueta) e blender-<tela>-argila.png (argila, mesma câmera) na pasta.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comum  # noqa: E402

pasta = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '3d/captura/props/ferramental/camera'
for tela in comum.TELAS:
    comum.cena_nova()
    busto = [o for o in comum.importar_busto() if o.type == 'MESH']
    comum.camera_site(tela)
    comum.render_silhueta(os.path.join(pasta, f'blender-{tela}-busto.png'), busto)
    comum.render_argila(os.path.join(pasta, f'blender-{tela}-argila.png'), busto)
    print('PROVA', tela, 'ok')
