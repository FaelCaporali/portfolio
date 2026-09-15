import bpy, sys, math
from mathutils import Vector, Matrix
argv=sys.argv[sys.argv.index("--")+1:]; blend,out=argv
bpy.ops.wm.open_mainfile(filepath=blend)
o=bpy.data.objects["Busto"]
for slot in o.material_slots:
    m=slot.material; nt=m.node_tree
    if m.name in ("NucaCabelo","NucaPele","Base"): continue
    attr=[n for n in nt.nodes if n.type=='VERTEX_COLOR'][0]
    em=nt.nodes.new("ShaderNodeEmission"); outn=[n for n in nt.nodes if n.type=='OUTPUT_MATERIAL'][0]
    nt.links.new(attr.outputs["Color"],em.inputs[0]); nt.links.new(em.outputs[0],outn.inputs[0])
    print("ATTR",attr.layer_name, "colorattrs",[c.name for c in o.data.color_attributes])
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=500; sc.render.resolution_y=650
for ob in list(sc.objects):
    if ob.type in ('CAMERA','LIGHT'): bpy.data.objects.remove(ob)
cd=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam; cd.lens=60
cen=Vector((0,0,0.225)); cam.location=(0,-1.1,0.225); cam.rotation_euler=(cen-cam.location).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=out; bpy.ops.render.render(write_still=True)
