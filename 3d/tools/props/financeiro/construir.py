"""Cadeia da receita do adereço do financeiro (ESTUDIO §3): forma → aparência → movimento → exportar.

`forma.aplicar()` (modelador) monta a coleção `Peca` com a forma da FICHA (R1–R7; substitui o `blockout.construir()`
do conceito c1, superado — ver `forma.py`); `aparencia.aplicar()` (lookdev) e `movimento.aplicar()` (animador)
trabalham sobre ela; `exportar.exportar(etapa)` (técnico web) grava o glb. Salva o .blend da etapa no neutro (quadro
1, sem pose). `blockout.py` fica no lugar como histórico do c1 (não é mais chamado por aqui; `blockout_cli.py` e
`poses_sim.py` continuam usando-o direto, sem passar por esta cadeia).
Uso: `blender -b --python 3d/tools/props/financeiro/construir.py -- <etapa>` (forma, aparencia, movimento,
producao). A etapa decide até onde a cadeia vai e para onde vai o glb (lab/ ou o glb final, ver exportar.py).
"""

import importlib
import os
import sys

import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..'))
sys.path.insert(0, AQUI)
import comum  # noqa: E402
import exportar  # noqa: E402
import forma  # noqa: E402

CADEIA = ('aparencia', 'movimento')  # depois da forma, na ordem da fase de produção


def _modulo(nome):
    if not os.path.exists(os.path.join(AQUI, f'{nome}.py')):
        return None
    return importlib.import_module(nome)


def construir(etapa='forma'):
    comum.cena_nova()
    comum.importar_busto()
    forma.aplicar()
    alvo = len(CADEIA) if etapa == 'producao' else (CADEIA.index(etapa) + 1 if etapa in CADEIA else 0)
    for nome in CADEIA[:alvo]:
        m = _modulo(nome)
        if m is None:
            raise RuntimeError(f'módulo {nome}.py ausente para a etapa {etapa}')
        m.aplicar()
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(comum.RAIZ, f'3d/blend/props/financeiro_v7_{etapa}.blend'))
    return exportar.exportar(etapa)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    print('CONSTRUIDO', construir(args[0] if args else 'blockout'))
