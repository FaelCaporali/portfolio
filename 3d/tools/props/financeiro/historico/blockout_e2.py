"""Blockout do adereço do financeiro, v7 (modelador; ESTUDIO §2 E2 e §3).

Massas primárias em escala e posição reais no espaço do busto, pela BÍBLIA §4 (números lá; desvio aqui = motivo no
HANDOFF). Sem detalhe: orla e serrilha das moedas, parafuso do grampo, cursor da macro, moldura da célula ativa e
gravação em baixo-relevo ficam para a forma final (E5). Chanfro real já aqui (vidro, grampo, moedas): primitiva sem
chanfro é sinal de infantil e o lookdev prova a borda do vidro sobre este blockout (E3).

Frame local da âncora (Blender): X = largura, −Y = frente (voltada para o rosto e a câmera), Z = altura. A âncora
`financeiro` (Empty, raiz da peça) fica em (0,138; 0,172; 0,040) do glb com giro Y do glb = −25°.
Materiais só de VALOR (notan da BÍBLIA §5; rugosidade 0,8, argila): vidro escuro, gravação e aço médios, ouro claro.
Os nomes (vidro, gravacao, ouro, aco) são o contrato com o lookdev, que troca o conteúdo e mantém o nome.
Uso: de construir.py, `blockout.construir()`; direto: `blender -b --python blockout.py -- [pasta] [--sem-vistas]`
grava o .blend da etapa, o glb de laboratório e as vistas (silhueta nas 3 telas, argila na câmera do site, 7 vistas).
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..'))
sys.path.insert(0, AQUI)
import comum  # noqa: E402

COLECAO = 'Peca'
ANCORA_GLB, GIRO_Y = (0.138, 0.172, 0.040), -25.0
W, H, T, CHANFRO = 0.090, 0.098, 0.012, 0.0008  # vidro float 10 mm (scan ~1,2×), chanfro polido
GRADE = {'w': 0.0756, 'h': 0.0549, 'zc': -0.0137, 'cols': 4, 'lins': 4, 'fx': 0.86, 'fz': 0.72}
MACRO = {'alt': 0.0032, 'passo': 0.0062, 'topo': 0.009, 'recuo': 0.008,
         'comps': (0.55, 0.62, 0.45, 0.30), 'recuos': (0, 1, 1, 0)}
GRAV_FORA, GRAV_DENTRO = 0.00015, 0.00025  # placa da gravação: sai 0,15 mm da face, entra 0,25 mm
# Face gravada: −1 = frente (lê com vidro opaco ou transmissivo), +1 = verso (BÍBLIA §5; só lê se a transmissão ler).
GRAV_LADO = -1
FILETES, FILETE_ALT, ALCA = (0.0085, 0.0112), 0.0011, 0.0034
FIO_R, NO_R, NOS_ALT, NO_MASTRO = 0.0017, 0.0032, (0.0, 0.003, 0.014, 0.025), 0.036
MASTRO_X, MASTRO_R, MASTRO_ALT = 0.041, 0.0017, 0.053
GRAMPO = (0.0105, T + 0.003, 0.0095)  # canto superior direito, abraça as duas bordas; 1,5 mm de parede
BANDEIRA = (0.022, 0.014, 0.0015, 0.003)  # largura, altura, chapa, amplitude da onda em S
MOEDA_R, MOEDA_E, MOEDA_Y = 0.0135, 0.0026, -0.004
PILHA_VAO = 0.004  # topo da pilha abaixo do vidro
PILHA_DESVIO = ((0.0, 0.0), (0.0005, -0.0003), (-0.0004, 0.0005), (0.0003, 0.0002))  # ≤ 0,6 mm (BÍBLIA §10)
# A 5ª moeda tomba e fica encostada na quina da pilha, pela frente e à esquerda, com a face para a câmera; em pé
# (BÍBLIA) subiria 12,6 mm à frente da borda de baixo do vidro e fundiria as massas (ver HANDOFF).
ENCOSTO_GRAUS, ENCOSTO_DIR = 25.0, (0.5, 0.87)
VALORES = {'vidro': 0.17, 'gravacao': 0.46, 'aco': 0.46, 'ouro': 0.86}  # sRGB do notan


def _lin(s):
    return s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4


def _material(nome):
    m = bpy.data.materials.get(nome) or bpy.data.materials.new(nome)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    v = _lin(VALORES[nome])
    b.inputs['Base Color'].default_value = (v, v, v, 1.0)
    b.inputs['Roughness'].default_value = 0.8
    b.inputs['Metallic'].default_value = 0.0
    return m


def _caixa(bm, centro, dim):
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.LocRotScale(Vector(centro), None, Vector(dim)))


def _cilindro(bm, centro, raio, comp, segs=32, rot=None):
    m = Matrix.Translation(Vector(centro)) @ (rot or Matrix.Identity(4))
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=raio, radius2=raio,
                          depth=comp, matrix=m)


def _haste(bm, a, b, raio, segs=12):
    a, b = Vector(a), Vector(b)
    rot = (b - a).to_track_quat('Z', 'Y').to_matrix().to_4x4()
    _cilindro(bm, (a + b) / 2, raio, (b - a).length, segs, rot)


def _esfera(bm, centro, raio, u=16, v=8):
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=raio, matrix=Matrix.Translation(Vector(centro)))


def _objeto(nome, preencher, material, raiz, liso=False):
    bm = bmesh.new()
    preencher(bm)
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = liso
    me.materials.append(_material(material))
    o = bpy.data.objects.new(nome, me)
    bpy.data.collections[COLECAO].objects.link(o)
    o.parent = raiz
    return o


def _duro(o, largura, segs=2):
    """Superfície dura para a web: chanfro por ângulo com normais endurecidas + normais ponderadas (Keep Sharp)."""
    for p in o.data.polygons:
        p.use_smooth = True
    bev = o.modifiers.new('chanfro', 'BEVEL')
    bev.width, bev.segments, bev.limit_method = largura, segs, 'ANGLE'
    bev.angle_limit = math.radians(30)
    bev.harden_normals = True
    wn = o.modifiers.new('normais', 'WEIGHTED_NORMAL')
    wn.keep_sharp = True
    return o


# ------------------------------------------------------------------------------------------------ partes
def _face_frente(fora=GRAV_FORA, dentro=GRAV_DENTRO):
    """(y do centro, espessura) de uma placa rente à face gravada do vidro (GRAV_LADO)."""
    return GRAV_LADO * (T / 2 - (dentro - fora) / 2), fora + dentro


def _colunas():
    g = GRADE
    pw = g['w'] / g['cols']
    return [-g['w'] / 2 + pw * (c + 0.5) for c in range(g['cols'])]


def _z_totais():
    g = GRADE
    return g['zc'] - g['h'] / 2 + g['h'] / (2 * g['lins'])


def grade(bm):
    g, (y, e) = GRADE, _face_frente()
    pz = g['h'] / g['lins']
    for r in range(g['lins']):  # ordem de leitura: linha a linha, da esquerda para a direita (o animador usa)
        z = g['zc'] + g['h'] / 2 - pz * (r + 0.5)
        for x in _colunas():
            _caixa(bm, (x, y, z), (g['w'] / g['cols'] * g['fx'], e, pz * g['fz']))


def macro(bm):
    m, (y, e) = MACRO, _face_frente()
    x0 = -GRADE['w'] / 2
    for i, (rec, comp) in enumerate(zip(m['recuos'], m['comps'])):
        largura = comp * GRADE['w']
        z = H / 2 - m['topo'] - m['alt'] / 2 - i * m['passo']
        _caixa(bm, (x0 + rec * m['recuo'] + largura / 2, y, z), (largura, e, m['alt']))


def totais(bm):
    """Filete duplo do contador sob a linha de totais + alça de preenchimento da célula ativa (total geral)."""
    y, e = _face_frente(0.0003, GRAV_DENTRO)
    zt = _z_totais()
    for dz in FILETES:
        _caixa(bm, (0, y, zt - dz), (GRADE['w'], e, FILETE_ALT))
    cx = _colunas()[-1] + GRADE['w'] / GRADE['cols'] * GRADE['fx'] / 2
    cz = zt - GRADE['h'] / GRADE['lins'] * GRADE['fz'] / 2
    ya, ea = _face_frente(0.001, GRAV_DENTRO)
    _caixa(bm, (cx, ya, cz), (ALCA, ea, ALCA))


def pontos_fio():
    xs = _colunas() + [MASTRO_X]
    return [(x, 0.0, H / 2 + a) for x, a in zip(xs, list(NOS_ALT) + [NO_MASTRO])]


def fio(bm):
    """Fio de tendência no plano do vidro: nasce na borda (nó 0 meio embutido nela) e sobe nó a nó até o mastro."""
    pts = pontos_fio()
    for a, b in zip(pts, pts[1:]):
        _haste(bm, a, b, FIO_R)
    for p in pts:
        _esfera(bm, p, NO_R)


def mastro(bm):
    """Mastro de aço saindo do grampo de canto (único fixador); um objeto só, mesmo material, nada se move."""
    grampo(bm)
    base = H / 2 + 0.0015
    _cilindro(bm, (MASTRO_X, 0, base + (MASTRO_ALT - 0.0015) / 2), MASTRO_R, MASTRO_ALT - 0.0015, 16)


def grampo(bm):
    gx, gy, gz = GRAMPO
    _caixa(bm, (W / 2 + 0.0015 - gx / 2, 0, H / 2 + 0.0015 - gz / 2), (gx, gy, gz))


def bandeira(bm):
    """Chapa com uma onda em S, içada no topo do mastro, voando para −X (de volta ao rosto); afina 18 % na ponta."""
    L, A, _, amp = BANDEIRA
    topo = H / 2 + MASTRO_ALT - 0.0015
    bmesh.ops.create_grid(bm, x_segments=12, y_segments=2, size=0.5)
    for v in bm.verts:
        u, s = v.co.x + 0.5, v.co.y  # u: 0 no mastro, 1 na ponta
        onda = math.sin(u * math.pi * 1.6) * u
        # a onda também sobe e desce (bordas de cima e de baixo onduladas): é o que o contorno 2D lê como pano
        z = topo - A / 2 + s * A * (1 - 0.18 * u) - 0.06 * A * u + 0.45 * amp * onda
        v.co = Vector((MASTRO_X - MASTRO_R - u * L, amp * onda, z))


def moeda(bm):
    _cilindro(bm, (0, 0, 0), MOEDA_R, MOEDA_E, 32)


def _moedas(raiz):
    """Pilha de 4 sob o total geral (desalinho ≤ 0,6 mm) + 1 tombada e encostada à esquerda, com a face para cima."""
    x0 = _colunas()[-1]
    topo = -H / 2 - PILHA_VAO
    objs = []
    for i, (dx, dy) in enumerate(PILHA_DESVIO):
        o = _objeto(f'moeda_{i}', moeda, 'ouro', raiz)
        o.location = (x0 + dx, MOEDA_Y + dy, topo - MOEDA_E * (len(PILHA_DESVIO) - i - 0.5))
        o.rotation_euler = (0, 0, math.radians(37 * i))
        objs.append(_duro(o, 0.0003, 1))
    a = math.radians(ENCOSTO_GRAUS)
    d = Vector((*ENCOSTO_DIR, 0.0)).normalized()  # direção da queda: da moeda para a pilha
    chao = topo - MOEDA_E * len(PILHA_DESVIO)
    quina = Vector((x0, MOEDA_Y, chao)) - d * MOEDA_R  # a borda de cima apoia na quina da pilha
    centro = quina - d * MOEDA_R * math.cos(a)
    centro.z = chao + MOEDA_R * math.sin(a) + MOEDA_E / 2
    o = _objeto('moeda_encostada', moeda, 'ouro', raiz)
    o.location = centro
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Quaternion(Vector((-d.y, d.x, 0.0)), -a)
    objs.append(_duro(o, 0.0003, 1))
    return objs


def construir():
    """Monta a coleção `Peca` (raiz `financeiro` + partes) e devolve as malhas."""
    col = bpy.data.collections.get(COLECAO) or bpy.data.collections.new(COLECAO)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    raiz = bpy.data.objects.new('financeiro', None)
    col.objects.link(raiz)
    raiz.location = comum.gl_para_bl(ANCORA_GLB)
    raiz.rotation_euler = (0, 0, math.radians(GIRO_Y))
    vidro = _duro(_objeto('vidro', lambda bm: _caixa(bm, (0, 0, 0), (W, T, H)), 'vidro', raiz), CHANFRO)
    partes = [vidro,
              _objeto('grade', grade, 'gravacao', raiz),
              _objeto('macro', macro, 'gravacao', raiz),
              _objeto('totais', totais, 'ouro', raiz),
              _objeto('fio', fio, 'ouro', raiz, liso=True),
              _duro(_objeto('mastro', mastro, 'aco', raiz), 0.0005),
              _objeto('bandeira', bandeira, 'ouro', raiz, liso=True)]
    sol = partes[-1].modifiers.new('chapa', 'SOLIDIFY')
    sol.thickness, sol.offset = BANDEIRA[2], 0.0
    return partes + _moedas(raiz)


def vistas(pasta, pecas, busto):
    """Silhueta (3 telas) e argila (câmera do site, 3 telas) com o busto; 7 vistas de argila só da peça."""
    for tela in comum.TELAS:
        k = comum.ler_camera_site(tela).get('dsfCaptura', 1)
        comum.camera_site(tela, escala=k)
        comum.render_silhueta(os.path.join(pasta, f'silhueta-{tela}.png'), pecas, busto)
        comum.render_argila(os.path.join(pasta, f'argila-site-{tela}.png'), pecas + busto)
    comum.vistas_argila(pecas, pasta, 'blockout')


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    pos = [a for a in args if not a.startswith('--')]
    pasta = os.path.join(comum.RAIZ, pos[0] if pos else '3d/captura/props/financeiro/v7/blockout')
    comum.cena_nova()
    busto = [o for o in comum.importar_busto() if o.type == 'MESH']
    pecas = construir()
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(comum.RAIZ, '3d/blend/props/financeiro_v7_blockout.blend'))
    import exportar

    print('EXPORTADO', exportar.exportar('blockout'))
    if '--sem-vistas' not in args:
        vistas(pasta, pecas, busto)


if __name__ == '__main__':
    main()
