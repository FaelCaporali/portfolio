"""Prova de material da C1 do lookdev (REQUISITOS R1, R2, R4, R7): vidro fosco, cabeçalho verde, barra de fórmula.

Geometria SÓ DE PROVA, para ver o material no lugar em que vai morar: a faixa do cabeçalho, a barra de fórmula com
`Sub AtingirMeta()` e o cursor de texto. A forma definitiva é do modelador, que porta para `blockout.py` (não importar
daqui). Sobre o blockout C1: tira a macro em tokens (R4 pede a macro digitada na barra de fórmula), põe a impressão na
FRENTE (`GRAV_LADO = -1`: no fosco, o que fica no verso sai borrado) e reatribui os materiais pelo R7 (ouro só nas moedas
e na bandeira): fio → aço; cursor de texto, filete duplo → tinta; moldura e alça da célula ativa → verde.

Uso: `blender -b --python 3d/tools/props/financeiro/aparencia_prova.py -- fosco [--sufixo=-r1] [--vazias]
[--grav=1] [--texto=0.0068] [--marcas-d] [--vidro=trans:0.85,base:#c9ccc8]` → `3d/export/props/lab/financeiro_v7_prova-<variante><sufixo>.glb`.
`--vazias`: metade das células sem valor (BÍBLIA §8b item 3: célula vazia × preenchida, base de "células se
preenchendo").
"""

import os
import sys

import bpy
from mathutils import Matrix

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..'))
sys.path.insert(0, AQUI)
import aparencia  # noqa: E402
import blockout as bl  # noqa: E402
import blockout_geo as geo  # noqa: E402
import comum  # noqa: E402

FONTE = '/usr/share/fonts/truetype/ubuntu/UbuntuMono-B.ttf'  # monoespaçada estreita (0,5 em), como o editor do VBA
TEXTO = 'Sub AtingirMeta()'
# Faixas acima da tabela (z do centro, altura), no frame da âncora: cabeçalho verde no topo, barra de fórmula abaixo.
CABECALHO, BARRA_F, FX = (0.0420, 0.0080), (0.0262, 0.0105), 0.0060  # FX: largura da caixa do "fx"
CARET = (0.0010, 0.0062)
# Faces jateadas, bordas e chanfro polidos (lapidado brilhante: pegam a chave e dizem "vidro"); ficha de produção R1.
BORDA_RUG = 0.06
TINTA_FORA, MARCA_FORA = 0.0001, 0.0002  # preenchimento claro atrás da marca de valor (0,1 mm)


def _y(sobra=0.0002):
    return bl._face(-1, sobra)


def _obj(nome, preencher, mat):
    raiz = bpy.data.objects['financeiro']
    return geo.objeto(nome, preencher, bpy.data.materials[mat], raiz, bl.COLECAO)


def _x0():
    return -bl.GRADE['w'] / 2


def cabecalho(bm):
    y, e = _y()
    geo.caixa(bm, (0, y, CABECALHO[0]), (bl.GRADE['w'], e, CABECALHO[1]))


def _texto_malha(tamanho):
    """Texto plano (sem extrusão) virado para −Y, começando em x = 0 e centrado em z = 0; devolve (malha, largura)."""
    cu = bpy.data.curves.new('formula', 'FONT')
    cu.body, cu.size, cu.resolution_u = TEXTO, tamanho, 3
    cu.font = bpy.data.fonts.load(FONTE)
    cu.align_x, cu.align_y = 'LEFT', 'CENTER'
    tmp = bpy.data.objects.new('formula_tmp', cu)
    bpy.context.scene.collection.objects.link(tmp)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp)
    me.transform(Matrix.Rotation(1.5707963, 4, 'X'))  # plano XY → XZ; normal +Z → −Y
    xs = [v.co.x for v in me.vertices]
    return me, max(xs) - min(xs)


def barra_formula(tamanho):
    """Caixa da barra (contorno de filete), separador do fx, texto e cursor de texto depois do último caractere."""
    me, larg = _texto_malha(tamanho)
    x_txt = _x0() + FX + 0.0022
    y, e = _y()
    zc, h = BARRA_F
    w, lin = bl.GRADE['w'], bl.LINHA

    def caixa(bm):
        for dz in (-h / 2, h / 2):
            geo.caixa(bm, (0, y, zc + dz), (w + lin, e, lin))
        for x in (_x0(), -_x0(), _x0() + FX):
            geo.caixa(bm, (x, y, zc), (lin, e, h))
        geo.caixa(bm, (x_txt + larg + 0.0012, y, zc), (CARET[0], e, CARET[1]))

    _obj('barra', caixa, 'gravacao')
    me.transform(Matrix.Translation((x_txt, y - e / 2 - 0.00005, zc)))
    o = bpy.data.objects.new('formula', me)
    bpy.data.collections[bl.COLECAO].objects.link(o)
    o.parent = bpy.data.objects['financeiro']
    me.materials.append(bpy.data.materials['gravacao'])
    return larg


def reatribuir():
    """R7: fio de aço; filete duplo em tinta; moldura e alça da célula ativa em verde (o cursor de célula do Excel).
    Vidro: faces da frente e de trás jateadas, laterais e chanfro polidos."""
    m = bpy.data.materials
    vid = bpy.data.objects['vidro'].data
    vid.materials.append(m['vidro_borda'])
    for p in vid.polygons:
        p.material_index = 0 if abs(p.normal.y) > 0.95 else 1
    bpy.data.objects['fio'].data.materials[0] = m['aco']
    tot = bpy.data.objects['totais'].data
    tot.materials[0] = m['verde']
    tot.materials.append(m['gravacao'])
    lim = bl._rows()[-1][0] - 0.0019  # abaixo da célula ativa: só o filete duplo
    for p in tot.polygons:
        p.material_index = 1 if p.center.z < lim else 0


def separar_marcas():
    """Marcas de valor da `grade` (ilhas mais grossas que o filete) vão para o material `marca`."""
    import bmesh

    me = bpy.data.objects['grade'].data
    me.materials.append(bpy.data.materials['marca'])
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    livres = set(bm.faces)
    while livres:
        ilha, pilha = set(), [livres.pop()]
        while pilha:
            f = pilha.pop()
            ilha.add(f)
            viz = {g for e in f.edges for g in e.link_faces if g in livres}
            livres -= viz
            pilha.extend(viz)
        xs = [v.co.x for f in ilha for v in f.verts]
        zs = [v.co.z for f in ilha for v in f.verts]
        marca = min(max(xs) - min(xs), max(zs) - min(zs)) > bl.LINHA * 1.3
        for f in ilha:
            f.material_index = 1 if marca else 0
    bm.to_mesh(me)
    bm.free()


def marcas_d():
    """Coluna de resultados com valor (marca de número, 1,4× mais grossa) no lugar da célula cheia: no fosco a célula
    cheia de tinta vira tecla escura (a maior massa escura do painel)."""
    def celula(bm, r, c, y, e, **_):
        (a, b), (lo, hi) = bl._cols()[c], bl._rows()[r]
        p = bl.LINHA / 2 + 0.0012
        w = (b - a - 2 * p) * 0.66
        geo.caixa(bm, (b - p - w / 2, y, (lo + hi) / 2), (w, e, bl.BARRA * 1.4))

    bl._celula = celula


def preenchimento(bm):
    """Célula preenchida = tinta clara opaca atrás da marca de valor (ficha R3); a vazia é só o fosco."""
    y, e = bl._face(-1, TINTA_FORA)
    for r, lo_hi in enumerate(bl._rows()):
        for c, _ in enumerate(bl._cols()):
            cheia = c == len(bl.COL_PESOS) - 1 or (r < len(bl.VALORES) and bl.VALORES[r][c])
            if cheia and (r < 2 or not VAZIAS):
                (a, b), (lo, hi) = bl._cols()[c], lo_hi
                # célula inteira, sem vão: o filete é impresso por cima (com vão, a grade de retângulos lia teclado)
                geo.caixa(bm, ((a + b) / 2, y, (lo + hi) / 2), (b - a, e, hi - lo))


VAZIAS = False


def vazias():
    """Metade das células sem valor: linhas 3–5 sem marca e a coluna de resultados só nas duas primeiras."""
    global VAZIAS
    VAZIAS = True
    bl.VALORES = bl.VALORES[:2] + ((0.0, 0.0, 0.0),) * 3
    celula = bl._celula
    bl._celula = lambda bm, r, c, y, e, **kw: celula(bm, r, c, y, e, **kw) if r < 2 else None


def montar(var, tamanho, preencher=False):
    v = aparencia.VARIANTES[var]
    v['vidro_borda'] = {**v['vidro'], 'rug': BORDA_RUG, 'coat': 0.0}
    comum.cena_nova()
    pecas = bl.construir()
    for nome in ('macro', 'cursor'):
        bpy.data.objects.remove(bpy.data.objects[nome])
    uso = aparencia.aplicar(var)
    _obj('cabecalho', cabecalho, 'verde')
    larg = barra_formula(tamanho)
    reatribuir()
    if preencher:
        _obj('preench', preenchimento, 'tinta')
        separar_marcas()
    return pecas, uso, larg


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    opc = {a[2:].split('=')[0]: (a.split('=', 1)[1] if '=' in a else True) for a in args if a.startswith('--')}
    bl.GRAV_LADO = int(opc.get('grav', -1))
    if 'preench' in opc:
        bl.GRAV_FORA = MARCA_FORA
    if 'marcas-d' in opc:
        marcas_d()
    if 'vazias' in opc:
        vazias()
    import exportar

    for var in [a for a in args if not a.startswith('--')] or ['fosco']:
        for mat in ('vidro', 'gravacao', 'verde', 'tinta', 'marca'):  # --vidro=trans:0.85,rug:0.4,base:#c9ccc8 (voltas de ajuste)
            for kv in filter(None, str(opc.get(mat, '')).split(',')):
                k, v = kv.split(':')
                aparencia.VARIANTES[var][mat][k] = v if v.startswith('#') else float(v)
        _, uso, larg = montar(var, float(opc.get('texto', 0.0068)), 'preench' in opc)
        print('APARENCIA', var, uso, 'texto_largura_mm', round(larg * 1000, 1))
        print('EXPORTADO', exportar.exportar(f"prova-{var}{opc.get('sufixo', '')}"))
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(comum.RAIZ, '3d/blend/props/financeiro_v7_prova-material-c1.blend'))


if __name__ == '__main__':
    main()
