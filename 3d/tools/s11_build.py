"""Receita completa do S11, no Blender interativo:  import s11_build; s11_build.run()
S11 = S10 + crânio arredondado (s11_head.dome), sombra dos olhos cobrindo a conjuntiva (sem degrau ao olhar de lado) e corretiva do sorriso bilateral."""
import importlib, s10_build
def run(expr=True): importlib.reload(s10_build).run(expr=expr, name='s11', head=True)
