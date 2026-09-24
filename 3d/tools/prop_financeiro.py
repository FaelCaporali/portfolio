"""Adereço da vida "Financial Assistant": geometria e materiais do painel de planilha, da bandeira de meta e da moeda.

Headless (fonte de verdade, reprodutível):
    blender -b --python 3d/tools/prop_financeiro.py -- [glb=3d/export/props/financeiro.glb] [renders=<pasta>|0] [tag=v1]

Unidades: metros na escala do scan do S13 (a cabeça tem ~0,18 de largura). O site (R3F) posiciona as peças; aqui cada
peça fica na própria origem:
  Frame/Glass: painel no plano XZ do Blender, virado para −Y (vira +Z no glTF), centro na origem. O vidro tem UV 0..1 na
               área útil: o canvas da planilha (números, fórmula, grade) é desenhado no site e aplicado nessa UV.
  Coin:        eixo em Z (Y no glTF), centro na origem. Uma malha só; o site instancia a pilha.
  Pole/Finial/Pennant: pé do mastro na origem, mastro para +Z; a flâmula aponta para −X (para a cabeça).
Tudo o que o glb carrega é forma e parâmetro PBR; a desintegração (withDissolve) é aplicada no site.
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
ARGS = dict(a.split('=', 1) for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []))
GLB = os.path.join(ROOT, ARGS.get('glb', '3d/export/props/financeiro.glb'))
RENDERS = ARGS.get('renders', '3d/captura/props/financeiro/blender')
TAG = ARGS.get('tag', 'v1')

# ---------------------------------------------------------------------------------------------------------------------
# Medidas (compartilhadas com src/features/hero/scene/props/ledger/ — mudar nos dois lados)
GLASS_W, GLASS_H, GLASS_R = 0.165, 0.118, 0.0045   # área útil do vidro = canvas 768 x 550
FRAME_B, FRAME_D = 0.0038, 0.0046                  # largura da moldura, profundidade total
COIN_R, COIN_T = 0.0145, 0.0036                    # raio e espessura (proporção de moeda real ~1:8)
REEDS = 48                                         # serrilha (cada estria = 2 vértices, sombreamento suave)
POLE_H, POLE_R = 0.05, 0.0008
PENNANT_L, PENNANT_H = 0.03, 0.017

# Cores (sRGB). Dourado da vida = #c9a227 (src/content/journey.ts), só na moeda e na bandeira.
GOLD = '#c9a227'


def srgb(hexcolor):
    h = hexcolor.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1.0,)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def mesh_obj(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return link(bpy.data.objects.new(name, me))


def shade(obj, angle_deg=None):
    """Suave; com ângulo, arestas mais vivas que ele ficam duras (o exportador glTF divide as normais nelas)."""
    for p in obj.data.polygons:
        p.use_smooth = True
    if angle_deg is not None:
        bpy.context.view_layer.objects.active = obj
        for o in bpy.context.selected_objects:
            o.select_set(False)
        obj.select_set(True)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle_deg), keep_sharp_edges=True)


def material(name, color, metallic, roughness, alpha=1.0, double=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = srgb(color)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = roughness
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    m.use_backface_culling = not double
    return m


# ---------------------------------------------------------------------------------------------------------------------
# Painel
def rounded_rect(w, h, r, seg=8):
    """Laço de um retângulo arredondado no plano XZ (anti-horário visto de −Y), começando no canto superior direito."""
    pts = []
    corners = [(w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)]
    for cx, cz, a0 in corners:
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def build_frame():
    """Moldura de alumínio anodizado: anel de retângulo arredondado, paredes retas e chanfro arredondado (Bevel)."""
    bm = bmesh.new()
    outer = rounded_rect(GLASS_W + 2 * FRAME_B, GLASS_H + 2 * FRAME_B, GLASS_R + FRAME_B)
    inner = rounded_rect(GLASS_W, GLASS_H, GLASS_R)
    d = FRAME_D / 2
    loops = {}
    for key, pts, y in (('of', outer, -d), ('if', inner, -d), ('ob', outer, d), ('ib', inner, d)):
        loops[key] = [bm.verts.new((x, y, z)) for x, z in pts]
    n = len(outer)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((loops['of'][i], loops['of'][j], loops['if'][j], loops['if'][i]))   # frente (−Y)
        bm.faces.new((loops['ob'][j], loops['ob'][i], loops['ib'][i], loops['ib'][j]))   # trás
        bm.faces.new((loops['ob'][i], loops['ob'][j], loops['of'][j], loops['of'][i]))   # parede externa
        bm.faces.new((loops['if'][i], loops['if'][j], loops['ib'][j], loops['ib'][i]))   # parede interna
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = mesh_obj('Frame', bm)
    bev = obj.modifiers.new('Chanfro', 'BEVEL')
    bev.width, bev.segments, bev.limit_method, bev.angle_limit = 0.0007, 3, 'ANGLE', math.radians(40)
    bev.harden_normals = False
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier='Chanfro')
    shade(obj, 35)
    return obj


def build_glass():
    """Vidro: face única com UV 0..1 na área útil (u da esquerda para a direita, v de baixo para cima)."""
    bm = bmesh.new()
    pts = rounded_rect(GLASS_W, GLASS_H, GLASS_R)
    vs = [bm.verts.new((x, 0.0, z)) for x, z in pts]
    face = bm.faces.new(vs)
    face.normal_update()
    if face.normal.y > 0:
        face.normal_flip()
    uv = bm.loops.layers.uv.new('UVMap')
    for loop in face.loops:
        x, _, z = loop.vert.co
        loop[uv].uv = (x / GLASS_W + 0.5, z / GLASS_H + 0.5)
    bmesh.ops.triangulate(bm, faces=[face], quad_method='BEAUTY', ngon_method='BEAUTY')
    return mesh_obj('Glass', bm)


# ---------------------------------------------------------------------------------------------------------------------
# Moeda
def sigma_outline(a=0.0050, h=0.0060, w=0.0015, s=0.0022, p=0.0013, s2=0.0027):
    """Contorno de um Σ (a soma: a fórmula que fecha a planilha), no plano XY, sentido horário."""
    return [(-a, h), (a, h), (a, h - w), (-a + s, h - w), (p, 0.0), (-a + s, -h + w), (a, -h + w), (a, -h),
            (-a, -h), (-a, -h + w), (p - s2, 0.0), (-a, h - w)]


def coin_profile():
    """Perfil (raio, z) do topo para a borda: campo, rampa da orla, orla, chanfro. A serrilha fica entre os chanfros."""
    h = COIN_T / 2
    c = 0.00042                 # chanfro
    rim_w = 0.00135             # largura do topo da orla
    field_z = h - 0.00038       # campo rebaixado (o relevo fica protegido pela orla, como numa moeda real)
    r_field = COIN_R - c - rim_w - 0.0005
    return [
        (r_field - 0.0004, field_z),     # anel interno do campo: confina o degradê de normal à borda
        (r_field, field_z),
        (COIN_R - c - rim_w, h),         # início do topo da orla
        (COIN_R - c, h),                 # fim da orla / início do chanfro
    ], c, field_z


def build_coin():
    bm = bmesh.new()
    rings_top, c, field_z = coin_profile()
    h = COIN_T / 2
    seg = REEDS * 2
    depth = 0.00030

    def ring(r, z, reeded=False):
        out = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            rr = r - (depth if (reeded and i % 2) else 0.0)
            out.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        return out

    top = [ring(r, z) for r, z in rings_top]
    side_top = ring(COIN_R, h - c, reeded=True)
    side_bot = ring(COIN_R, -h + c, reeded=True)
    bot = [ring(r, -z) for r, z in rings_top]
    chain = top + [side_top, side_bot] + list(reversed(bot))
    for ra, rb in zip(chain, chain[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((ra[i], ra[j], rb[j], rb[i]))
    for z, rg in ((field_z, top[0]), (-field_z, bot[0])):
        center = bm.verts.new((0, 0, z))
        for i in range(seg):
            bm.faces.new((center, rg[(i + 1) % seg], rg[i]) if z > 0 else (center, rg[i], rg[(i + 1) % seg]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    # Σ em relevo nas duas faces (no verso espelhado em X, para ler certo visto por baixo).
    relief = 0.0003
    for sign in (1, -1):
        outline = sigma_outline()
        vs = [bm.verts.new((x * sign, y, sign * field_z)) for x, y in outline]
        f = bm.faces.new(vs)
        f.normal_update()
        if f.normal.z * sign < 0:
            f.normal_flip()
        # Sem manter o original: a face sobe e deixa as paredes; o fundo fica aberto, apoiado no campo.
        ext = bmesh.ops.extrude_face_region(bm, geom=[f], use_keep_orig=False)
        moved = [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, verts=moved, vec=(0, 0, sign * relief))
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])

    # UV planar vista de cima (mapa de desgaste do site): 0..1 no diâmetro.
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for loop in f.loops:
            x, y, _ = loop.vert.co
            loop[uv].uv = (x / (2 * COIN_R) + 0.5, y / (2 * COIN_R) + 0.5)
    obj = mesh_obj('Coin', bm)
    # Duro só nas paredes do Σ (90°); orla, chanfro e serrilha ficam suaves (a moeda real é arredondada nessa escala).
    shade(obj, 60)
    return obj


# ---------------------------------------------------------------------------------------------------------------------
# Bandeira de meta
def build_pole():
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12, radius1=POLE_R, radius2=POLE_R * 0.8,
                          depth=POLE_H)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, POLE_H / 2))
    obj = mesh_obj('Pole', bm)
    shade(obj, 50)
    return obj


def build_finial():
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=0.0017)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, POLE_H + 0.0012))
    obj = mesh_obj('Finial', bm)
    shade(obj)
    return obj


def build_pennant():
    """Flâmula triangular de cetim com duas dobras suaves (onda que cresce da haste para a ponta) e leve caimento."""
    bm = bmesh.new()
    nu, nv = 14, 8
    top = POLE_H - 0.001
    grid = []
    for i in range(nu + 1):
        u = i / nu
        row = []
        for j in range(nv + 1):
            v = j / nv                         # 0 = borda de baixo, 1 = borda de cima
            half = (1 - u) * PENNANT_H / 2     # triângulo: altura some na ponta
            x = -u * PENNANT_L
            z = top - PENNANT_H / 2 + (v - 0.5) * 2 * half - 0.0022 * u * u
            # Duas ondas (a segunda mais curta, em diagonal) crescendo da haste para a ponta: tecido ao vento.
            y = (0.0045 * math.sin(u * 2.2 * math.pi + 0.3) + 0.0014 * math.sin(u * 4.6 * math.pi + v * 1.8)) * (u ** 0.6)
            row.append(bm.verts.new((x - POLE_R * 0.9, y, z)))
        grid.append(row)
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for loop in f.loops:
            x, _, z = loop.vert.co
            loop[uv].uv = (-x / PENNANT_L, (z - (top - PENNANT_H)) / PENNANT_H)
    obj = mesh_obj('Pennant', bm)
    shade(obj)
    return obj


# ---------------------------------------------------------------------------------------------------------------------
def build():
    reset()
    mats = {
        'Frame': material('Aluminio', '#6e747d', 1.0, 0.3),
        'Glass': material('Vidro', '#161b21', 0.0, 0.24, alpha=0.62),
        'Coin': material('Ouro', GOLD, 1.0, 0.28),
        'Pole': material('Aco', '#b9bec6', 1.0, 0.3),
        'Finial': material('Ouro', GOLD, 1.0, 0.3),
        'Pennant': material('Cetim', GOLD, 0.1, 0.52, double=True),
    }
    mats['Finial'] = mats['Coin']
    objs = [build_frame(), build_glass(), build_coin(), build_pole(), build_finial(), build_pennant()]
    for o in objs:
        o.data.materials.append(mats[o.name])
    return objs


def export(objs):
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(o in objs)
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_texcoords=True, export_normals=True, export_materials='EXPORT',
                              export_cameras=False, export_lights=False, export_extras=False)
    stats = {o.name: len(o.data.vertices) for o in objs}
    print('FIN glb', GLB, os.path.getsize(GLB), 'bytes', stats)


# ---------------------------------------------------------------------------------------------------------------------
# Renders de conferência (Cycles, estúdio com caixas de luz que o metal reflete; argila para julgar a forma)
def studio():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for dev in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = dev
            prefs.get_devices()
            if any(d.type == dev for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == dev
                sc.cycles.device = 'GPU'
                break
        except TypeError:
            continue
    sc.cycles.samples = 96
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'AgX'
    sc.render.resolution_x, sc.render.resolution_y = 900, 900
    sc.render.film_transparent = False
    w = bpy.data.worlds.new('W')
    sc.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = srgb('#0b0b0e')
    bg.inputs[1].default_value = 1.0

    def area(name, loc, energy, size, color=(1, 1, 1)):
        L = bpy.data.lights.new(name, 'AREA')
        L.energy, L.size, L.color = energy, size, color
        o = link(bpy.data.objects.new(name, L))
        o.location = loc
        d = Vector((0, 0, 0)) - o.location
        o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        o.data.cycles.is_caustics_light = False
        return o

    # Mesmas direções da cena do site (Lighting.tsx: chave quente acima-esquerda, preenchimento frio, contraluz),
    # convertidas de Y-up/+Z frente para Z-up/−Y frente.
    area('Chave', (-0.6, -0.9, 0.8), 1.4, 0.6, (1.0, 0.95, 0.9))
    area('Preench', (0.8, -0.6, 0.3), 0.4, 0.8, (0.87, 0.91, 1.0))
    area('Contra', (0.3, 1.0, 0.4), 0.5, 0.6)
    # Caixas de luz visíveis só em reflexo: dão ao metal o que refletir (o site usa o RoomEnvironment para isso).
    for i, (loc, size) in enumerate((((-0.35, -0.35, 0.45), 0.35), ((0.4, -0.25, 0.15), 0.25), ((0, 0.3, 0.5), 0.3))):
        bpy.ops.mesh.primitive_plane_add(size=size, location=loc)
        p = bpy.context.active_object
        p.name = 'Softbox%d' % i
        p.rotation_euler = (Vector((0, 0, 0)) - p.location).to_track_quat('Z', 'Y').to_euler()
        m = bpy.data.materials.new('SB%d' % i)
        m.use_nodes = True
        nt = m.node_tree
        for n in list(nt.nodes):
            if n.type != 'OUTPUT_MATERIAL':
                nt.nodes.remove(n)
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs[1].default_value = 2.5
        nt.links.new(em.outputs[0], next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL').inputs[0])
        p.data.materials.append(m)
        p.visible_camera = False


def camera_on(target, dist, az, el, lens=85):
    sc = bpy.context.scene
    cam = sc.camera
    if cam is None:
        cam = link(bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')))
        sc.camera = cam
    cam.data.lens = lens
    cam.data.clip_start = 0.001
    t = Vector(target)
    a, e = math.radians(az), math.radians(el)
    cam.location = t + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler()


def only(names):
    for o in bpy.context.scene.objects:
        if o.type == 'MESH' and not o.name.startswith('Softbox'):
            o.hide_render = o.name not in names


def clay(on):
    """Argila: todos os materiais trocados por cinza fosco (roughness 0,8), para ver forma, dobra e chanfro."""
    key = '_clay'
    if on:
        cm = bpy.data.materials.get(key) or material(key, '#b5b5b5', 0.0, 0.8, double=True)
        for o in bpy.context.scene.objects:
            if o.type == 'MESH' and not o.name.startswith('Softbox'):
                o['mat'] = o.data.materials[0].name
                o.data.materials[0] = cm
    else:
        for o in bpy.context.scene.objects:
            if 'mat' in o:
                o.data.materials[0] = bpy.data.materials[o['mat']]


def shoot(name):
    out = os.path.join(ROOT, RENDERS, '%s-%s.png' % (TAG, name))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.context.scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('FIN render', out)


def stack_preview():
    """Pilha de 5 moedas com desalinhamento leve (a mesma que o site monta) + bandeira atrás, para conferência."""
    coin = bpy.data.objects['Coin']
    made = []
    for i, (dx, dy, rot) in enumerate(((0, 0, 0), (0.0007, -0.0004, 17), (-0.0005, 0.0006, 41), (0.0009, 0.0003, 66),
                                       (-0.0003, -0.0007, 88))):
        c = coin.copy()
        link(c)
        c.location = (dx, dy, COIN_T / 2 + i * COIN_T * 1.005)
        c.rotation_euler = (0, 0, math.radians(rot))
        c.name = 'CoinPrev%d' % i
        made.append(c.name)
    for n in ('Pole', 'Finial', 'Pennant'):
        o = bpy.data.objects[n]
        o.location = (0, 0.012, 0.0)
    return made


def renders():
    studio()
    # 1. Argila: forma pura, de frente, 3/4 e de baixo (o site vê o adereço um pouco de baixo).
    clay(True)
    only({'Coin'})
    camera_on((0, 0, 0), 0.12, 20, 35)
    shoot('argila-moeda-34')
    camera_on((0, 0, 0), 0.07, 0, 4)
    shoot('argila-moeda-borda')
    only({'Frame', 'Glass'})
    camera_on((0.05, 0, 0.04), 0.13, 25, 12)
    shoot('argila-moldura-canto')
    only({'Pole', 'Finial', 'Pennant'})
    camera_on((-0.012, 0, 0.04), 0.16, 10, -8)
    shoot('argila-bandeira')
    clay(False)
    # 2. Materiais.
    only({'Coin'})
    camera_on((0, 0, 0), 0.075, 15, 50)
    shoot('mat-moeda-face')
    camera_on((0, 0, 0), 0.06, 0, 6)
    shoot('mat-moeda-borda')
    names = stack_preview()
    only(set(names) | {'Pole', 'Finial', 'Pennant'})
    camera_on((0, 0.004, 0.022), 0.2, -12, -6)
    shoot('mat-pilha-bandeira')
    only({'Frame', 'Glass'})
    camera_on((0, 0, 0), 0.36, -20, 0)
    shoot('mat-painel')


if __name__ == '__main__':
    built = build()
    export(built)
    if RENDERS != '0':
        renders()
