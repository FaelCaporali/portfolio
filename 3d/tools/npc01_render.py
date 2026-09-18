"""blender -b <arquivo.blend> --python tools/npc01_render.py -- <out_prefix> <vista[,vista...]> [chave=valor ...] [res=800] [pose=nome]
Renderiza o NPC01 em EEVEE com luz propria. Vistas: front, q34, q34l, profile, profileL, back, body, body34, face, face34, faceP.
'chave=valor' poe a chave de forma em todos os objetos que a tiverem. pose=A|B aplica uma pose de corpo no rig."""
import bpy, sys, math, os
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; out, views = a[0], a[1].split(','); opts = dict(x.split('=') for x in a[2:])
res = int(opts.pop('res', 900)); pose = opts.pop('pose', None); bg = opts.pop('bg', 'studio')
sc = bpy.context.scene
try: sc.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError: sc.render.engine = 'BLENDER_EEVEE'
sc.eevee.taa_render_samples = 16; sc.render.resolution_x = sc.render.resolution_y = res; sc.render.film_transparent = False
sc.render.image_settings.file_format = 'PNG'; sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
sc.eevee.use_shadows = True
w = sc.world or bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
bgn = w.node_tree.nodes.get('Background'); bgn.inputs[0].default_value = (0.62, 0.66, 0.72, 1) if bg == 'studio' else (1, 1, 1, 1); bgn.inputs[1].default_value = 1.0
for k, v in opts.items():
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.data.shape_keys and k in o.data.shape_keys.key_blocks: o.data.shape_keys.key_blocks[k].value = float(v)
def lamp(name, typ, loc, energy, color=(1, 1, 1), size=2.0):
    L = bpy.data.lights.new(name, typ); L.energy = energy; L.color = color
    if typ == 'AREA': L.size = size
    if typ == 'SUN': L.angle = math.radians(8)
    o = bpy.data.objects.new(name, L); sc.collection.objects.link(o); o.location = loc; return o
def aim(o, target):
    d = Vector(target) - o.location; o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
body = bpy.data.objects.get('NPC01'); arm = bpy.data.objects.get('NPC01.rig')
head_c = Vector(body.get('head_center', (0, -0.06, 1.62))) if body else Vector((0, -0.06, 1.62)); head_r = body.get('head_radius', 0.18) if body else 0.18
zmax = max((v.co.z for v in body.data.vertices), default=1.8) if body else 1.8
sun = lamp('Key', 'SUN', (2, -3, 4), 3.0); aim(sun, head_c)
fill = lamp('Fill', 'AREA', (-3, -2.5, 2.2), 250, (0.9, 0.95, 1.0), 3.0); aim(fill, head_c)
rim = lamp('Rim', 'AREA', (1.5, 3, 2.8), 300, (1.0, 0.95, 0.9), 2.0); aim(rim, head_c)
cam = bpy.data.cameras.new('Cam'); co = bpy.data.objects.new('Cam', cam); sc.collection.objects.link(co); sc.camera = co
if pose and arm:
    import json; P = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'npc01_poses.json')))[pose]
    for bn, rot in P.items():
        pb = arm.pose.bones.get(bn)
        if pb: pb.rotation_mode = 'XYZ'; pb.rotation_euler = [math.radians(r) for r in rot]
def shoot(view):
    full_c = Vector((0, 0, zmax / 2 + 0.05)); full_r = zmax / 2 * 1.18
    ang = {'front': 0, 'q34': 40, 'q34l': -40, 'profile': 90, 'profileL': -90, 'back': 180, 'body': 0, 'body34': 30, 'face': 0, 'face34': 40, 'faceP': 90, 'facePR': -90, 'face34R': -40, 'profileR': -90, 'q34R': -40}[view]
    if view.startswith('body'): c, r, f = full_c, full_r, 85
    elif view.startswith('face'): c, r, f = head_c, head_r * 0.95, 60
    else: c, r, f = head_c, head_r * 1.15, 85
    cam.lens = f; d = r / math.tan(math.atan(18 / f)) * 1.0
    th = math.radians(ang); co.location = c + Vector((math.sin(th) * d, -math.cos(th) * d, 0)); aim(co, c)
    sc.render.filepath = '%s_%s.png' % (out, view); bpy.ops.render.render(write_still=True); print('NPC01 render', sc.render.filepath)
for v in views: shoot(v)
