import bpy, sys, os, math
from mathutils import Vector
argv=sys.argv[sys.argv.index("--")+1:]; obj,out_dir=argv
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=obj)
o=[x for x in bpy.context.scene.objects if x.type=='MESH'][0]
for m in o.data.materials:
    b=m.node_tree.nodes.get("Principled BSDF"); b.inputs["Roughness"].default_value=0.85; b.inputs["Specular IOR Level"].default_value=0.1
# suavizar normais
o.data.shade_smooth()
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=600; sc.render.resolution_y=750
sc.view_settings.view_transform='AgX'
w=bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True; w.node_tree.nodes["Background"].inputs[0].default_value=(0.35,0.35,0.37,1); w.node_tree.nodes["Background"].inputs[1].default_value=0.5
def light(name,loc,energy,size):
    ld=bpy.data.lights.new(name,'AREA'); ld.energy=energy; ld.size=size; lo=bpy.data.objects.new(name,ld); sc.collection.objects.link(lo); lo.location=loc
    lo.rotation_euler=(Vector((0,0,0))-Vector(loc)).to_track_quat('-Z','Y').to_euler()
light("Key",(0.3,-0.5,0.35),12,0.5); light("Fill",(-0.4,-0.4,0.1),6,0.6)
pts=[o.matrix_world@v.co for v in o.data.vertices]; cen=sum(pts,Vector())/len(pts)
cd=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam; cd.lens=85; d=0.55
for name,deg in [("front",0),("q_left",-35),("q_right",49),("side_right",90),("side_left",-90),("gray_front",0)]:
    if name=="gray_front":
        for m in o.data.materials:
            b=m.node_tree.nodes.get("Principled BSDF")
            for l in list(m.node_tree.links):
                if l.to_socket==b.inputs["Base Color"]: m.node_tree.links.remove(l)
            b.inputs["Base Color"].default_value=(0.6,0.6,0.6,1)
    a=math.radians(deg); cam.location=(cen.x+d*math.sin(a), cen.y-d*math.cos(a), cen.z)
    cam.rotation_euler=(cen-cam.location).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=os.path.join(out_dir,f"{name}.png"); bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir,"face.blend"))
