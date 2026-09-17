"""blender -b --python tools/prep_zup.py -- <in.obj> <tex.jpg> <out.blend> [rotz_deg=180]
Importa OBJ (Y-up do arquivo), aplica a rotação do import, gira em Z para o rosto ficar em -Y, centra (x,y) e base z=0,
nomeia 'Busto', empacota a textura."""
import bpy, sys, math, os, mathutils
a = sys.argv[sys.argv.index("--")+1:]; src, tex, out = a[:3]; rz = float(a[3]) if len(a) > 3 else 180
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.wm.obj_import(filepath=src)
o = [x for x in bpy.context.scene.objects if x.type == 'MESH'][0]; o.name = 'Busto'
bpy.context.view_layer.objects.active = o; o.select_set(True)
bpy.ops.object.transform_apply(rotation=True, location=True, scale=True)
o.matrix_world = mathutils.Matrix.Rotation(math.radians(rz), 4, 'Z') @ o.matrix_world
bpy.ops.object.transform_apply(rotation=True)
P = [v.co for v in o.data.vertices]; xs=[p.x for p in P]; ys=[p.y for p in P]; zs=[p.z for p in P]
o.location = (-(min(xs)+max(xs))/2, -(min(ys)+max(ys))/2, -min(zs)); bpy.ops.object.transform_apply(location=True)
for im in bpy.data.images:
    im.filepath = os.path.abspath(tex); im.reload(); im.pack()
P = [v.co for v in o.data.vertices]; n = min([p for p in P if 0.12 < p.z < 0.40], key=lambda p: p.y)
print("PREP z=%.3f..%.3f nariz=(%.3f, %.3f, %.3f)" % (min(zs)-min(zs), max(zs)-min(zs), n.x, n.y, n.z))
bpy.ops.wm.save_as_mainfile(filepath=out)
