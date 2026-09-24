"""Exportação do adereço do financeiro (módulo do técnico web; ESTUDIO §3).

Contrato com os outros módulos: a peça inteira vive na coleção `Peca`, no espaço do busto (o glb do site: metros
na escala do scan; no Blender, Z para cima e rosto para −Y), com a posição final aplicada; o busto de referência fica
na coleção `Referencia` (comum.importar_busto) e nunca é exportado. Nomes de objeto estáveis (o site e as animações usam os nomes).

Saídas:
  etapa 'producao' → 3d/export/props/financeiro.glb (a v6 está guardada em financeiro_v6.glb)
  qualquer outra   → 3d/export/props/lab/financeiro_v7_<etapa>.glb (ver no site: ?slot=financeiro&d=0&lab=<caminho>)
Uso: de construir.py, `exportar.exportar('blockout')`; ou `blender -b <arquivo.blend> --python exportar.py -- <etapa>`.
Depois de exportar, imprime o JSON do glb (glb.mjs): extensão esperada ausente é defeito.
"""

import os
import subprocess
import sys

import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..'))
import comum  # noqa: E402

COLECAO = 'Peca'
VERSAO = 'v7'


def caminho(etapa):
    if etapa == 'producao':
        return os.path.join(comum.RAIZ, '3d/export/props/financeiro.glb')
    return os.path.join(comum.RAIZ, f'3d/export/props/lab/financeiro_{VERSAO}_{etapa}.glb')


def exportar(etapa='blockout', draco=True):
    col = bpy.data.collections.get(COLECAO)
    if col is None or not col.all_objects:
        raise RuntimeError(f'coleção {COLECAO} ausente ou vazia')
    saida = comum.exportar_glb(list(col.all_objects), caminho(etapa), draco=draco)
    subprocess.run(['node', os.path.join(comum.RAIZ, '3d/tools/props/glb.mjs'), saida], check=True)
    return saida


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    print('EXPORTADO', exportar(args[0] if args else 'blockout'))
