"""blender -b --python tools/closeup.py -- <in.blend> <out.png> <yaw_deg> <pitch_deg> <lens_mm> <zoom>
Close-up do rosto com luz frontal suave (mesma para todas as vistas). zoom<1 aproxima. yaw 0 = frente, +yaw = câmera para o lado esquerdo DO MODELO (direito da imagem)."""
import bpy, sys, os, math, json
from mathutils import Vector
a = sys.argv[sys.argv.index("--")+1:]; src, out = a[0], a[1]; yaw, pitch, lens, zoom = map(float, a[2:6])
bpy.ops.wm.open_mainfile(filepath=src); sc = bpy.context.scene; o = bpy.data.objects['Busto']
for ob in list(sc.objects):
    if ob.type in ('LIGHT','CAMERA'): bpy.data.objects.remove(ob)
sc.render.engine = 'BLENDER_EEVEE_NEXT'; sc.render.resolution_x = sc.render.resolution_y = 700
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Base Contrast'
w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs[0].default_value = (0.5,0.5,0.52,1); bg.inputs[1].default_value = 1.2
_lmf = os.environ.get('CLOSEUP_LM', os.path.join(os.path.dirname(src), '..', 'analise', 'lm3d_aligned.json'))
import numpy as _n
if os.environ.get('CLOSEUP_BBOX'):
    _P=_n.array([v.co[:] for v in o.data.vertices]); _c=(_P.min(0)+_P.max(0))/2; ctr=Vector((_c[0], _P.min(0)[1]+0.25*(_P.max(0)[1]-_P.min(0)[1]), _P.min(0)[2]+0.62*(_P.max(0)[2]-_P.min(0)[2])))
else:
    lm = json.load(open(_lmf)); _P=_n.array(list(lm.values())); ctr = Vector(((_P.min(0)+_P.max(0))/2).tolist())
def light(name, loc, e):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = e; ld.size = 1.0
    lo = bpy.data.objects.new(name, ld); sc.collection.objects.link(lo); lo.location = loc
    lo.rotation_euler = (ctr - lo.location).to_track_quat('-Z','Y').to_euler()
light("K", (-0.5,-1.0,ctr.z+0.6), 50); light("F", (0.7,-0.9,ctr.z+0.1), 25)
cd = bpy.data.cameras.new("C"); cd.lens = lens; cd.sensor_width = 36
cam = bpy.data.objects.new("C", cd); sc.collection.objects.link(cam); sc.camera = cam
dist = 0.55*zoom; r = math.radians(yaw); p = math.radians(pitch)
cam.location = (dist*math.sin(r)*math.cos(p), -dist*math.cos(r)*math.cos(p), ctr.z + dist*math.sin(p))
cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z','Y').to_euler()
cam.location = Vector(cam.location) + Vector((ctr.x, 0, 0))
sc.render.filepath = out; bpy.ops.render.render(write_still=True); print("CLOSEUP ok")
json.dump({"loc": list(cam.location), "rot": list(cam.rotation_euler), "lens": lens, "res": [sc.render.resolution_x, sc.render.resolution_y]}, open(out + ".cam.json", "w"))
