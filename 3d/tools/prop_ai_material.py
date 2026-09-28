"""Materiais do robô da vida `ai` (a forma é do modelador; o acabamento fino é do lookdev).

- `ai_rigido`: tudo que é duro e opaco num material só (1 chamada por nó): cor por vértice ('Col', sRGB → linear) ×
  ORM de regiões (256 × 128, R = 1, G = rugosidade com ruído, B = metal). A UV põe cada face na célula da sua região.
- `ai_tampa`: policarbonato fumê (BLEND, alfa na cor-base), reflexo da sala nítida (extras envMapIntensity/envSharp).
- `ai_tela`: vidro escuro da tela; o site troca pelo canvas do rosto.
Calibração do grafite (anodizado): ver `GRAFITE` e o LOG (medido contra o fundo e o peito no render do site).
"""
import os
import subprocess

import bpy
import numpy as np
import tempfile

TMP = tempfile.gettempdir()     # respeita o TMPDIR
# região → (célula, rugosidade, variação, metal)
REGIOES = {'anodizado': 0, 'aco': 1, 'aluminio': 2, 'plastico': 3, 'nylon': 4, 'borracha': 5, 'pcb': 6, 'vidro': 7}
ORM = {'anodizado': (0.42, 0.05, 1.0), 'aco': (0.30, 0.06, 1.0), 'aluminio': (0.34, 0.06, 1.0),
       'plastico': (0.52, 0.06, 0.0), 'nylon': (0.62, 0.05, 0.0), 'borracha': (0.82, 0.05, 0.0),
       'pcb': (0.40, 0.08, 0.0), 'vidro': (0.12, 0.02, 0.0)}
# Paleta (sRGB). GRAFITE: calibrado para ler contra o fundo #0b0b0e e o peito que some no neckFade (LOG, MODELADOR).
GRAFITE = '#7d8187'
COR = {'grafite': GRAFITE, 'grafite_escuro': '#55585e', 'aco': '#b9bcc1', 'aluminio': '#c4c7cb',
       'servo': '#1c1d20', 'servo_etiqueta': '#2a2c31', 'nylon': '#dedbd3', 'borracha': '#1d1e20', 'cabo': '#2b2c30',
       'usb': '#9a9ea4', 'pcb': '#1f4a33', 'pcb_serigrafia': '#d8dcd6', 'chip': '#111214', 'ouro': '#c9a45a',
       'blindagem': '#b3b6bb', 'conector': '#e4e0d6', 'fita': '#c98a36', 'fita_contato': '#c9c3b5',
       'moldura_vidro': '#0b0c0e', 'sextavado': '#0d0d0f', 'pe': '#161719'}
ENV_TAMPA = 1.6                               # tampa: sala nítida (a borda e o reflexo desenham o policarbonato)


def lin4(h):
    """'#rrggbb' (sRGB) → (r, g, b, 1) linear, como o glTF espera em COLOR_0."""
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1.0,)


def celula(k):
    u0, v0 = (k % 4) / 4, (k // 4) / 2
    m = 4 / 256                                # margem ≥ 4 px no ORM de 256 px
    return (u0 + m, v0 + 2 * m, u0 + 0.25 - m, v0 + 0.5 - 2 * m)


def uv_regioes(bm, camada, reg, escala=60.0):
    """UV por projeção na caixa (eixo dominante da normal) dentro da célula da região, com repetição por módulo."""
    bm.normal_update()
    for f in bm.faces:
        u0, v0, u1, v1 = celula(f[reg])
        n = f.normal
        ax = max(range(3), key=lambda k: abs(n[k]))
        a, b = [k for k in range(3) if k != ax]
        for lp in f.loops:
            p = lp.vert.co
            s, t = (p[a] * escala) % 1.0, (p[b] * escala) % 1.0
            lp[camada].uv = (u0 + (u1 - u0) * s, v0 + (v1 - v0) * t)


def _ruido(h, w, cel, semente):
    rng = np.random.default_rng(semente)
    g = rng.random((h // cel + 2, w // cel + 2))
    y = np.linspace(0, g.shape[0] - 1.001, h)
    x = np.linspace(0, g.shape[1] - 1.001, w)
    y0, x0 = y.astype(int), x.astype(int)
    fy, fx = (y - y0)[:, None], (x - x0)[None, :]
    a = g[y0][:, x0] * (1 - fx) + g[y0][:, x0 + 1] * fx
    b = g[y0 + 1][:, x0] * (1 - fx) + g[y0 + 1][:, x0 + 1] * fx
    return a * (1 - fy) + b * fy


def imagem(nome, rgb, pasta, qualidade=92):
    """numpy (h, w, 3) 0..1 (linha 0 = v 0) → WebP em `pasta` → imagem do Blender (bytes embutidos como estão)."""
    os.makedirs(pasta, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)
    arq = os.path.join(pasta, nome + '.webp')
    tmp = os.path.join(TMP, nome + '.npy')
    np.save(tmp, np.ascontiguousarray((np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)[::-1]))
    cod = ("import numpy as n,sys;from PIL import Image;a=n.load(sys.argv[1]);"
           "Image.fromarray(a,'RGB').save(sys.argv[2],'WEBP',quality=int(sys.argv[3]),method=6)")
    subprocess.run(['python3', '-c', cod, tmp, arq, str(qualidade)], check=True)
    img = bpy.data.images.load(arq, check_existing=False)
    img.name = nome
    return img


def orm(pasta):
    h, w = 128, 256
    img = np.ones((h, w, 3))
    for reg, k in REGIOES.items():
        base, var, metal = ORM[reg]
        y0, x0 = (k // 4) * 64, (k % 4) * 64
        r = _ruido(64, 64, 6, 7 + k)
        if reg in ('anodizado', 'aluminio'):            # escovado: ruído alongado numa direção
            r = np.repeat(_ruido(64, 8, 2, 17 + k), 8, axis=1)[:, :64]
        img[y0:y0 + 64, x0:x0 + 64, 1] = np.clip(base + var * (r - 0.5) * 2, 0.05, 1)
        img[y0:y0 + 64, x0:x0 + 64, 2] = metal
    return imagem('ai_orm', img, pasta)


def _bsdf(m):
    return next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def materiais(pasta):
    """(ai_rigido, ai_tampa, ai_tela)."""
    rig = bpy.data.materials.new('ai_rigido')
    rig.use_nodes = True
    nt = rig.node_tree
    b = _bsdf(rig)
    ca = nt.nodes.new('ShaderNodeVertexColor')
    ca.layer_name = 'Col'
    nt.links.new(ca.outputs['Color'], b.inputs['Base Color'])
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = orm(pasta)
    t.image.colorspace_settings.name = 'Non-Color'
    uv = nt.nodes.new('ShaderNodeUVMap')
    uv.uv_map = 'UVMap'
    nt.links.new(uv.outputs['UV'], t.inputs['Vector'])
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(t.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], b.inputs['Roughness'])
    nt.links.new(sep.outputs['Blue'], b.inputs['Metallic'])

    tampa = bpy.data.materials.new('ai_tampa')
    tampa.use_nodes = True
    b = _bsdf(tampa)
    b.inputs['Base Color'].default_value = lin4('#2a2829')
    b.inputs['Roughness'].default_value = 0.08
    b.inputs['Metallic'].default_value = 0.0
    b.inputs['Alpha'].default_value = 0.34
    tampa.surface_render_method = 'BLENDED'
    tampa.use_backface_culling = False
    tampa['envMapIntensity'] = ENV_TAMPA
    tampa['envSharp'] = True

    tela = bpy.data.materials.new('ai_tela')
    tela.use_nodes = True
    b = _bsdf(tela)
    b.inputs['Base Color'].default_value = lin4('#060708')
    b.inputs['Roughness'].default_value = 0.14
    b.inputs['Metallic'].default_value = 0.0
    tela['canvas'] = 'o site troca este material pelo canvas do rosto (UV 0–1 = área útil)'
    return rig, tampa, tela


def fade(ob, mesa_bl_z, rampa):
    """2º UV `Fade` (TEXCOORD_1.x): 1 acima da mesa, rampa suave até 0 `rampa` m abaixo dela (altura de MUNDO)."""
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    me = ob.data
    y = np.array([(mw @ v.co).z for v in me.vertices])
    t = np.clip((y - (mesa_bl_z - rampa)) / rampa, 0, 1)
    f = t * t * (3 - 2 * t)
    lay = me.uv_layers.get('Fade') or me.uv_layers.new(name='Fade')
    for p in me.polygons:
        for li, vi in zip(p.loop_indices, p.vertices):
            lay.data[li].uv = (float(f[vi]), 0.5)
    me.uv_layers.active = me.uv_layers['UVMap']
    return f
