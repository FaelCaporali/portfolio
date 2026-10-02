"""Busto do herói (S13) para a imagem de compartilhamento (og:image): render com fundo transparente, na luz do site.

Chamado por `3d/tools/og/gerar.mjs` (que documenta o comando); à mão:
  blender -b --factory-startup --python 3d/tools/og/busto_og.py -- <busto-sem-meshopt.glb> <saida.png> [opções]
  opções: --giro=<graus> (positivo: cabeça para a esquerda da imagem; negativo: para a direita; padrão −22, pedido
          do Fael em 02/10: "melhor estar virado para o outro lado") --olhar=<0..1> (fração do giro que os olhos
          devolvem para a câmera, padrão 0.8) --w=<px> --h=<px> (padrão 1280×1260) --fov=<graus, padrão 17> --amostras=<n>
O glb vem sem EXT_meshopt_compression (`node 3d/tools/props/otimizar.mjs --cru`): o importador do Blender 4.5 não lê.

Fiel ao site (src/features/hero/scene): Lighting.tsx (3 sóis com força = intensidade do three, ambiente 0,15/π, a sala
do three × 0,35 como mundo uniforme calibrado em 0,489 contra a pele da captura do site, ver
3d/captura/props/ai/v1/blender/medidas.json), rig.ts (pele com rugosidade 0,72 e degradê do pescoço; conjuntiva e
sombra do olho sem luz, a sombra com a cor×COLOR_1 e alfa de COLOR_1), a expressão da vida `ai` (journey.ts:
browDown 0,18, mouthSmile 0,22) e o tom ACESFilmic do three (exposição 1) → sRGB. A cabeça gira no pivô do site
(Bust.tsx: PIVOT) como o olhar a gira; os olhos voltam para a câmera como o olhar do site (gaze.ts, limite 0,45 rad).
Saída: PNG RGBA 8 bits, alfa reto (o navegador compõe sobre o fundo como o canvas do site).
"""
import json
import math
import os
import struct
import sys

import bpy
import numpy as np
from mathutils import Euler, Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'props'))
import comum  # noqa: E402

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
POS = [a for a in ARGS if not a.startswith('--')]
OPC = dict(a[2:].split('=', 1) for a in ARGS if a.startswith('--') and '=' in a)
GLB, SAIDA = POS[0], POS[1]
GIRO = math.radians(float(OPC.get('giro', -22)))
OLHAR = float(OPC.get('olhar', 0.8))
W, H = int(OPC.get('w', 1280)), int(OPC.get('h', 1260))
FOV = float(OPC.get('fov', 17))
AMOSTRAS = int(OPC.get('amostras', 128))

LUZES = (((-0.6, 0.8, 0.9), 2.2, '#fff3e6'), ((0.8, 0.3, 0.6), 0.6, '#dfe8ff'), ((0.3, 0.4, -1.0), 0.5, '#ffffff'))
MUNDO = 0.15 / math.pi + 0.489
EXPR = {'mouthSmileLeft': 0.22, 'mouthSmileRight': 0.22, 'mouthSmileFix': 0.22,
        'browDownLeft': 0.18, 'browDownRight': 0.18}
PIVO_GL = (0.0, 0.05, -0.13)          # Bust.tsx PIVOT
CAMERA_GL = (0.0, 0.2, 1.05)          # HeroCanvas.tsx
ALVO_GL = (0.0, 0.185, -0.06)         # meio da cabeça (cabelo ao queixo), um pouco à frente do pivô
OLHO_MAX = 0.45                       # gaze.ts EYE_MAX_YAW
_M_IN = np.array(((0.59719, 0.35458, 0.04823), (0.07600, 0.90834, 0.01566), (0.02840, 0.13383, 0.83777)))
_M_OUT = np.array(((1.60475, -0.53108, -0.07367), (-0.10208, 1.10813, -0.00605), (-0.00327, -0.07276, 1.07602)))


def aces(rgb):
    """ACESFilmicToneMapping do three (r155+), exposição 1, e a codificação sRGB (cópia de prop_ai_prova.aces)."""
    c = (rgb / 0.6) @ _M_IN.T
    a = c * (c + 0.0245786) - 0.000090537
    b = c * (0.983729 * c + 0.4329510) + 0.238081
    c = np.clip((a / b) @ _M_OUT.T, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def lin(hexa):
    v = [int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in v]


def no(nt, tipo):
    return next((n for n in nt.nodes if n.type == tipo), None)


def fator_base(nome):
    """baseColorFactor do material no JSON do glb (o importador o põe num nó de mistura, não no BSDF)."""
    with open(GLB, 'rb') as f:
        cab = f.read(20)
        js = json.loads(f.read(struct.unpack('<I', cab[12:16])[0]))
    m = next(m for m in js['materials'] if m['name'] == nome)
    return tuple(m['pbrMetallicRoughness'].get('baseColorFactor', (1, 1, 1, 1)))


def materiais():
    """Os materiais como o site os prepara (rig.ts prepareMaterials)."""
    for m in bpy.data.materials:
        nt = m.node_tree
        if nt is None:
            continue
        out = no(nt, 'OUTPUT_MATERIAL')
        bsdf = no(nt, 'BSDF_PRINCIPLED')
        if m.name == 'Conjuntiva':                 # MeshBasicMaterial com cor de vértice: sem luz
            at = nt.nodes.new('ShaderNodeVertexColor')
            at.layer_name = 'Color'
            em = nt.nodes.new('ShaderNodeEmission')
            nt.links.new(at.outputs['Color'], em.inputs['Color'])
            nt.links.new(em.outputs[0], out.inputs['Surface'])
        elif m.name == 'SombraOlho':               # MeshBasic: cor × COLOR_1, alfa de COLOR_1, transparente
            base = fator_base(m.name)
            at = nt.nodes.new('ShaderNodeVertexColor')
            at.layer_name = 'Color.001'
            mul = nt.nodes.new('ShaderNodeMix')
            mul.data_type, mul.blend_type = 'RGBA', 'MULTIPLY'
            mul.inputs['Factor'].default_value = 1.0
            mul.inputs['A'].default_value = base
            nt.links.new(at.outputs['Color'], mul.inputs['B'])
            em = nt.nodes.new('ShaderNodeEmission')
            nt.links.new(mul.outputs['Result'], em.inputs['Color'])
            tr = nt.nodes.new('ShaderNodeBsdfTransparent')
            mix = nt.nodes.new('ShaderNodeMixShader')
            nt.links.new(at.outputs['Alpha'], mix.inputs[0])
            nt.links.new(tr.outputs[0], mix.inputs[1])
            nt.links.new(em.outputs[0], mix.inputs[2])
            nt.links.new(mix.outputs[0], out.inputs['Surface'])
        elif m.name == '3DModel':                  # pele: rugosidade 0,72 e degradê do pescoço (y 0,012 → 0,075)
            bsdf.inputs['Roughness'].default_value = 0.72
            src = out.inputs['Surface'].links[0].from_socket
            geo = nt.nodes.new('ShaderNodeNewGeometry')
            sep = nt.nodes.new('ShaderNodeSeparateXYZ')
            mr = nt.nodes.new('ShaderNodeMapRange')
            mr.interpolation_type = 'SMOOTHSTEP'          # dissolve.ts NECK_FADE: smoothstep(0.012, 0.075, y)
            mr.inputs['From Min'].default_value, mr.inputs['From Max'].default_value = 0.012, 0.075
            nt.links.new(geo.outputs['Position'], sep.inputs[0])
            nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
            tr = nt.nodes.new('ShaderNodeBsdfTransparent')
            mix = nt.nodes.new('ShaderNodeMixShader')
            nt.links.new(mr.outputs['Result'], mix.inputs[0])
            nt.links.new(tr.outputs[0], mix.inputs[1])
            nt.links.new(src, mix.inputs[2])
            nt.links.new(mix.outputs[0], out.inputs['Surface'])
        elif bsdf is not None and m.name in ('ParedePalpebra', 'ParedePalpebraSup', 'Olho'):
            bsdf.inputs['Roughness'].default_value = 1.0   # MeshStandard do glb sem rugosidade = 1


def expressao(objs):
    for o in objs:
        if o.type == 'MESH' and o.data.shape_keys:
            for k in o.data.shape_keys.key_blocks:
                k.value = EXPR.get(k.name, 0.0) if k.name != 'Basis' else k.value


def luz():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'OPTIX'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
    except Exception:                               # noqa: BLE001 (sem GPU: CPU)
        sc.cycles.device = 'CPU'
    sc.cycles.samples = AMOSTRAS
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    for k, (pos, forca, cor) in enumerate(LUZES):
        d = bpy.data.lights.new('_Sol%d' % k, 'SUN')
        d.energy, d.color, d.angle = forca, lin(cor), math.radians(2)
        o = bpy.data.objects.new('_Sol%d' % k, d)
        sc.collection.objects.link(o)
        o.rotation_euler = (-Vector(comum.gl_para_bl(pos))).to_track_quat('-Z', 'Y').to_euler()
    w = sc.world
    w.use_nodes = True
    bg = no(w.node_tree, 'BACKGROUND')
    bg.inputs['Color'].default_value = (MUNDO, MUNDO, MUNDO, 1)
    bg.inputs['Strength'].default_value = 1.0


def camera():
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
    dados = bpy.data.cameras.new('CamOG')
    dados.sensor_fit = 'VERTICAL'
    dados.sensor_height = 24.0
    dados.lens = 12.0 / math.tan(math.radians(FOV) / 2)
    dados.clip_start, dados.clip_end = 0.05, 10
    cam = bpy.data.objects.new('CamOG', dados)
    sc.collection.objects.link(cam)
    pos = Vector(comum.gl_para_bl(CAMERA_GL))
    cam.location = pos
    cam.rotation_euler = (Vector(comum.gl_para_bl(ALVO_GL)) - pos).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    return cam


def girar(objs, cam):
    """Gira a cabeça no pivô do site (giro > 0: para a esquerda da imagem) e volta os olhos para a câmera."""
    raiz = next(o for o in objs if o.parent is None and o.name == 'Busto')
    pivo = bpy.data.objects.new('_Pivo', None)
    bpy.context.scene.collection.objects.link(pivo)
    pivo.location = comum.gl_para_bl(PIVO_GL)
    raiz.parent = pivo
    raiz.matrix_parent_inverse = pivo.matrix_world.inverted()
    pivo.rotation_euler = (0, 0, -GIRO)
    bpy.context.view_layer.update()
    for nome in ('Olho_D', 'Olho_E'):
        olho = bpy.data.objects[nome]
        base = olho.rotation_quaternion.copy() if olho.rotation_mode == 'QUATERNION' else \
            olho.rotation_euler.to_quaternion()
        # Direção da câmera no espaço do busto (Blender: rosto para −Y, Z para cima).
        d = raiz.matrix_world.inverted().to_3x3() @ (cam.location - olho.matrix_world.translation)
        yaw = math.atan2(d.x, -d.y) * OLHAR
        pitch = -math.atan2(d.z, math.hypot(d.x, d.y)) * OLHAR      # X+ abaixa o olhar
        yaw = max(-OLHO_MAX, min(OLHO_MAX, yaw))
        gaze = Euler((pitch, 0, yaw), 'ZXY').to_quaternion()
        olho.rotation_mode = 'QUATERNION'
        olho.rotation_quaternion = gaze @ base
        print('OLHO', nome, 'giro %.3f inclinação %.3f rad' % (yaw, pitch))


def render():
    sc = bpy.context.scene
    sc.render.image_settings.file_format = 'OPEN_EXR'
    sc.render.image_settings.color_depth = '32'
    exr = os.path.splitext(SAIDA)[0] + '.exr'
    sc.render.filepath = exr
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(exr, check_existing=False)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4).astype(np.float64)
    bpy.data.images.remove(img)
    os.remove(exr)
    a = np.clip(px[..., 3:4], 0, 1)
    reto = np.where(a > 1e-5, px[..., :3] / np.maximum(a, 1e-5), 0)      # alfa pré-multiplicado → reto
    rgb = aces(reto)
    im = bpy.data.images.new('_og', W, H, alpha=True)
    im.alpha_mode = 'STRAIGHT'
    im.pixels = np.concatenate([rgb, a], 2).astype(np.float32).ravel()
    im.filepath_raw = SAIDA
    im.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    im.save()
    # Caixa do que não é transparente (linha 0 = topo), para o modelo HTML posicionar e o gerador conferir.
    vis = a[::-1, :, 0] > 0.02
    ys, xs = np.nonzero(vis)
    print('CAIXA', W, H, int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))


def main():
    comum.cena_nova()
    objs = comum.importar_glb(GLB, 'Busto')
    materiais()
    expressao(objs)
    luz()
    cam = camera()
    girar(objs, cam)
    render()
    print('OK', SAIDA)


main()
