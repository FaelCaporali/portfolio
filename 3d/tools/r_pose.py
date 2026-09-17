"""blender -b --python tools/r_pose.py -- <in.blend> <out.blend> nome=valor[,nome=valor...]
Salva uma cópia com valores de shape keys (para renders de expressão)."""
import bpy, sys, os
a = sys.argv[sys.argv.index("--")+1:]
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(a[0])); kb = bpy.data.objects['Busto'].data.shape_keys.key_blocks
for kv in a[2].split(','):
    k, v = kv.split('='); kb[k].value = float(v)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a[1])); print("POSE", a[2])
