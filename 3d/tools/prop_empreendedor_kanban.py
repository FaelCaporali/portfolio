"""E5 `kanban`: quadro kanban físico de mesa, em retrato (a faixa livre ao lado da cabeça é estreita).

Moldura de carvalho (quatro barras chanfradas, tons de tábua diferentes), painel branco fosco rebaixado 2,5 mm, três
colunas marcadas por fita gráfica e a linha do cabeçalho; cabeçalhos de cartolina lisos (o texto vira canvas depois).
Post-its de três cores dessaturadas: só a faixa de cola fica rente ao painel; a borda de baixo e os cantos levantam
(papel de verdade), cada um com giro e curvatura próprios. Um post-it está no meio do caminho entre "fazendo" e
"feito", atravessado na fita e mais solto. O quadro fica de pé em dois pés de madeira com rasgo, inclinado 7° para
trás, com a bandeja de marcador na base. Materiais: quadro (madeira, painel, fita, marcador; rug 0,5) e papel
(post-its e cabeçalhos; rug 0,8, dupla face). Espaço da peça: Z para cima, frente para −Y.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import prop_empreendedor_base as B

W, H, FW, FD = 0.052, 0.094, 0.0038, 0.0050         # moldura: largura, altura, barra, profundidade
S = 0.0110                                           # lado do post-it
CQ = {'carvalho': '#b3895c', 'painel': '#dedbd3', 'fita': '#2d2f33', 'pe': '#8e6843', 'marcador': '#26282c',
      'tampa': '#3d5566', 'cartolina': '#ebe7de', 'amarelo': '#d4c37f', 'salvia': '#a1b49b', 'rosa': '#cf9f98'}
INCL = Matrix.Translation((0, 0, 0.004)) @ Matrix.Rotation(math.radians(-7), 4, 'X')
XI = W / 2 - FW                                      # meia largura interna
ZC = H - FW - 0.0085                                 # linha do cabeçalho
COL = [-2 * XI / 3, 0.0, 2 * XI / 3]                 # centros das colunas
LINHAS = [-XI / 3, XI / 3]
# (coluna, linha, cor); linha 0 no alto. A fazer: 4; fazendo: 2; feito: 2; e o que está mudando de coluna.
POSTITS = [(0, 0, 'salvia'), (0, 1, 'amarelo'), (0, 2, 'rosa'), (0, 3, 'amarelo'), (1, 0, 'rosa'),
           (1, 1, 'salvia'), (2, 0, 'amarelo'), (2, 1, 'salvia')]


def _tom(hexcor, k):
    h = hexcor.lstrip('#')
    return '#' + ''.join('%02x' % max(0, min(255, int(int(h[j:j + 2], 16) * k))) for j in (0, 2, 4))


def _peca(bm, tam, centro, cor, bev=0.0008, seg=2, mapa=INCL):
    B.pintar(bm, B.anexar(bm, B.caixa(*tam, bev, seg), lambda p: mapa @ (p + Vector(centro))), cor)


def postit(bm, cx, ztop, cor, giro, i, solto=1.0):
    """Folha 4 × 5: faixa de cola (topo 28 %) rente; a base e os cantos levantam para a câmera (−Y)."""
    nu, nv = 4, 5
    L0 = (0.00045 + 0.0005 * B.hash01(i, 1.7)) * solto
    L1 = (0.0006 + 0.0006 * B.hash01(i, 4.2)) * solto
    rot = Matrix.Rotation(giro, 3, 'Y')
    G = []
    for j in range(nv):
        vn = j / (nv - 1)
        linha = []
        for k in range(nu):
            un = 2 * k / (nu - 1) - 1
            lev = L0 * max(0.0, (vn - 0.28) / 0.72) ** 2 + L1 * abs(un) ** 1.6 * vn ** 2.2
            q = rot @ Vector((un * S / 2, 0, -vn * S))
            linha.append(bm.verts.new(INCL @ (Vector((cx, -0.00012 - 0.00004 * i - lev, ztop)) + q)))
        G.append(linha)
    fs = [bm.faces.new((G[j][k], G[j][k + 1], G[j + 1][k + 1], G[j + 1][k])) for j in range(nv - 1)
          for k in range(nu - 1)]
    B.pintar(bm, fs, _tom(CQ[cor], 0.96 + 0.08 * B.hash01(i, 9.1)))


def kanban(mats):
    quadro, papel = mats('quadro', 0.0, 0.5), mats('papel', 0.0, 0.8, double=True)
    bm = bmesh.new()
    for n, (tam, c) in enumerate((((W, FD, FW), (0, 0, H - FW / 2)), ((W, FD, FW), (0, 0, FW / 2)),
                                  ((FW, FD, H - 2 * FW + 0.0004), (-W / 2 + FW / 2, 0, H / 2)),
                                  ((FW, FD, H - 2 * FW + 0.0004), (W / 2 - FW / 2, 0, H / 2)))):
        _peca(bm, tam, c, _tom(CQ['carvalho'], 0.9 + 0.2 * B.hash01(n, 3.3)), 0.0009)
    _peca(bm, (2 * XI + 0.001, 0.0016, H - 2 * FW + 0.001), (0, 0.0008, H / 2), CQ['painel'], 0.0003, 1)
    for x in LINHAS:                                  # fita das colunas e do cabeçalho
        _peca(bm, (0.0011, 0.0003, ZC - FW), (x, -0.00015, (ZC + FW) / 2), CQ['fita'], 0.0001, 1)
    _peca(bm, (2 * XI, 0.0003, 0.0011), (0, -0.00015, ZC), CQ['fita'], 0.0001, 1)
    _peca(bm, (0.044, 0.0075, 0.0018), (0, -FD / 2 - 0.0036, 0.0036), CQ['carvalho'], 0.0005)   # bandeja
    _peca(bm, (0.044, 0.0012, 0.0024), (0, -FD / 2 - 0.0068, 0.0050), CQ['carvalho'], 0.0004)
    marc = [(0, 0), (0.0014, 0), (0.0017, 0.0012), (0.0017, 0.016), (0.0018, 0.0162), (0.0018, 0.0222),
            (0.0012, 0.0236), (0, 0.0238)]
    fs = B.torno(bm, marc, 8, mapa=lambda p: INCL @ Vector((p.z - 0.013, -FD / 2 - 0.0035 + p.x, 0.0063 + p.y)))
    B.pintar(bm, fs, lambda f: CQ['tampa'] if (INCL.inverted() @ f.calc_center_median()).x > 0.0028
             else CQ['marcador'])
    for x in (-0.018, 0.018):                         # pés com rasgo (não inclinam)
        _peca(bm, (0.011, 0.024, 0.0065), (x, 0.001, 0.00325), CQ['pe'], 0.0012, 2, Matrix())
    bm_p = bmesh.new()
    for i, x in enumerate(COL):                       # cabeçalhos de cartolina, lisos
        _peca(bm_p, (0.0112, 0.0003, 0.0046), (x, -0.0002, ZC + 0.0043), CQ['cartolina'], 0.0001, 1)
    for i, (c, r, cor) in enumerate(POSTITS):
        x = COL[c] + 0.0012 * (B.hash01(i, 2.2) - 0.5)
        postit(bm_p, x, ZC - 0.0025 - r * (S + 0.0022), cor, 0.07 * (B.hash01(i, 5.5) - 0.5), i)
    postit(bm_p, LINHAS[1] + 0.0012, ZC - 0.0025 - 2 * (S + 0.0022) - 0.0008, 'rosa', 0.14, 8, 1.9)
    return [B.objeto('kanban_quadro', bm, quadro, ang=40), B.objeto('kanban_papel', bm_p, papel, ang=60)]
