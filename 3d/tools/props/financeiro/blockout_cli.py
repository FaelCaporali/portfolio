"""Linha de comando do blockout (modelador): monta, salva o .blend da etapa, exporta e faz as vistas.

`blender -b --python 3d/tools/props/financeiro/blockout.py -- [pasta] [--sem-vistas] [--sem-moedas]
[--prova=<rótulo>] [--ancora=x,y,z] [--giro=g] [--escala=s]`
- glb de forma: `3d/export/props/lab/financeiro_v7_blockout-c1.glb` (materiais de valor).
- `--prova`: também exporta `lab/financeiro_v7_c1m-<rótulo>.glb` com a aparência 'transmissao' do lookdev e a gravação
  branco-quente da C1 do diretor (#c4c1b9), só para conferir a forma no site com o material provado.
"""

import os
import sys

import bpy

import comum

CLARA = '#c4c1b9'  # gravação clara da C1 (BÍBLIA §5); o lookdev a assume no módulo dele na cascata


def _args():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    opc = {a[2:].split('=')[0]: (a.split('=', 1)[1] if '=' in a else True) for a in args if a.startswith('--')}
    return [a for a in args if not a.startswith('--')], opc


def ajustar(bl, opc):
    """Aplica --ancora/--giro/--escala/--sem-moedas ao módulo do blockout."""
    if 'ancora' in opc:
        bl.ANCORA_GLB = tuple(float(v) for v in opc['ancora'].split(','))
    if 'giro' in opc:
        bl.GIRO_Y = float(opc['giro'])
    if 'escala' in opc:
        bl.ESCALA = float(opc['escala'])
    if 'sem-moedas' in opc:
        bl.MOEDAS = False


def gravacao_clara():
    m = bpy.data.materials['gravacao']
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    srgb = [int(CLARA[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    b.inputs['Base Color'].default_value = (*[c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
                                              for c in srgb], 1.0)


def vistas(pasta, pecas, busto):
    """Silhueta (3 telas) e argila (câmera do site, 3 telas) com o busto; 7 vistas de argila só da peça."""
    for tela in comum.TELAS:
        k = comum.ler_camera_site(tela).get('dsfCaptura', 1)
        comum.camera_site(tela, escala=k)
        comum.render_silhueta(os.path.join(pasta, f'silhueta-{tela}.png'), pecas, busto)
        comum.render_argila(os.path.join(pasta, f'argila-site-{tela}.png'), pecas + busto)
    comum.vistas_argila(pecas, pasta, 'blockout')


def detalhes(pasta, pecas, bl):
    """Close-ups em argila (7 vistas, 700 px) do topo (grampo, mastro, bandeira), do fio com os anéis e das moedas."""
    from mathutils import Vector

    raiz = bpy.data.objects['financeiro']
    alvos = {'topo': ((0.022, 0, bl.H / 2 + 0.03), 0.11), 'fio': ((-0.004, 0, bl.H / 2 + 0.012), 0.13),
             'moedas': ((0.024, -0.004, -bl.H / 2 - 0.012), 0.09),
             'grampo': ((bl.W / 2 - 0.005, 0, bl.H / 2 - 0.002), 0.06)}
    for nome, (p, dist) in alvos.items():
        comum.vistas_argila(pecas, pasta, f'detalhe-{nome}', alvo=raiz.matrix_world @ Vector(p), dist=dist, lado=700)


def main(bl):
    pos, opc = _args()
    ajustar(bl, opc)
    pasta = os.path.join(comum.RAIZ, pos[0] if pos else '3d/captura/props/financeiro/v7/blockout/c1')
    comum.cena_nova()
    busto = [o for o in comum.importar_busto() if o.type == 'MESH']
    pecas = bl.construir()
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(comum.RAIZ, '3d/blend/props/financeiro_v7_blockout-c1.blend'))
    import exportar

    print('EXPORTADO', exportar.exportar('blockout-c1'))
    if 'sem-vistas' not in opc:
        vistas(pasta, pecas, busto)
    if 'detalhes' in opc:
        bpy.context.view_layer.update()
        detalhes(pasta, pecas, bl)
    if 'prova' in opc:
        import aparencia

        aparencia.aplicar('transmissao')
        gravacao_clara()
        print('PROVA', exportar.exportar(f"c1m-{opc['prova']}"))
