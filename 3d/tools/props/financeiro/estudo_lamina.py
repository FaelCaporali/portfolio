"""Estudo do diretor de arte (correção 1 do conceito, v7): notan e gravação da lâmina, provados no site.

Não é forma de produção. Monta o blockout (modelador) com a aparência 'transmissao' (lookdev: vidro físico, gravação
opaca no verso, chanfro 2 mm) e troca só o que a BÍBLIA §4/§5 decide: corpo (limpo ou jateado com margem polida),
linguagem da grade (retângulos cheios, janelas polidas ou filetes de planilha), proporção, macro e moedas.
Cada opção vira `3d/export/props/lab/financeiro_v7_conceito-<opcao>.glb` para o laboratório (`?lab=`).

Opção = partes separadas por ponto, na ordem que quiser (ex.: `a2.c.tk.sm`):
  rg  atual (grade 4×4 de retângulos cheios)      a   filetes 1,2 mm, só a coluna de resultados preenchida
  a2  a + valores (barras à direita, rótulos à esquerda)  b   corpo jateado MÉDIO, células polidas escuras (janelas)
  b2  corpo jateado + filetes polidos + valores     c   retrato 0,072 × 0,112 m   c2  retrato 0,080 × 0,104 m
  tk  macro em tokens + cursor de ouro              sx  sem macro
  sm  sem moedas; o total geral gravado e dourado   ou  total geral dourado (com moedas)
  ab  tabela aberta: sem os filetes verticais das bordas (livro-razão), para não fazer moldura dentro da moldura
  cl  gravação clara (jateado branco-quente, como sai do jato de areia), no lugar do médio do lookdev
Uso: `blender -b --python 3d/tools/props/financeiro/estudo_lamina.py -- rg a a2 b b2 a2.c`
"""

import os
import sys

import bmesh
import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..'))
sys.path.insert(0, AQUI)
import aparencia  # noqa: E402
import blockout  # noqa: E402
import comum  # noqa: E402
import exportar  # noqa: E402

LINHA = 0.0012  # filete gravado (2,3 px no 1440)
BORDA = 0.004  # margem polida em volta do jateado
COL_PESOS = (1.35, 1.0, 1.0, 1.0)  # coluna A (rótulos) mais larga, como numa planilha
LINHAS_TAB = 5  # 4 de dados + totais
BARRA = 0.0022  # altura da marca de valor
VALORES = ((0.62, 0.70, 0.48), (0.45, 0.52, 0.66), (0.70, 0.40, 0.58), (0.38, 0.61, 0.44), (0.0, 0.78, 0.72))
TOKENS = ((0.010, 0.016, 0.006), (0.008, 0.012, 0.005, 0.014), (0.011, 0.007, 0.013), (0.009, 0.010))
TOKEN_RECUOS, TOKEN_VAO, CURSOR = (0, 1, 1, 0), 0.0016, (0.0013, 0.0042)
JATEADO, POLIDO, CLARA = '#8e9793', '#0f1312', '#c4c1b9'
_PADRAO = {k: getattr(blockout, k) for k in ('W', 'H', 'GRADE', 'MASTRO_X', 'MASTRO_ALT', 'CHANFRO', 'GRAV_LADO',
                                             '_colunas')}


def _reset():
    for k, v in _PADRAO.items():
        setattr(blockout, k, dict(v) if isinstance(v, dict) else v)
    blockout.CHANFRO, blockout.GRAV_LADO = 0.002, 1  # o que a prova de material aprovou (HANDOFF E3)


def _pesos():
    return COL_PESOS if _tabela else (1.0,) * blockout.GRADE['cols']


def _cols():
    g, tot = blockout.GRADE, sum(_pesos())
    x, out = -g['w'] / 2, []
    for p in _pesos():
        w = g['w'] * p / tot
        out.append((x, x + w))
        x += w
    return out


def _rows():
    g = blockout.GRADE
    pz, topo = g['h'] / g['lins'], g['zc'] + g['h'] / 2
    return [(topo - pz * (r + 1), topo - pz * r) for r in range(g['lins'])]


def _obj(nome, preencher, mat, raiz):
    bm = bmesh.new()
    preencher(bm)
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    o = bpy.data.objects.new(nome, me)
    bpy.data.collections[blockout.COLECAO].objects.link(o)
    o.parent = raiz
    return o


def _remover(prefixo):
    for o in [o for o in bpy.data.collections[blockout.COLECAO].all_objects if o.name.startswith(prefixo)]:
        bpy.data.objects.remove(o, do_unlink=True)


# ------------------------------------------------------------------------------------------------ gravações
def _filetes(bm):
    y, e = blockout._face_frente()
    cols, rows = _cols(), _rows()
    topo, fundo, x0, x1 = rows[0][1], rows[-1][0], cols[0][0], cols[-1][1]
    for r in range(LINHAS_TAB):  # topo + divisões; a base da tabela é o filete duplo dos totais
        blockout._caixa(bm, ((x0 + x1) / 2, y, rows[r][1]), (x1 - x0 + LINHA, e, LINHA))
    for x in [a for a, _ in cols][1:] if _aberta else [a for a, _ in cols] + [x1]:
        blockout._caixa(bm, (x, y, (topo + fundo) / 2), (LINHA, e, topo - fundo))


def _celula(bm, r, c, y, e):
    (a, b), (lo, hi), pad = _cols()[c], _rows()[r], LINHA / 2 + 0.0008
    blockout._caixa(bm, ((a + b) / 2, y, (lo + hi) / 2), (b - a - 2 * pad, e, hi - lo - 2 * pad))


def _resultados(bm, com_total=True):
    y, e = blockout._face_frente()
    for r in range(LINHAS_TAB - (0 if com_total else 1)):
        _celula(bm, r, len(COL_PESOS) - 1, y, e)


def _valores(bm):
    """Rótulo à esquerda na coluna A, número à direita nas colunas de dados (alinhamento de planilha, sem dígito)."""
    y, e = blockout._face_frente()
    pad = LINHA / 2 + 0.0012
    for r, (lo, hi) in enumerate(_rows()):
        for c, (a, b) in enumerate(_cols()[:3]):
            f = VALORES[r][c]
            if not f:
                continue
            w = (b - a - 2 * pad) * f
            x = a + pad + w / 2 if c == 0 else b - pad - w / 2
            blockout._caixa(bm, (x, y, (lo + hi) / 2), (w, e, BARRA))


def _tokens(bm):
    y, e = blockout._face_frente()
    m, x0 = blockout.MACRO, -blockout.GRADE['w'] / 2
    for i, (rec, toks) in enumerate(zip(TOKEN_RECUOS, TOKENS)):
        z, x = blockout.H / 2 - m['topo'] - m['alt'] / 2 - i * m['passo'], x0 + rec * m['recuo']
        for t in toks:
            blockout._caixa(bm, (x + t / 2, y, z), (t, e, m['alt']))
            x += t + TOKEN_VAO
    return x, blockout.H / 2 - m['topo'] - m['alt'] / 2 - 3 * m['passo']


def _frente(fora):
    """Ouro aplicado na face da FRENTE (douração sobre vidro): visto através do vidro verde, lia oliva."""
    lado, blockout.GRAV_LADO = blockout.GRAV_LADO, -1
    try:
        return blockout._face_frente(fora, blockout.GRAV_DENTRO)
    finally:
        blockout.GRAV_LADO = lado


def _cursor(bm, x, z):
    y, e = _frente(0.0006)
    blockout._caixa(bm, (x + CURSOR[0] / 2, y, z), (CURSOR[0], e, CURSOR[1]))


def _jateado(bm):
    y = blockout.T / 2 + 0.00015  # atrás da gravação: o que é gravado/polido fica na frente dele
    blockout._caixa(bm, (0, y, 0), (blockout.W - 2 * BORDA, 0.0005, blockout.H - 2 * BORDA))


def _total_dourado(bm):
    y, e = _frente(0.0003)
    if _tabela:
        _celula(bm, LINHAS_TAB - 1, len(COL_PESOS) - 1, y, e)
        return
    g, (lo, hi), (a, b) = blockout.GRADE, _rows()[-1], _cols()[-1]
    blockout._caixa(bm, ((a + b) / 2, y, (lo + hi) / 2), ((b - a) * g['fx'], e, (hi - lo) * g['fz']))


_tabela = _aberta = False


# ------------------------------------------------------------------------------------------------ opções
def _retrato(w=0.072, h=0.112):
    """Lâmina mais alta e estreita; o topo da bandeira fica onde estava (mastro encurta o que o vidro sobe)."""
    k, dh = w / 0.090, h - 0.098
    blockout.W, blockout.H = w, h
    blockout.GRADE.update(w=0.0756 * k, h=0.0549 + dh * 0.5, zc=-0.0137 - dh * 0.2)  # filete de baixo a 3,5 mm da borda
    blockout.MASTRO_X, blockout.MASTRO_ALT = w / 2 - 0.004, 0.053 - dh / 2


def construir(opcao):
    global _tabela, _aberta
    partes = set(opcao.split('.'))
    _reset()
    _aberta = 'ab' in partes
    _tabela = bool(partes & {'a', 'a2', 'b2'})
    if 'c' in partes:
        _retrato()
    if 'c2' in partes:
        _retrato(0.080, 0.104)
    if _tabela:
        blockout.GRADE['lins'] = LINHAS_TAB
        blockout._colunas = lambda: [(a + b) / 2 for a, b in _cols()]  # nós do fio e moedas no centro das colunas
    comum.cena_nova()
    blockout.construir()
    aparencia.aplicar('transmissao')
    raiz = bpy.data.objects['financeiro']
    grav, ouro = bpy.data.materials['gravacao'], bpy.data.materials['ouro']
    fosco = 'b' in partes or 'b2' in partes
    polido = aparencia._dieletrico('polido', base=POLIDO, rug=0.12) if fosco else None
    tinta = polido or grav
    if 'cl' in partes:
        bsdf = next(n for n in grav.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        srgb = [int(CLARA[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
        bsdf.inputs['Base Color'].default_value = (*lin, 1.0)
    if fosco:
        _obj('jateado', _jateado, aparencia._dieletrico('jateado', base=JATEADO, rug=0.75), raiz)
        bpy.data.objects['grade'].data.materials[0] = polido
        bpy.data.objects['macro'].data.materials[0] = polido
    if _tabela:
        _remover('grade')
        _obj('grade', _filetes, tinta, raiz)
        _obj('cheias', lambda bm: _resultados(bm, 'sm' not in partes and 'ou' not in partes), tinta, raiz)
        if partes & {'a2', 'b2'}:
            _obj('valores', _valores, tinta, raiz)
    if 'tk' in partes or 'sx' in partes:
        _remover('macro')
    if 'tk' in partes:
        fim = {}
        _obj('macro', lambda bm: fim.setdefault('p', _tokens(bm)), tinta, raiz)
        _obj('cursor', lambda bm: _cursor(bm, *fim['p']), ouro, raiz)
    if 'sm' in partes:
        _remover('moeda')
    if partes & {'sm', 'ou'}:
        _obj('total', _total_dourado, ouro, raiz)
    bpy.context.scene.frame_set(1)
    return exportar.exportar(f'conceito-{opcao}')


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for op in args or ['rg']:
        print('ESTUDO', op, construir(op))
