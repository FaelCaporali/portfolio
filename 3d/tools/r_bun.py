"""blender -b --python tools/r_bun.py -- <in.blend> <out.blend> <cx,cy,cz mm> <rx,ry,rz mm> [tilt_deg=20] [hair_rgb=17,12,10]
Coque como peça própria (elipsoide suavizado), medido nos pontos do scan atrás do crânio; material de cabelo."""
import bpy, bmesh, sys, os, math
a = sys.argv[sys.argv.index("--")+1:]; src, out = a[:2]
c = [float(v)/1000 for v in a[2].split(',')]; r = [float(v)/1000 for v in a[3].split(',')]
tilt = math.radians(float(a[4]) if len(a) > 4 else 20); rgb = [float(v)/255 for v in (a[5] if len(a) > 5 else '17,12,10').split(',')]
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(src))
old = bpy.data.objects.get('Coque')
if old: bpy.data.objects.remove(old)
bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=20, radius=1.0)
me = bpy.data.meshes.new('Coque'); bm.to_mesh(me); bm.free()
ob = bpy.data.objects.new('Coque', me); bpy.context.scene.collection.objects.link(ob)
ob.location = c; ob.scale = r; ob.rotation_euler = (tilt, 0, 0)
for p in me.polygons: p.use_smooth = True
m = bpy.data.materials.new('Cabelo'); m.use_nodes = True
b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); b.inputs['Base Color'].default_value = (*[x**2.2 for x in rgb], 1); b.inputs['Roughness'].default_value = 0.6
ob.data.materials.append(m); ob.color = (*[x**2.2 for x in rgb], 1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out)); print("R_BUN salvo", out)
