"""Blockout do adereço do financeiro, v7 (modelador; ESTUDIO §2 E2 e §3), correção 1 do conceito.

Massas em escala e posição reais no espaço do busto, pela BÍBLIA §4 (números lá; desvio aqui = motivo no HANDOFF).
C1: lâmina do diretor portada do estudo (`estudo_lamina.py`, candidata a2.c2.tk.ab.cl): retrato 0,080 × 0,104, tabela
aberta de filetes com valores e só a coluna de resultados cheia, macro em tokens + cursor de ouro; e as correções do
laudo que são da forma: bandeira quase plana, anéis de fixação no fio, grampo em L com parafuso Allen, moedas com orla.
A versão da E2 está em `historico/blockout_e2.py` (o estudo do diretor depende dela).

Frame local da âncora (Blender): X = largura, −Y = frente (voltada para o rosto e a câmera), Z = altura. A âncora
`financeiro` (Empty, raiz da peça) fica em ANCORA_GLB do glb com giro Y do glb = GIRO_Y e escala uniforme ESCALA.
Materiais só de VALOR (notan da BÍBLIA §5; rugosidade 0,8): o lookdev troca o conteúdo pelo nome (vidro, gravacao,
ouro, aco). Douração (filete duplo, moldura, alça, cursor, total) na face da FRENTE; gravação no VERSO (E3, C1).
Uso: de construir.py, `blockout.construir()`; direto: `blender -b --python blockout.py -- [pasta] [--sem-vistas]
[--sem-moedas] [--prova=<rótulo>] [--ancora=x,y,z] [--giro=g] [--escala=s]`.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..'))
sys.path.insert(0, AQUI)
import blockout_geo as geo  # noqa: E402
import comum  # noqa: E402

COLECAO = 'Peca'
# C1: âncora recuada para o plano da orelha (E2: (0,138; 0,172; 0,040) −25°). Com a peça rígida na cabeça e arrasto de
# ±38°, é o compromisso medido no poses_sim (HANDOFF C1 modelador): olhar sem tocar o cabelo, arrasto à direita inteiro
# na tela, arrasto à esquerda por cima do cabelo de trás (não do rosto); margem de 24 px no 1024 em repouso.
# Site (r2, 0,170/−0,090/−15°): no arrasto à direita 8,8 % ficava atrás do rosto, junto do olho; −0,080/−10° troca
# isso por 1–2 % ("atrás da cabeça" é proibido; cruzar o cabelo de trás, sutil, é permitido).
ANCORA_GLB, GIRO_Y, ESCALA = (0.168, 0.172, -0.080), -10.0, 1.0
W, H, T, CHANFRO = 0.080, 0.104, 0.012, 0.002  # vidro float 10 mm (scan ~1,2×); chanfro 2 mm (E3: 0,8 some)
GRAV_FORA, GRAV_DENTRO = 0.00015, 0.00025  # placa da gravação: sai 0,15 mm da face, entra 0,25 mm
GRAV_LADO = 1  # +1 = verso (E3: a gravação vista através do vidro é o que o faz ler vidro); −1 = frente
MOEDAS = True  # presença em repouso é decisão do Fael (BÍBLIA §10.3); sem moedas, o total geral se doura
# Tabela (BÍBLIA §4, C1): filetes de 1,2 mm, coluna A 1,35×, 5 linhas (4 de dados + totais), aberta nas bordas.
LINHA, COL_PESOS, LINHAS = 0.0012, (1.35, 1.0, 1.0, 1.0), 5
GRADE = {'w': 0.0672, 'h': 0.0579, 'zc': -0.0149}
BARRA = 0.0022  # altura da marca de valor (rótulo à esquerda na coluna A, número à direita nas de dados)
VALORES = ((0.62, 0.70, 0.48), (0.45, 0.52, 0.66), (0.70, 0.40, 0.58), (0.38, 0.61, 0.44), (0.0, 0.78, 0.72))
MACRO = {'alt': 0.0032, 'passo': 0.0062, 'topo': 0.009, 'recuo': 0.008}
TOKENS = ((0.010, 0.016, 0.006), (0.008, 0.012, 0.005, 0.014), (0.011, 0.007, 0.013), (0.009, 0.010))
TOKEN_RECUOS, TOKEN_VAO, CURSOR = (0, 1, 1, 0), 0.0016, (0.0013, 0.0042)
FILETES, FILETE_ALT, MOLDURA, ALCA = (0.0085, 0.0112), 0.0011, 0.0012, 0.0034
# Fio: Ø 3,4 mm; anéis de fixação Ø 5 × 2,5 mm chanfrados (as esferas de Ø 6,4 liam colar de contas/ábaco, laudo).
# O nó 0 apoia o fio NA borda (sem vão, sem enterrar); os outros alturas da BÍBLIA.
FIO_R, ANEL, NOS_ALT, NO_MASTRO = 0.0017, (0.005, 0.0025, 0.0004), (0.0017, 0.003, 0.014, 0.025), 0.036
MASTRO_X, MASTRO_R, MASTRO_ALT = 0.036, 0.0017, 0.050
# Grampo: chapa de 1,5 mm dobrada sobre a quina (perfil em L de 12 × 12 mm, 5 mm sobre cada face), chanfro 0,5 mm,
# parafuso Allen Ø 4 mm na frente (o cubo liso da E2 lia "tampa").
GRAMPO = {'chapa': 0.0015, 'perna': 0.012, 'aba': 0.005, 'chanfro': 0.0005}
PARAFUSO = {'d': 0.004, 'alt': 0.0012, 'chanfro': 0.0003, 'sext': 0.001, 'prof': 0.0008}
# Bandeira: chapa quase plana (profundidade ≤ 1 mm: com 3 mm a face de dentro acendia e lia copo/calha); a onda fica
# no contorno (bordas de cima e de baixo); a ponta livre afina 35 %.
BANDEIRA = {'L': 0.022, 'A': 0.014, 'chapa': 0.0015, 'prof': 0.0008, 'onda_z': 0.0016, 'afina': 0.35}
# Moedas: Ø 27 × 2,6 mm; orla (listel) de 0,8 mm em relevo de 0,3 mm e campo levemente côncavo nas que mostram a face.
MOEDA = {'R': 0.0135, 'E': 0.0026, 'orla': 0.0008, 'relevo': 0.0003, 'concavo': 0.00012, 'quina': 0.0003}
# pilha à frente do plano do vidro; topo 5,5 mm abaixo dele (C1: com 4 mm e a âncora recuada o vão no 360 era de
# 1,9 px CSS, abaixo dos 2 px da BÍBLIA §9.4)
MOEDA_Y, PILHA_VAO = -0.004, 0.0055
PILHA_DESVIO = ((0.0, 0.0), (0.0005, -0.0003), (-0.00035, 0.00045), (0.0003, 0.0002))  # ≤ 0,6 mm
ENCOSTO_GRAUS, ENCOSTO_DIR = 25.0, (0.5, 0.87)  # 5ª moeda tombada na quina da pilha, face para a câmera (E2)
VALOR = {'vidro': 0.17, 'gravacao': 0.46, 'aco': 0.46, 'ouro': 0.86}  # sRGB do notan


def _mat(nome):
    return geo.material(nome, VALOR[nome])


def _obj(nome, preencher, mat, raiz, **kw):
    return geo.objeto(nome, preencher, _mat(mat), raiz, COLECAO, **kw)


# ------------------------------------------------------------------------------------------------ tabela
def _face(lado=None, fora=GRAV_FORA, dentro=GRAV_DENTRO):
    """(y do centro, espessura) de uma placa rente a uma face do vidro (lado −1 frente, +1 verso)."""
    lado = GRAV_LADO if lado is None else lado
    return lado * (T / 2 - (dentro - fora) / 2), fora + dentro


def _cols():
    g, tot = GRADE, sum(COL_PESOS)
    x, out = -g['w'] / 2, []
    for p in COL_PESOS:
        out.append((x, x + g['w'] * p / tot))
        x = out[-1][1]
    return out


def _colunas():
    return [(a + b) / 2 for a, b in _cols()]


def _rows():
    pz, topo = GRADE['h'] / LINHAS, GRADE['zc'] + GRADE['h'] / 2
    return [(topo - pz * (r + 1), topo - pz * r) for r in range(LINHAS)]


def _celula(bm, r, c, y, e, pad=LINHA / 2 + 0.0008):
    (a, b), (lo, hi) = _cols()[c], _rows()[r]
    geo.caixa(bm, ((a + b) / 2, y, (lo + hi) / 2), (b - a - 2 * pad, e, hi - lo - 2 * pad))


def grade(bm):
    """Gravação da tabela: filetes abertos (livro-razão), marcas de valor e a coluna de resultados preenchida."""
    y, e = _face()
    cols, rows = _cols(), _rows()
    x0, x1, topo, fundo = cols[0][0], cols[-1][1], rows[0][1], rows[-1][0]
    for _, hi in rows:  # topo + divisões; a base da tabela é o filete duplo dos totais
        geo.caixa(bm, ((x0 + x1) / 2, y, hi), (x1 - x0 + LINHA, e, LINHA))
    for a, _ in cols[1:]:
        geo.caixa(bm, (a, y, (topo + fundo) / 2), (LINHA, e, topo - fundo))
    pad = LINHA / 2 + 0.0012
    for r, (lo, hi) in enumerate(rows):
        for c, (a, b) in enumerate(cols[:3]):
            w = (b - a - 2 * pad) * VALORES[r][c]
            if w:
                geo.caixa(bm, (a + pad + w / 2 if c == 0 else b - pad - w / 2, y, (lo + hi) / 2), (w, e, BARRA))
    for r in range(LINHAS - (0 if MOEDAS else 1)):
        _celula(bm, r, len(COL_PESOS) - 1, y, e)


def _linhas_macro():
    m, x0 = MACRO, -GRADE['w'] / 2
    for i, (rec, toks) in enumerate(zip(TOKEN_RECUOS, TOKENS)):
        yield H / 2 - m['topo'] - m['alt'] / 2 - i * m['passo'], x0 + rec * m['recuo'], toks


def macro(bm):
    """Macro VBA em tokens de palavra com recuo (linhas de código, sem letra)."""
    y, e = _face()
    for z, x, toks in _linhas_macro():
        for t in toks:
            geo.caixa(bm, (x + t / 2, y, z), (t, e, MACRO['alt']))
            x += t + TOKEN_VAO


def cursor(bm):
    """Cursor de ouro na frente, depois do último token da última linha (o "agora" do código)."""
    z, x, toks = list(_linhas_macro())[-1]
    x += sum(toks) + TOKEN_VAO * len(toks)
    # folha de ouro sobre o vidro: um quadrilátero rente à frente (caixa de 12 tri em 2,7 × 7,8 px reprovava)
    y, w, h = -T / 2 - 0.00005, CURSOR[0] / 2, CURSOR[1] / 2
    vs = [bm.verts.new((x + CURSOR[0] / 2 + dx, y, z + dz)) for dx, dz in ((-w, -h), (w, -h), (w, h), (-w, h))]
    bm.faces.new(vs)


def totais(bm):
    """Douração na frente: filete duplo do contador, moldura da célula ativa (total geral) e alça de preenchimento."""
    zt = sum(_rows()[-1]) / 2
    (a, b), (lo, hi) = _cols()[-1], _rows()[-1]
    y, e = _face(-1, 0.0003)
    for dz in FILETES:
        geo.caixa(bm, (0, y, zt - dz), (GRADE['w'], e, FILETE_ALT))
    for cx, cz, dx, dz in (((a + b) / 2, hi, b - a + MOLDURA, MOLDURA), ((a + b) / 2, lo, b - a + MOLDURA, MOLDURA),
                           (a, zt, MOLDURA, hi - lo), (b, zt, MOLDURA, hi - lo)):
        geo.caixa(bm, (cx, y, cz), (dx, e, dz))
    ya, ea = _face(-1, 0.0006)
    geo.caixa(bm, (b, ya, lo), (ALCA, ea, ALCA))


def total(bm):
    """Sem moedas: o total geral dourado na face da frente (o resultado escrito no material)."""
    y, e = _face(-1, 0.0003)
    _celula(bm, LINHAS - 1, len(COL_PESOS) - 1, y, e)


# ------------------------------------------------------------------------------------------------ ouro e aço
def pontos_fio():
    xs = _colunas() + [MASTRO_X]
    return [Vector((x, 0.0, H / 2 + a)) for x, a in zip(xs, list(NOS_ALT) + [NO_MASTRO])]


def fio(bm):
    """Fio de tendência no plano do vidro, nó a nó até o mastro; anel de fixação em cada nó (eixo na bissetriz)."""
    pts = pontos_fio()
    for a, b in zip(pts, pts[1:]):
        geo.haste(bm, a, b, FIO_R, 12)
    d, comp, ch = ANEL
    for i, p in enumerate(pts):
        if i == len(pts) - 1:
            eixo = Vector((0, 0, 1))  # no mastro, o anel abraça o mastro
        else:
            ent = (p - pts[i - 1]).normalized() if i else Vector()
            eixo = ent + (pts[i + 1] - p).normalized()
        geo.anel(bm, p, eixo, d, comp, ch, 16)


def _grampo(bm):
    g, p = GRAMPO, GRAMPO['chapa']
    xo, zo, n, f = W / 2 + p, H / 2 + p, g['perna'], g['aba']
    pts = [(xo - n, zo), (xo - n, zo - f), (xo - f, zo - f), (xo - f, zo - n), (xo, zo - n), (xo, zo)]
    antes = set(bm.edges)
    geo.prisma_xz(bm, pts, -T / 2 - p, T / 2 + p)
    novas = [e for e in bm.edges if e not in antes]
    bmesh.ops.bevel(bm, geom=novas, offset=g['chanfro'], offset_type='OFFSET', segments=2, profile=0.5,
                    affect='EDGES', clamp_overlap=True)
    return xo - f / 2, zo - f / 2


def _parafuso(bm, x, z):
    """Cabeça Allen Ø 4 mm na chapa da frente, com soquete sextavado (o eixo sai para −Y)."""
    q, s = PARAFUSO, PARAFUSO['sext']
    r, h, c = q['d'] / 2, q['alt'], q['chanfro']
    perfil = [(0, 0), (r, 0), (r, h - c), (r - c, h), (s, h), (s, h - q['prof']), (0, h - q['prof'])]

    def sext(k, rr):  # anel do soquete: 24 pontos sobre o hexágono de apótema s
        if abs(rr - s) > 1e-9:
            return rr
        t = (math.degrees(2 * math.pi * k / 24) % 60) - 30
        return s / math.cos(math.radians(t))

    base = Matrix.Translation(Vector((x, -T / 2 - GRAMPO['chapa'], z))) @ geo.eixo_para((0, -1, 0))
    geo.revolucao(bm, perfil, 24, base, sext)


def mastro(bm):
    """Aço: grampo de canto (único fixador), parafuso e mastro; um objeto só, nada se move."""
    px, pz = _grampo(bm)
    _parafuso(bm, px, pz)
    z0, z1, c = H / 2 + GRAMPO['chapa'], H / 2 + MASTRO_ALT, 0.0004
    perfil = [(0, z0), (MASTRO_R, z0), (MASTRO_R, z1 - c), (MASTRO_R - c, z1), (0, z1)]
    geo.revolucao(bm, perfil, 16, Matrix.Translation(Vector((MASTRO_X, 0, 0))))


def bandeira(bm):
    """Chapa içada no topo do mastro, voando para −X (de volta ao rosto): contorno ondulado, face quase plana."""
    b = BANDEIRA
    topo = H / 2 + MASTRO_ALT - 0.0015
    bmesh.ops.create_grid(bm, x_segments=14, y_segments=3, size=0.5)
    for v in bm.verts:
        u, s = v.co.x + 0.5, v.co.y  # u: 0 no mastro, 1 na ponta; s: −0,5 embaixo, +0,5 em cima
        onda = math.sin(u * math.pi * 1.6) * u
        z = topo - b['A'] / 2 + s * b['A'] * (1 - b['afina'] * u) - 0.06 * b['A'] * u + b['onda_z'] * onda
        v.co = Vector((MASTRO_X - MASTRO_R - u * b['L'], b['prof'] * onda, z))


def construir(moedas=None):
    """Monta a coleção `Peca` (raiz `financeiro` + partes) e devolve as malhas."""
    global MOEDAS
    MOEDAS = MOEDAS if moedas is None else moedas
    col = bpy.data.collections.get(COLECAO) or bpy.data.collections.new(COLECAO)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    raiz = bpy.data.objects.new('financeiro', None)
    col.objects.link(raiz)
    raiz.location = comum.gl_para_bl(ANCORA_GLB)
    raiz.rotation_euler = (0, 0, math.radians(GIRO_Y))
    raiz.scale = (ESCALA,) * 3
    vidro = geo.duro(_obj('vidro', lambda bm: geo.caixa(bm, (0, 0, 0), (W, T, H)), 'vidro', raiz), CHANFRO)
    aco = _obj('mastro', mastro, 'aco', raiz, angulo=35)
    aco.modifiers.new('normais', 'WEIGHTED_NORMAL').keep_sharp = True
    bnd = _obj('bandeira', bandeira, 'ouro', raiz, liso=True)
    sol = bnd.modifiers.new('chapa', 'SOLIDIFY')
    sol.thickness, sol.offset = BANDEIRA['chapa'], 0.0
    partes = [vidro, _obj('grade', grade, 'gravacao', raiz), _obj('macro', macro, 'gravacao', raiz),
              _obj('cursor', cursor, 'ouro', raiz), _obj('totais', totais, 'ouro', raiz),
              _obj('fio', fio, 'ouro', raiz, angulo=35), aco, geo.duro(bnd, 0.0003, 1)]
    if not MOEDAS:
        return partes + [_obj('total', total, 'ouro', raiz)]
    import blockout_moedas

    return partes + blockout_moedas.construir(sys.modules[__name__], raiz)


if __name__ == '__main__':
    import blockout_cli

    blockout_cli.main(sys.modules[__name__])
