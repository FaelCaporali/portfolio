"""Formas de miniatura do conceito do adereço financeiro (diretor de arte, E1 da v7): primitivas em escala real, sem
chanfro, só para julgar silhueta, massa e lugar. Usado por `conceito.py`. NÃO é blockout nem produção.
Coordenadas locais do Blender: X direita, −Y para a câmera, Z para cima; a âncora põe e gira no espaço do glb.
"""

import math

import bpy

import comum


# Valores do notan (3 valores sobre o fundo #0b0b0e do site), dados em sRGB e convertidos para o linear do Workbench.
def _lin(s):
    return s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4


ESCURO, MEDIO, CLARO = _lin(0.17), _lin(0.46), _lin(0.86)
MAGENTA = (1.0, 0.0, 1.0, 1.0)


def _obj(nome, malha_fn, loc, dim, pai, valor):
    malha_fn()
    o = bpy.context.active_object
    o.name = nome
    o.dimensions = dim
    o.location = loc
    o.parent = pai
    o['valor'] = valor
    return o


def caixa(nome, loc, dim, pai, valor=MEDIO):
    return _obj(nome, lambda: bpy.ops.mesh.primitive_cube_add(size=1), loc, dim, pai, valor)


def cilindro(nome, loc, raio, altura, pai, valor=CLARO, eixo='Z', verts=48):
    o = _obj(nome, lambda: bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=1, depth=1), loc,
             (2 * raio, 2 * raio, altura), pai, valor)
    if eixo == 'X':
        o.rotation_euler = (0, math.radians(90), 0)
        o.dimensions = (2 * raio, 2 * raio, altura)
    return o


def haste(nome, a, b, raio, pai, valor=CLARO):
    """Cilindro fino de a até b (coordenadas locais do Blender)."""
    from mathutils import Vector

    a, b = Vector(a), Vector(b)
    o = cilindro(nome, (a + b) / 2, raio, (b - a).length, pai, valor, verts=16)
    o.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return o


def ancora(nome, pos_glb, giro_y=0.0, incl_x=0.0):
    """Empty no espaço do glb; giro_y em graus (negativo = frente para a cabeça, borda direita para a câmera)."""
    e = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = comum.gl_para_bl(pos_glb)
    e.rotation_euler = (math.radians(incl_x), 0, math.radians(giro_y))
    return e


def grade(prefixo, pai, largura, altura, y_face, cols, linhas, z0=0.0):
    """Faixa de células foscas (médio) sobre a face do vidro: só massa, sem número."""
    objs = []
    cw, ch = largura / cols, altura / linhas
    for r in range(linhas):
        for c in range(cols):
            x = -largura / 2 + cw * (c + 0.5)
            z = z0 + altura / 2 - ch * (r + 0.5)
            v = CLARO if r == linhas - 1 else MEDIO
            objs.append(caixa(f'{prefixo}_c{r}{c}', (x, y_face, z), (cw * 0.86, 0.001, ch * 0.72), pai, v))
    return objs


def linha(prefixo, pai, pontos, y, raio=0.0016):
    return [haste(f'{prefixo}_l{i}', (a[0], y, a[1]), (b[0], y, b[1]), raio, pai)
            for i, (a, b) in enumerate(zip(pontos, pontos[1:]))]


def moedas(nome, pai, loc, raio=0.014, n=6, esp=0.0024):
    return cilindro(nome, (loc[0], loc[1], loc[2] + n * esp / 2), raio, n * esp, pai, CLARO)


def bandeira(prefixo, pai, x, z_base, altura, larg=0.034, alt=0.022, lado=-1, y=0.0):
    """Mastro + bandeira retangular voando para `lado` (−1 = para a esquerda, de volta ao rosto)."""
    m = haste(f'{prefixo}_mastro', (x, y, z_base), (x, y, z_base + altura), 0.0017, pai, MEDIO)
    f = caixa(f'{prefixo}_pano', (x + lado * larg / 2, y, z_base + altura - alt / 2 - 0.002), (larg, 0.002, alt), pai,
              CLARO)
    return [m, f]


def bandeira_onda(nome, pai, x, z_topo, larg=0.030, alt=0.020, lado=-1, y=0.0, amp=0.004):
    """Bandeira de chapa fina com uma onda em S (lê como bandeira, não como cartão), voando para `lado`."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=16, y_subdivisions=2, size=1)
    o = bpy.context.active_object
    o.name = nome
    for v in o.data.vertices:
        u = v.co.x + 0.5  # 0 no mastro, 1 na ponta
        onda = math.sin(u * math.pi * 1.6) * u
        px, pz = lado * u * larg, (v.co.y) * alt * (1 - 0.18 * u)
        v.co = (px, amp * onda, pz - 0.05 * alt * u + 0.35 * alt * onda * 0.5)
    o.location = (x, y, z_topo - alt / 2)
    o.parent = pai
    o['valor'] = CLARO
    mod = o.modifiers.new('esp', 'SOLIDIFY')
    mod.thickness = 0.0015
    return o


def tendencia_acima(prefixo, pai, W, H, cols, alturas, x_mastro, y=-0.002, postes=False):
    """Linha de tendência sobre a borda de cima do vidro: um nó por coluna (centro da coluna), altura = total.
    `postes`: hastes finas da borda do vidro até cada nó (sustentam o fio e amarram cada nó à sua coluna)."""
    cw = W * 0.84 / cols
    xs = [-W * 0.42 + cw * (c + 0.5) for c in range(cols)] + [x_mastro]
    pts = [(x, H / 2 + a) for x, a in zip(xs, alturas)]
    o = linha(prefixo, pai, pts, y, raio=0.0017)
    if postes:
        o += [haste(f'{prefixo}_poste{i}', (p[0], y, H / 2), (p[0], y, p[1]), 0.0010, pai, MEDIO)
              for i, p in enumerate(pts[:-1])]
    o += [cilindro(f'{prefixo}_no{i}', (p[0], y, p[1]), 0.0032, 0.004, pai, CLARO, verts=16)
          for i, p in enumerate(pts[:-1])]
    return o


def macro(prefixo, pai, W, z_topo, y_face):
    """Faixa da macro: 4 linhas gravadas com recuo (Sub / corpo recuado / End Sub), só forma, sem letra."""
    recuos, comps = (0, 1, 1, 0), (0.55, 0.62, 0.45, 0.30)
    return [caixa(f'{prefixo}_vba{i}', (-W * 0.42 + r * 0.008 + c * W * 0.84 / 2, y_face, z_topo - i * 0.0062),
                  (c * W * 0.84, 0.001, 0.0032), pai, MEDIO) for i, (r, c) in enumerate(zip(recuos, comps))]


def pilha(prefixo, pai, x, y, z, n=5, raio=0.0135, esp=0.0026, lado=-1):
    """Pilha imperfeita (verismo: moedas contadas à mão não alinham) + uma moeda de pé encostada, de face."""
    desvio = (0.0, 0.0012, -0.0008, 0.0015, -0.0004, 0.0010)
    o = [cilindro(f'{prefixo}_m{i}', (x + desvio[i % 6], y + desvio[(i + 2) % 6], z + esp * (i + 0.5)), raio, esp,
                  pai, CLARO) for i in range(n)]
    c = cilindro(f'{prefixo}_mpe', (x + lado * (raio + 0.004), y - 0.006, z + raio * 0.97), raio, esp, pai, CLARO)
    c.rotation_euler = (math.radians(90), math.radians(12 * lado), math.radians(-8 * lado))
    return o + [c]
