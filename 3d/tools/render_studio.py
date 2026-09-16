"""blender -b --python tools/render_studio.py -- <in.blend> <out_dir> <tag>
Render de apresentação: EEVEE Next, AgX, luz de estúdio 3 pontos, 4 vistas (frente, 3/4 E, 3/4 D, perfil D), 800x1000."""
import bpy, sys, os, math
from mathutils import Vector
a = sys.argv[sys.argv.index("--")+1:]; src, out_dir, tag = a
bpy.ops.wm.open_mainfile(filepath=src); os.makedirs(out_dir, exist_ok=True)
sc = bpy.context.scene; o = bpy.data.objects['Busto']
for ob in list(sc.objects):
    if ob.type in ('LIGHT','CAMERA'): bpy.data.objects.remove(ob)
try: sc.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError: sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 800, 1000
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs[0].default_value = (0.18,0.18,0.2,1); bg.inputs[1].default_value = 1.0
P = [v.co for v in o.data.vertices]; top = max(p.z for p in P); zc = top - 0.42*top
ctr = Vector((0, 0, zc))
def light(name, kind, loc, energy, size=1.0, color=(1,1,1)):
    ld = bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = color
    if kind == 'AREA': ld.size = size
    lo = bpy.data.objects.new(name, ld); sc.collection.objects.link(lo); lo.location = loc
    lo.rotation_euler = (ctr - lo.location).to_track_quat('-Z','Y').to_euler(); return lo
light("Key", 'AREA', (-0.7, -0.9, zc+0.5), 60, 0.8, (1,0.96,0.9))
light("Fill", 'AREA', (0.9, -0.8, zc+0.2), 20, 1.2, (0.9,0.95,1))
light("Rim", 'AREA', (0.4, 0.9, zc+0.6), 40, 0.5)
cd = bpy.data.cameras.new("C"); cd.lens = 85; cd.sensor_width = 36
cam = bpy.data.objects.new("C", cd); sc.collection.objects.link(cam); sc.camera = cam
dist = 3.2*top
views = {'front':0, 'q_left':-40, 'q_right':40, 'side_right':90}
for name, ang in views.items():
    r = math.radians(ang); cam.location = (dist*math.sin(r), -dist*math.cos(r), zc+0.02*top)
    cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath = os.path.join(out_dir, f"{tag}_{name}.png"); bpy.ops.render.render(write_still=True)
print("STUDIO ok")
