"""Receita do S13a (P0 da auditoria, analise/aud/RELATORIO.md): S11 + largura do cabelo por ref-22 + topo pintado; SEM aba de orelha e SEM narina repintada.
No Blender vivo: import s13_build; s13_build.run()   |   headless: blender -b --python tools/s13_build.py"""
import sys, os, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import s10_build
def run(expr=True): importlib.reload(s10_build).run(expr=expr, name='s13', head='s13')
if __name__ == '__main__': run()
