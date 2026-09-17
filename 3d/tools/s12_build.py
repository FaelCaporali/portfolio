"""Receita completa do S12, no Blender interativo:  import s12_build; s12_build.run()
S12 = S11 + cabelo atrás das orelhas na largura da foto de longe, textura do topo da cabeça, olhos e narina esquerda vistos de baixo."""
import importlib, s10_build
def run(expr=True): importlib.reload(s10_build).run(expr=expr, name='s12', head='s12')
