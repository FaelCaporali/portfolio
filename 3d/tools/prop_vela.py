"""Adereço da vida `vela` ("Sailing Instructor"), volta 1: receita ÚNICA forma + material (ficha + ADENDO 1).

Headless (fonte de verdade, reprodutível):
    blender -b --python 3d/tools/prop_vela.py -- [glb=3d/export/props/vela.glb] [blend=3d/blend/props/vela_v1.blend|0]
        [provas=3d/captura/props/vela/v1/blender|0] [apito=peito|0|b]   (peito = ADENDO 3; 0 = nó vazio; b = retêntor)

glb (espaço do S13: Y para cima, rosto +Z): raiz `vela` →
  `vela_bone`    → `vela_bone_tecido`                       (vestido no crânio; material vela_tecido)
  `vela_oculos`  → `vela_oculos_armacao`, `vela_oculos_lente` (vela_rigido; vela_lente = único transparente)
  `vela_laser`   → `vela_laser_casco` (centro de giro) → `vela_laser_retranca` (eixo do mastro; rígido + vela)
  `vela_optimist`→ `vela_optimist_casco` → `vela_optimist_vela`
  `vela_apito`   → `vela_apito_corpo`, `vela_apito_cordao`   (V9, teste)
  `vela_lais`    → `vela_lais_cabo` (V10, teste; UV0 u 0→1 ao longo do cabo, trança na UV1)
Estado exportado = FINAL da virada (ver prop_vela_barco.py e o LOG): casco (φ adernamento em X, ψ rumo em Z),
retranca (δ em Z), chave `bordo` 0. Barcos na mesma escala S (Laser 4,23 m, Optimist 2,31 m).
"""
import math
import os
import subprocess
import sys

import bpy
import numpy as np
from mathutils import Vector

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [AQUI, os.path.join(AQUI, 'props')]
import comum  # noqa: E402
import prop_financeiro_v6 as v6  # noqa: E402
import prop_vela_base as B  # noqa: E402
import prop_vela_bone as bone  # noqa: E402
import prop_vela_oculos as oculos  # noqa: E402
import prop_vela_laser as laser  # noqa: E402
import prop_vela_optimist as optimist  # noqa: E402
import prop_vela_textura as textura  # noqa: E402

ROOT, ARGS = v6.ROOT, v6.ARGS
GLB = os.path.join(ROOT, ARGS.get('glb', '3d/export/props/vela.glb'))
BLEND = ARGS.get('blend', '3d/blend/props/vela_v1.blend')
TEX = os.path.join(ROOT, '3d/captura/props/vela/v1/blender/texturas')
S = float(ARGS.get('S', 0.0235))                        # escala dos barcos (1 : 42,5): Laser ≈ 0,58 H no 1440
# Colocação (Blender: x, y = −z_gl, z = y_gl) e estado final da virada (graus): rumo ψ, adernamento φ, retranca δ.
BARCOS = {
    'laser': dict(pos=(0.150, -0.020, 0.160), psi=-45, phi=15, delta=-12),
    'optimist': dict(pos=(0.132, 0.010, 0.062), psi=-45, phi=10, delta=-14),     # na esteira: atrás e abaixo
}
SMILE = dict(mouthSmileLeft=1, mouthSmileRight=1, mouthSmileFix=1)
BLINK = dict(eyeBlinkLeft=1, eyeBlinkRight=1)


def lente_img():
    """Degradê de verdade: a faixa dos olhos (v ≤ 0,62) quase clara (alfa 0,10–0,16, a íris lê), escurece só no
    terço de cima (alfa até 0,82). Cinza-esverdeado (lente polarizada de velejador)."""
    v = np.linspace(0, 1, 256)[:, None]
    k = np.clip((v - 0.64) / 0.36, 0, 1)
    k = k * k * (3 - 2 * k)
    a = 0.06 + 0.05 * v / 0.64 * (v < 0.64) + (0.11 + 0.71 * k) * (v >= 0.64) - 0.06 * (v >= 0.64)
    a = a + 0.01                                   # tingimento visível em toda a lente (fumê azulado polarizado)
    topo, baixo = B.lin('#121a24'), B.lin('#26394a')
    cor = baixo * (1 - k[..., None]) + topo * k[..., None]
    rgba = np.concatenate([np.repeat(cor, 8, 1), np.repeat(a[..., None], 8, 1)], 2)
    return B.imagem('vela_lente_cor', rgba, TEX, qualidade=95)


def lente_orm():
    """Espelhado sutil só no topo: metal 0 → 0,55 no terço de cima; rugosidade 0,05 (lente polida)."""
    v = np.linspace(0, 1, 256)[:, None]
    k = np.clip((v - 0.70) / 0.30, 0, 1) ** 1.5
    orm = np.dstack([np.ones_like(v), np.full_like(v, 0.05), 0.55 * k])
    return B.imagem('vela_lente_orm', np.repeat(orm, 8, 1), TEX, qualidade=95)


def materiais():
    orm = B.orm_regioes(TEX)
    vela_img = textura.velas(TEX)
    tc, tn = textura.tranca(TEX)
    return {
        'rigido': B.material('vela_rigido', 1.0, 1.0, orm=orm),
        'lente': B.material('vela_lente', 1.0, 1.0, cor_base=lente_img(), orm=lente_orm(), vcor=False, alfa=True),
        'vela': B.material('vela_vela', 0.0, 0.8, cor_base=vela_img, vcor=False, double=True),
        'cabo': B.material('vela_cabo', 0.0, 0.9, cor_base=tc, normal=tn, uv_nome='UVTrama'),
    }


def vazio(nome, pai=None, loc=(0, 0, 0)):
    o = bpy.data.objects.new(nome, None)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    if pai is not None:
        o.parent = pai
    return o


def pendurar(filho, pai):
    """Parenta mantendo a posição de mundo, com a matriz inversa embutida na local (o glTF recebe TRS limpo)."""
    mw = filho.matrix_world.copy()
    filho.parent = pai
    filho.matrix_parent_inverse.identity()
    filho.matrix_world = mw


def barco(nome, mod, raiz, mats):
    cfg = BARCOS[nome]
    grupo = vazio('vela_' + nome, raiz, cfg['pos'])
    casco, apar, origem = mod.construir(S, mats['rigido'], mats['vela'])
    # Pivôs = nós vazios com o nome do contrato; a malha é filha-folha `<pivô>_malha` (a quantização do otimizar.mjs
    # vai para o TRS do nó da malha: pivô com filhos não pode carregar malha).
    nc, na = casco.name, apar.name
    casco.name = casco.data.name = nc + '_malha'
    apar.name = apar.data.name = na + '_malha'
    pc = vazio(nc, grupo)
    pc.rotation_euler = (math.radians(cfg['phi']), 0, math.radians(cfg['psi']))
    casco.parent = pc
    pa = vazio(na, pc, origem)
    pa.rotation_euler = (0, 0, math.radians(cfg['delta']))
    apar.parent = pa
    import prop_vela_vento as vento                       # ADENDO 8: biruta e fitas (nós próprios)
    return [grupo, pc, casco, pa, apar] + vento.equipar(nome, pc, pa, S, mats['rigido'])


def construir():
    comum.cena_nova()
    busto = B.Busto(comum.importar_busto())
    neutro = busto.pose()
    mats = materiais()
    raiz = vazio('vela')
    objs = [raiz]
    # V2 boné: textura depende da geometria (comprimento dos anéis da copa).
    g = vazio('vela_bone', raiz, (0.0, 0.130, 0.300))
    cap = bone.construir(neutro, None)
    tc, tn = textura.bone(TEX, bone.CIRC)
    mats['tecido'] = B.material('vela_tecido', 0.0, 0.86, cor_base=tc, normal=tn, vcor=False, forca_normal=0.8)
    for o in cap:
        o.data.materials[0] = mats['tecido']
        pendurar(o, g)
    objs += [g] + cap
    # V3 óculos: ajuste nas três poses (neutro, sorriso da vida, piscar).
    poses = [B.Busto(list(busto.malhas.values())).pose(**p) for p in ({}, SMILE, BLINK)]
    g = vazio('vela_oculos', raiz, (0.0, -0.016, 0.192))
    ocs, info = oculos.construir(busto.pose(), poses, mats['rigido'], mats['lente'])
    for o in ocs:
        pendurar(o, g)
    objs += [g] + ocs
    print('OCULOS', info)
    objs += barco('laser', laser, raiz, mats)
    objs += barco('optimist', optimist, raiz, mats)
    try:
        import prop_vela_extras as extras                 # V9 apito e V10 lais de guia (teste)
        objs += extras.construir(raiz, busto.pose(), mats, ARGS.get('apito', 'peito'))
    except ImportError:
        objs += [vazio('vela_apito', raiz), vazio('vela_lais', raiz)]
    busto.pose()
    return busto, objs


def main():
    busto, objs = construir()
    bpy.context.view_layer.update()
    for o in busto.malhas.values():                       # o busto não vai para o glb
        o.hide_set(False)
    comum.exportar_glb(objs, GLB, otimizar=True)
    print('GLB', GLB, round(os.path.getsize(GLB) / 1024, 1), 'kB')
    subprocess.run(['node', os.path.join(ROOT, '3d/tools/props/glb.mjs'), GLB], cwd=ROOT)
    if BLEND != '0':
        os.makedirs(os.path.dirname(os.path.join(ROOT, BLEND)), exist_ok=True)
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, BLEND))
        print('BLEND', BLEND)
    if ARGS.get('provas', '0') != '0':
        import prop_vela_prova as prova
        prova.rodar(busto, objs, ARGS['provas'])


if __name__ == '__main__':
    main()
