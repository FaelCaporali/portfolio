"""Forma do adereço do financeiro, v7 (modelador; ESTUDIO NUCLEO §2, ficha de produção 24/09).

O conceito c1 (`blockout.py`, `blockout_moedas.py` antigos) foi SUPERADO pela ficha: lâmina livro-razão, macro em
tokens sem letra, cabeçalho verde REMOVIDO, moedas longe da linha. Este módulo escreve a forma NOVA (R1–R7):
painel único com UV limpa para o atlas (cabeçalho, letras A B C, fórmula e grade são textura — `atlas.py`, não
malha), linha de tendência em aço (NÃO ouro: R5 corrige o c1), mastro + bandeira + moedas plantadas na pilha (R6,
antes vetado no c1). Reaproveitado do c1 (ESTUDIO §1, retorno dos dailies): moeda com quina 0,3 mm e orla
(`blockout_moedas.perfil`), bandeira de chapa quase plana com onda no contorno, juntas do fio (anel na bissetriz),
raiz na âncora, `comum.py` (câmera do site) e `construir.py`/`exportar.py` da cadeia. `blockout.py` e
`blockout_moedas.construir` (a montagem antiga) ficam no lugar, sem uso, como histórico (não apagar).

Frame local da âncora (Blender, igual ao c1): X = largura, −Y = frente (rosto/câmera), Z = altura. Painel centrado
na origem da âncora. Uso: de `construir.py`, `aplicar()`; direto, `blender -b --python forma.py -- [pasta]`.
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
import atlas  # noqa: E402
import blockout_geo as geo  # noqa: E402
import blockout_moedas as moedas_mod  # noqa: E402
import comum  # noqa: E402

COLECAO = 'Peca'
# Composição medida na v7 (FICHA §Composição): 0 % atrás da cabeça, 46 px de margem à direita no 1440.
ANCORA_GLB, GIRO_Y, TILT_X, ESCALA = (0.138, 0.172, 0.040), -25.0, 6.0, 1.0

# R1: lâmina retrato 78 × 100 mm, 9 mm de espessura, cantos raio 3 mm, chanfro 1,5 mm.
W, H, T = 0.078, 0.100, 0.009
RAIO_CANTO, CANTO_SEGS, CHANFRO_PAINEL = 0.003, 6, 0.0015

# R5: fio Ø 2,4 mm (faixa 2,2–2,6), anéis de junta nos 2 nós internos dos 3 segmentos.
FIO_R, ANEL = 0.0012, (0.004, 0.002, 0.0003)
# R5: mastro Ø 1,6 mm, altura 0,045 m; pé plantado acima do fim da linha, na pilha de moedas.
MASTRO_R, MASTRO_ALT = 0.0008, 0.045
# Dailies r1 ponto 1 (eliminatório): no 1440 (~2100 px/m) só sobram ~8 mm de margem à direita do painel; a pilha
# fica SOBRE o canto superior direito do painel (parte por cima da lâmina, não jogada para fora dela) e o pé do
# mastro pousa ~12 mm acima do topo do painel (faixa pedida: 10–15 mm) — não mais 35+ mm como na v6/c1.
MASTRO_X, Z_PE = W / 2 - 0.30 * 0.011, H / 2 + 0.012 + 4 * 0.002 - 0.30 * 0.002
# R5: bandeirola 22 × 14 mm, chapa 0,8 mm (≤ 1 mm: com mais a face de dentro acende e lê copo — lição do c1).
BANDEIRA = {'L': 0.022, 'A': 0.014, 'chapa': 0.0008, 'prof': 0.0008, 'onda_z': 0.0016, 'afina': 0.35}
# R6: moedas Ø 22 mm (faixa 20–24), 2 mm cada; quina 0,3 mm e orla reaproveitadas do c1 (`blockout_moedas.perfil`).
MOEDA = {'R': 0.011, 'E': 0.002, 'orla': 0.0008, 'relevo': 0.0003, 'concavo': 0.00012, 'quina': 0.0003}
N_MOEDAS = 4
DESVIOS = ((0.0, 0.0), (0.0005, -0.0003), (-0.00035, 0.00045), (0.0002, 0.0002))  # ≤ 0,6 mm (R6)
# Dailies r1 ponto 3: a câmera do site olha a pilha de baixo/de lado (leem arruela); uma moeda ENCOSTADA, face
# quase virada para a câmera (35–45° da vertical), mostra relevo/serrilha sem tirar o mastro da pilha.
ENCOSTO_GRAUS = 40.0

VALOR = {'vidro': 0.17, 'aco': 0.46, 'ouro': 0.86}  # sRGB do notan; lookdev troca o conteúdo pelo nome


def _mat(nome):
    return geo.material(nome, VALOR[nome])


def _obj(nome, preencher, mat, raiz, **kw):
    return geo.objeto(nome, preencher, _mat(mat), raiz, COLECAO, **kw)


# ------------------------------------------------------------------------------------------------ painel (R1)
def _retangulo_arred(w, h, r, segs):
    hw, hh = w / 2, h / 2
    cantos = ((hw - r, hh - r, 0, 90), (-hw + r, hh - r, 90, 180),
              (-hw + r, -hh + r, 180, 270), (hw - r, -hh + r, 270, 360))
    pts = []
    for cx, cz, a0, a1 in cantos:
        for k in range(segs):
            a = math.radians(a0 + (a1 - a0) * k / segs)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def _atlas_png():
    """Gera o atlas-rascunho com o python3 do sistema (Pillow não existe no python do Blender)."""
    import subprocess

    caminho = os.path.join(AQUI, 'atlas_painel.png')
    subprocess.run(['python3', os.path.join(AQUI, 'atlas.py'), caminho], check=True)
    return caminho


def _mat_vidro_com_atlas():
    m = _mat('vidro')
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    caminho = _atlas_png()
    img = bpy.data.images.load(caminho, check_existing=True)
    tex = nt.nodes.get('AtlasPainel') or nt.nodes.new('ShaderNodeTexImage')
    tex.name, tex.image, tex.interpolation = 'AtlasPainel', img, 'Linear'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    return m


def _painel(raiz):
    """Lâmina única (R1) com UV limpa: face da frente mapeada 1:1 no atlas (cabeçalho/letras/fórmula/grade, R2–R4);
    as demais faces (verso, cantos, chanfro) apontam para a margem neutra do atlas."""
    pts = _retangulo_arred(W, H, RAIO_CANTO, CANTO_SEGS)
    xs, zs = [p[0] for p in pts], [p[1] for p in pts]
    xmin, xmax, zmin, zmax = min(xs), max(xs), min(zs), max(zs)
    bm = bmesh.new()
    frente = [bm.verts.new((x, -T / 2, z)) for x, z in pts]
    tras = [bm.verts.new((x, T / 2, z)) for x, z in pts]
    f_frente = bm.faces.new(frente)
    bm.faces.new(list(reversed(tras)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((frente[j], frente[i], tras[i], tras[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    uv = bm.loops.layers.uv.verify()
    for loop in f_frente.loops:
        x, _, z = loop.vert.co
        loop[uv].uv = ((x - xmin) / (xmax - xmin), (z - zmin) / (zmax - zmin))
    for f in bm.faces:
        if f is f_frente:
            continue
        for loop in f.loops:
            loop[uv].uv = (0.5, 0.012)  # margem inferior do atlas: fundo neutro, sem texto
    me = bpy.data.meshes.new('painel')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(_mat_vidro_com_atlas())
    o = bpy.data.objects.new('painel', me)
    bpy.data.collections[COLECAO].objects.link(o)
    o.parent = raiz
    return geo.duro(o, CHANFRO_PAINEL, segs=3, angulo=30)


# ------------------------------------------------------------------------------------------------ linha (R5)
def _fracao_linha(r):
    """Fração da altura do painel (do topo) até o centro da linha `r` da grade do atlas (0 = 1ª linha, logo
    abaixo da fórmula; ROWS−1 = última linha, embaixo) — generaliza `atlas.fracao_linha_ativa()` (que só dá a
    célula ativa) para qualquer linha, sem tocar em atlas.py (dailies r2: é módulo do lookdev)."""
    y0 = atlas.GRID_TOP + r * (atlas.GRID_BOT - atlas.GRID_TOP) / atlas.ROWS
    y1 = y0 + (atlas.GRID_BOT - atlas.GRID_TOP) / atlas.ROWS
    return (y0 + y1) / 2 / atlas.H


def _linha(raiz, pts):
    """N-1 segmentos (3–4, R5) com junta na bissetriz em cada nó interno (técnica reaproveitada do c1,
    `blockout.fio`). `pts`: lista de pontos (x, y, z) do nascimento até o pé do mastro."""
    pts = [Vector(p) for p in pts]

    def preencher(bm):
        for a, b in zip(pts, pts[1:]):
            geo.haste(bm, a, b, FIO_R, 16)
        for i in range(1, len(pts) - 1):
            eixo = (pts[i] - pts[i - 1]).normalized() + (pts[i + 1] - pts[i]).normalized()
            geo.anel(bm, pts[i], eixo, ANEL[0], ANEL[1], ANEL[2], 16)

    return _obj('fio', preencher, 'aco', raiz, angulo=35)


# ------------------------------------------------------------------------------------------------ mastro e bandeira
def _mastro(raiz, pe, alt):
    def preencher(bm):
        c = 0.0003
        perfil = [(0, 0), (MASTRO_R, 0), (MASTRO_R, alt - c), (MASTRO_R - c, alt), (0, alt)]
        geo.revolucao(bm, perfil, 16, Matrix.Translation(Vector(pe)))

    return _obj('mastro', preencher, 'aco', raiz, angulo=35)


def _bandeira(raiz, topo_mastro):
    b = BANDEIRA
    topo = topo_mastro - 0.0015

    def preencher(bm):
        bmesh.ops.create_grid(bm, x_segments=14, y_segments=3, size=0.5)
        for v in bm.verts:
            u, s = v.co.x + 0.5, v.co.y  # u: 0 no mastro, 1 na ponta; s: −0,5 embaixo, +0,5 em cima
            onda = math.sin(u * math.pi * 1.6) * u
            z = topo - b['A'] / 2 + s * b['A'] * (1 - b['afina'] * u) - 0.06 * b['A'] * u + b['onda_z'] * onda
            v.co = Vector((MASTRO_X - MASTRO_R - u * b['L'], b['prof'] * onda, z))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])

    o = _obj('bandeira', preencher, 'ouro', raiz, liso=True)
    sol = o.modifiers.new('chapa', 'SOLIDIFY')
    sol.thickness, sol.offset = b['chapa'], 0.0
    return geo.duro(o, 0.0003, segs=1)


# ------------------------------------------------------------------------------------------------ moedas (R6)
def _moedas(raiz, topo, x0):
    """Pilha de N moedas (quina 0,3 mm em todas; a do topo mostra a face com orla/relevo — técnica do c1,
    `blockout_moedas.moeda`), o mastro planta nela; uma malha só (junta as N em um objeto)."""
    e = MOEDA['E']
    objs = []
    for i in range(N_MOEDAS):
        face = i == N_MOEDAS - 1
        o = moedas_mod.moeda(sys.modules[__name__], f'moeda_{i}', raiz, face)
        dx, dy = DESVIOS[i]
        o.location = (x0 + dx, dy, topo - e * (N_MOEDAS - i - 0.5))
        o.rotation_euler = (0, 0, math.radians(29 * i))
        objs.append(o)

    # Moeda encostada (dailies r1 ponto 3 + r2 ponto 2): gira só em X — a normal da face (originalmente +Z, de
    # cima) inclina para −Y (frente/câmera). Contato físico calculado, não estimado: como a rotação em X não
    # mexe no eixo local X do disco, o ponto de baixo da borda (θ local = −90°) fica em
    # (0, −R·cos a, −R·sin a) relativo ao centro — plantamos esse ponto exatamente na borda-frente do topo da
    # pilha (y = −R, z = topo), o que também deixa o topo da moeda a poucos mm do mastro (y ≈ +R(2cos a−1)) sem
    # nenhum ponto sair do raio R da pilha (a "flutuação para a esquerda" do r2 era o x0 − 0.5·R): 0 mm de
    # excesso, dentro dos 4 mm de folga pedidos.
    a = math.radians(ENCOSTO_GRAUS)
    R = MOEDA['R']
    enc = moedas_mod.moeda(sys.modules[__name__], 'moeda_encostada', raiz, True)
    enc.rotation_euler = (a, 0.0, 0.0)
    enc.location = (x0, R * (math.cos(a) - 1), topo + R * math.sin(a))
    objs.append(enc)

    for o in objs:
        if 'normais' in o.modifiers:
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier='normais')
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = 'moedas'
    return [objs[0]]


# ------------------------------------------------------------------------------------------------ montagem
def construir():
    col = bpy.data.collections.get(COLECAO) or bpy.data.collections.new(COLECAO)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    raiz = bpy.data.objects.new('financeiro', None)
    col.objects.link(raiz)
    raiz.location = comum.gl_para_bl(ANCORA_GLB)
    raiz.rotation_euler = (math.radians(TILT_X), 0.0, math.radians(GIRO_Y))
    raiz.scale = (ESCALA,) * 3

    painel = _painel(raiz)

    # R5 (ficha revista 24/09, daily r2→r3): 4 pontos, na FRENTE do vidro (−Y é a câmera) sobre a grade, sem
    # tocar a borda direita como um toco — sai por cima das células e só entra rente à borda no trecho do mastro.
    Y_LINHA = -T / 2 - 0.002
    z0 = H / 2 - _fracao_linha(atlas.ROWS - 1) * H  # última linha da grade (embaixo à esquerda)
    z2 = H / 2 - _fracao_linha(0) * H  # 1ª linha da grade (saída na borda, abaixo da fórmula e do cabeçalho)
    p0 = (-W / 2 + 0.012, Y_LINHA, z0)
    p2 = (W / 2 + 0.003, Y_LINHA, z2)
    # p1 mais achatado que a metade do caminho (série 12→74: sobe devagar e acelera perto da saída).
    p1 = (p0[0] + 0.55 * (p2[0] - p0[0]), Y_LINHA, p0[2] + 0.25 * (p2[2] - p0[2]))
    p3 = (MASTRO_X, 0.0, Z_PE)  # pé do mastro (mesma âncora usada por `_mastro`), sobe rente à borda até lá
    fio = _linha(raiz, [p0, p1, p2, p3])

    topo_pilha = Z_PE + MOEDA['E'] * 0.3  # o pé do mastro afunda um pouco na moeda do topo ("plantado", R6)
    moedas = _moedas(raiz, topo_pilha, MASTRO_X)
    mastro = _mastro(raiz, (MASTRO_X, 0.0, Z_PE), MASTRO_ALT)
    bandeira = _bandeira(raiz, Z_PE + MASTRO_ALT)

    return [painel, fio, mastro, bandeira] + moedas


def aplicar():
    return construir()


def main():
    pos = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if not a.startswith('--')]
    pasta = os.path.join(comum.RAIZ, pos[0] if pos else '3d/captura/props/financeiro/v7/modelagem')
    comum.cena_nova()
    busto = [o for o in comum.importar_busto() if o.type == 'MESH']
    pecas = construir()
    bpy.context.view_layer.update()
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(comum.RAIZ, '3d/blend/props/financeiro_v7_forma.blend'))
    import exportar

    saida = exportar.exportar('forma')
    print('EXPORTADO', saida)
    zs = [(o.matrix_world @ Vector(c))[2] for o in pecas for c in o.bound_box]
    print('ALTURA_TOTAL_M', round(max(zs) - min(zs), 4), 'RAZAO_CABECA', round((max(zs) - min(zs)) / 0.28, 3))
    for tela in comum.TELAS:
        k = comum.ler_camera_site(tela).get('dsfCaptura', 1)
        comum.camera_site(tela, escala=k)
        comum.render_argila(os.path.join(pasta, f'argila-site-{tela}.png'), pecas + busto)
    comum.vistas_argila(pecas, pasta, 'forma')
    return saida


if __name__ == '__main__':
    main()
