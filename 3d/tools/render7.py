import bpy, sys, os, math
from mathutils import Vector
argv=sys.argv[sys.argv.index("--")+1:]; blend,out_dir=argv
bpy.ops.wm.open_mainfile(filepath=blend)
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=600; sc.render.resolution_y=750
for ob in list(sc.objects):
    if ob.type in ('CAMERA','LIGHT'): bpy.data.objects.remove(ob)
w=bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True; w.node_tree.nodes["Background"].inputs[0].default_value=(0.6,0.6,0.6,1)
cd=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam; cd.lens=60
cen=Vector((0,0,0.225)); d=1.1
for name,deg in [("front",0),("q_left",-45),("side_left",-90),("back",180),("side_right",90),("q_right",45)]:
    a=math.radians(deg); cam.location=(cen.x+d*math.sin(a), cen.y-d*math.cos(a), cen.z)
    cam.rotation_euler=(cen-cam.location).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=os.path.join(out_dir,f"{name}.png"); bpy.ops.render.render(write_still=True)
cam.location=(0,0,cen.z+d); cam.rotation_euler=(cen-cam.location).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=os.path.join(out_dir,"top.png"); bpy.ops.render.render(write_still=True)
