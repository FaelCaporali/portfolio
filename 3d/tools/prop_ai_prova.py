"""Provas da vida `ai` v1 (chamadas por prop_ai.py com provas=<pasta>): luz do site no Cycles, tom ACES do three,
calibração do grafite e medidas.json. A folha de vistas rotuladas está em prop_ai_prova_folha.py.

Luz do site (Lighting.tsx): 3 luzes direcionais (sol no Cycles, força = intensidade do three: os dois dividem a
lambertiana por π), ambiente 0,15 (mundo uniforme 0,15/π) + a sala borrada do three × 0,35 (mundo uniforme `ENV`,
ajustado para a pele do render bater com a pele da captura do site no mesmo ponto). Render linear (EXR, fundo transparente) → ACESFilmic do
three (exposição 1) → sRGB → sobre o fundo #0b0b0e. Degradês: neckFade do busto (y 0,012 → 0,075) e UV `Fade` do robô.
"""
import json
import math
import os

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view

import comum
import prop_ai_geo as G
import prop_ai_material as MT
import prop_financeiro_v6 as v6

LUZES = (((-0.6, 0.8, 0.9), 2.2, '#fff3e6'), ((0.8, 0.3, 0.6), 0.6, '#dfe8ff'), ((0.3, 0.4, -1.0), 0.5, '#ffffff'))
AMBIENTE = 0.15 / math.pi
FUNDO = np.array((11, 11, 14)) / 255.0
CAPTURA_SITE = os.path.join(v6.ROOT, '3d/captura/props/techlead/v1/td/final/f1440-volta-1440x900-olhar-centro.png')
PELE_PONTOS = ((0.045, 0.135), (-0.045, 0.135), (0.0, 0.245), (0.03, 0.215))    # (x, y) glb na pele de frente
_M_IN = np.array(((0.59719, 0.35458, 0.04823), (0.07600, 0.90834, 0.01566), (0.02840, 0.13383, 0.83777)))
_M_OUT = np.array(((1.60475, -0.53108, -0.07367), (-0.10208, 1.10813, -0.00605), (-0.00327, -0.07276, 1.07602)))
ESTADO = {'env': 0.10}


def aces(rgb):
    """ACESFilmicToneMapping do three (r155+), exposição 1, e a codificação sRGB."""
    c = rgb / 0.6
    c = c @ _M_IN.T
    a = c * (c + 0.0245786) - 0.000090537
    b = c * (0.983729 * c + 0.4329510) + 0.238081
    c = np.clip((a / b) @ _M_OUT.T, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def luz_site():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'OPTIX'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
    except Exception:                                   # noqa: BLE001 (sem GPU: CPU)
        sc.cycles.device = 'CPU'
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    for o in [o for o in bpy.data.objects if o.name.startswith('_Sol')]:
        bpy.data.objects.remove(o)
    for k, (pos, forca, cor) in enumerate(LUZES):
        d = bpy.data.lights.new('_Sol%d' % k, 'SUN')
        d.energy, d.color, d.angle = forca, MT.lin4(cor)[:3], math.radians(2)
        o = bpy.data.objects.new('_Sol%d' % k, d)
        sc.collection.objects.link(o)
        o.rotation_euler = (-G.bl(pos)).to_track_quat('-Z', 'Y').to_euler()
    mundo(ESTADO['env'])


def mundo(env):
    sc = bpy.context.scene
    w = sc.world
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    v = AMBIENTE + env
    bg.inputs['Color'].default_value = (v, v, v, 1)
    bg.inputs['Strength'].default_value = 1.0


def fades():
    """Busto: neckFade (y 0,012 → 0,075) para transparente; robô: UV `Fade` (x) para transparente. Pele com
    rugosidade 0,72 (a do site)."""
    for m in bpy.data.materials:
        if not m.use_nodes or m.get('_fade'):
            continue
        nt = m.node_tree
        out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
        if out is None or not out.inputs['Surface'].links:
            continue
        src = out.inputs['Surface'].links[0].from_socket
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        if m.name.startswith('ai_'):
            uv = nt.nodes.new('ShaderNodeUVMap')
            uv.uv_map = 'Fade'
            nt.links.new(uv.outputs['UV'], sep.inputs[0])
            fator = sep.outputs['X']
        else:
            b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if b is not None and m.name == '3DModel':
                b.inputs['Roughness'].default_value = 0.72
            pos = nt.nodes.new('ShaderNodeNewGeometry')
            nt.links.new(pos.outputs['Position'], sep.inputs[0])
            mr = nt.nodes.new('ShaderNodeMapRange')
            mr.inputs['From Min'].default_value, mr.inputs['From Max'].default_value = 0.012, 0.075
            nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
            fator = mr.outputs['Result']
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        mix = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(fator, mix.inputs[0])
        nt.links.new(tr.outputs[0], mix.inputs[1])
        nt.links.new(src, mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs['Surface'])
        m['_fade'] = 1


def render(arq, visiveis, borda=None, amostras=64):
    """Cycles linear → ACES → sobre o fundo do site → PNG em `arq`; devolve a imagem sRGB (h, w, 3) e o alfa."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'               # a silhueta/argila deixam o Workbench ligado
    sc.render.film_transparent = True
    sc.cycles.samples = amostras
    sc.render.use_border = borda is not None
    sc.render.use_crop_to_border = True
    if borda:
        sc.render.border_min_x, sc.render.border_max_x, sc.render.border_min_y, sc.render.border_max_y = borda
    v6.only({o.name for o in visiveis})
    sc.render.image_settings.file_format = 'OPEN_EXR'
    sc.render.image_settings.color_depth = '32'
    exr = os.path.join(MT.TMP, '_ai_render.exr')
    sc.render.filepath = exr
    bpy.ops.render.render(write_still=True)
    sc.render.use_border = False
    img = bpy.data.images.load(exr, check_existing=False)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(img)
    rgb = aces(px[..., :3].astype(np.float64))
    a = np.clip(px[..., 3:4], 0, 1)
    out = rgb * a + FUNDO * (1 - a)
    salvar(arq, out)
    sc.render.image_settings.file_format = 'PNG'
    return out[::-1], a[::-1, :, 0]


def salvar(arq, rgb):
    """rgb (h, w, 3) sRGB 0..1, linha 0 = baixo (convenção do Blender) → PNG."""
    h, w = rgb.shape[:2]
    im = bpy.data.images.new('_salvar', w, h, alpha=False)
    im.pixels = np.concatenate([rgb, np.ones((h, w, 1))], 2).astype(np.float32).ravel()
    im.filepath_raw = arq
    im.file_format = 'PNG'
    im.save()
    bpy.data.images.remove(im)


def _pele_px(ctx, cam):
    sc = bpy.context.scene
    W, H = sc.render.resolution_x, sc.render.resolution_y
    out = []
    for x, y in PELE_PONTOS:
        h = ctx['busto'].raio(G.bl((x, y, -0.2)), G.bl((0, 0, 1)))
        q = world_to_camera_view(sc, cam, h[0])
        out.append((int(q.x * W), int((1 - q.y) * H)))
    return out


def calibrar(ctx, pasta):
    """Ajusta `ENV` para a luminância da pele (4 pontos) do render bater com a captura do site (mesma câmera)."""
    import subprocess
    cam = comum.camera_site('1440x900', escala=1)
    bpy.context.view_layer.update()
    pts = _pele_px(ctx, cam)
    cod = ("import numpy as n,sys,json;from PIL import Image;"
           "a=n.asarray(Image.open(sys.argv[1]).convert('RGB'))/255.;p=json.loads(sys.argv[2]);"
           "print(json.dumps([a[y-3:y+4,x-3:x+4].reshape(-1,3).mean(0).tolist() for x,y in p]))")
    alvo = np.array(json.loads(subprocess.run(['python3', '-c', cod, CAPTURA_SITE, json.dumps(pts)],
                                              capture_output=True, text=True, check=True).stdout))
    x0, x1 = min(p[0] for p in pts) - 8, max(p[0] for p in pts) + 8
    y0, y1 = min(p[1] for p in pts) - 8, max(p[1] for p in pts) + 8
    borda = (x0 / 1440, x1 / 1440, 1 - y1 / 900, 1 - y0 / 900)
    pele = list(ctx['busto'].malhas.values())
    med = {}
    for env in (0.05, 0.30):
        mundo(env)
        rgb, _ = render(os.path.join(MT.TMP, '_cal.png'), pele, borda, 32)
        med[env] = np.array([rgb[y - y0 - 3:y - y0 + 4, x - x0 - 3:x - x0 + 4].reshape(-1, 3).mean(0) for x, y in pts])
    lum = lambda c: (c ** 2.2) @ np.array((0.2126, 0.7152, 0.0722))                    # noqa: E731
    la, lb, lt = lum(med[0.05]).mean(), lum(med[0.30]).mean(), lum(alvo).mean()
    env = float(np.clip(0.05 + (lt - la) / (lb - la) * 0.25, 0.0, 1.5))
    ESTADO['env'] = env
    mundo(env)
    bpy.data.objects.remove(cam)
    r = {'env_mundo': round(env, 3), 'pele_site_srgb': alvo.round(3).tolist(),
         'pele_render_env005': med[0.05].round(3).tolist(), 'pele_render_env030': med[0.30].round(3).tolist(),
         'pontos_px_1440': pts}
    print('CAL', json.dumps(r))
    return r


def rodar(ctx, med, pasta):
    os.makedirs(pasta, exist_ok=True)
    fades()
    luz_site()
    med['luz'] = calibrar(ctx, pasta)
    import prop_ai_prova_folha as folha
    med['leitura'] = folha.renders(ctx, med, pasta)
    with open(os.path.join(pasta, 'medidas.json'), 'w', encoding='utf-8') as f:
        json.dump(med, f, ensure_ascii=False, indent=1, default=float)
    print('MEDIDAS', os.path.join(pasta, 'medidas.json'))
