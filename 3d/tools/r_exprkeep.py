"""blender -b --python tools/r_exprkeep.py -- <in.blend> <out.blend> <veredito.json>
Mantém só as shape keys aprovadas no veredito (portão medido + conferência visual), zera todas, remove animação
e salva no NEUTRO. O arquivo de origem não é alterado."""
import bpy, sys, os, json
a = sys.argv[sys.argv.index("--")+1:]; ver = json.load(open(a[2])); keep = {k for k, v in ver.items() if v['aprovada']}
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(a[0])); o = bpy.data.objects['Busto']; sk = o.data.shape_keys
if sk.animation_data: sk.animation_data_clear()
for k in list(sk.key_blocks)[1:]:
    if k.name not in keep: o.shape_key_remove(k)
for k in sk.key_blocks: k.value = 0.0
o.active_shape_key_index = 0; bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a[1])); print("KEEP", len(sk.key_blocks)-1, sorted(keep))
