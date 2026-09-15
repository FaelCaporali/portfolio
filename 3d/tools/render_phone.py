# Render frontal com câmera equivalente ao celular (26 mm equiv, ~0,4 m real) para comparação justa com selfie
import bpy, sys, os, math
from mathutils import Vector
argv=sys.argv[sys.argv.index("--")+1:]
blend, out_png = argv[0], argv[1]; scale_arg=float(argv[2]) if len(argv)>2 else None
bpy.ops.wm.open_mainfile(filepath=blend)
o=bpy.data.objects["Busto"]; P=[v.co for v in o.data.vertices]
top=max(p.z for p in P); scale=scale_arg if scale_arg else top/0.23   # cabeça real ~0,23 m do queixo ao topo; aqui cabeça começa em z~0.02
nose=min([p for p in P if 0.12<p.z<0.40],key=lambda p:p.y)
eye_z=nose.z+0.06*scale*0.23/0.23  # olhos ~6 cm acima da ponta do nariz (real) -> escalar
eye_z=nose.z+0.06*scale
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=900; sc.render.resolution_y=1200
for ob in list(sc.objects):
    if ob.type in ('CAMERA','LIGHT'): bpy.data.objects.remove(ob)
w=bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True; w.node_tree.nodes["Background"].inputs[0].default_value=(0.55,0.55,0.55,1)
cd=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam
cd.sensor_width=36; cd.lens=26
dist=0.42*scale
cam.location=(0, nose.y-dist, eye_z-0.01*scale)
target=Vector((0,nose.y,eye_z-0.01*scale))
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
print("SCALE",round(scale,3),"DIST",round(dist,3),"EYE_Z",round(eye_z,3))
sc.render.filepath=out_png; bpy.ops.render.render(write_still=True)
