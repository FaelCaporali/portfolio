"""blender -b --python tools/mark_blend.py -- <in.blend> <out.blend> x,y,z;x,y,z ... (mm)  esferas de 0,6 mm (vermelho=x<0, azul=x>0, verde=x=0)"""
import bpy, sys
a = sys.argv[sys.argv.index("--")+1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
for s in a[2].split(';'):
    x, y, z = [float(v)/1000 for v in s.split(',')]
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0006, location=(x, y, z))
    o = bpy.context.view_layer.objects.active; mat = bpy.data.materials.new('m'); mat.diffuse_color = (1, 0, 0, 1) if x < -1e-4 else ((0, 0, 1, 1) if x > 1e-4 else (0, 1, 0, 1)); o.data.materials.append(mat)
bpy.ops.wm.save_as_mainfile(filepath=a[1])
