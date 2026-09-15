import bpy, sys, math, os, mathutils
obj_path, out = sys.argv[sys.argv.index("--")+1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=obj_path)
objs=[o for o in bpy.context.scene.objects if o.type=='MESH']; o=objs[0]
pts=[o.matrix_world @ v.co for v in o.data.vertices]
mn=[min(p[i] for p in pts) for i in range(3)]; mx=[max(p[i] for p in pts) for i in range(3)]
c=mathutils.Vector([(mn[i]+mx[i])/2 for i in range(3)]); size=max(mx[i]-mn[i] for i in range(3))
print("BBOX",mn,mx)
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=400; sc.render.resolution_y=500
w=bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True; w.node_tree.nodes["Background"].inputs[0].default_value=(0.6,0.6,0.6,1)
cd=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam; cd.lens=50
d=size*2.0
for k in range(8):
    a=math.radians(k*45)
    cam.location=(c.x+d*math.sin(a), c.y-d*math.cos(a), c.z)
    cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=os.path.join(out,f"yaw_{k*45:03d}.png"); bpy.ops.render.render(write_still=True)
# top view
cam.location=(c.x,c.y,c.z+d); cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=os.path.join(out,"top.png"); bpy.ops.render.render(write_still=True)
