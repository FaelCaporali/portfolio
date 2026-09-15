import bpy, sys, math, os
argv = sys.argv[sys.argv.index("--")+1:]
obj_path, out_dir, tag = argv
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=obj_path)
objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
verts=sum(len(o.data.vertices) for o in objs); faces=sum(len(o.data.polygons) for o in objs)
# bbox
xs=[];ys=[];zs=[]
for o in objs:
    for v in o.bound_box:
        w=o.matrix_world @ __import__('mathutils').Vector(v); xs.append(w.x);ys.append(w.y);zs.append(w.z)
cx,cy,cz=(min(xs)+max(xs))/2,(min(ys)+max(ys))/2,(min(zs)+max(zs))/2
size=max(max(xs)-min(xs),max(ys)-min(ys),max(zs)-min(zs))
print(f"STATS {tag} verts={verts} faces={faces} dims=({max(xs)-min(xs):.3f},{max(ys)-min(ys):.3f},{max(zs)-min(zs):.3f}) mats={[m.name for o in objs for m in o.data.materials]}")
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE_NEXT' if hasattr(bpy.types,'SceneEEVEE') else 'BLENDER_EEVEE'
scene.render.resolution_x=900; scene.render.resolution_y=1100
world=bpy.data.worlds.new("W"); scene.world=world; world.use_nodes=True
world.node_tree.nodes["Background"].inputs[1].default_value=1.0
world.node_tree.nodes["Background"].inputs[0].default_value=(0.6,0.6,0.6,1)
cam_data=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cam_data); scene.collection.objects.link(cam); scene.camera=cam
cam_data.lens=60
dist=size*2.2
views={"front":0,"three_quarter":45,"side":90,"back":180}
import mathutils
for name,deg in views.items():
    a=math.radians(deg)
    cam.location=(cx+dist*math.sin(a), cy-dist*math.cos(a), cz)
    direction=mathutils.Vector((cx,cy,cz))-cam.location
    cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.join(out_dir,f"{tag}_{name}.png")
    bpy.ops.render.render(write_still=True)
    # untextured (matcap-like) pass: solid gray
for name in ["three_quarter"]:
    for o in objs:
        for slot in o.material_slots:
            m=bpy.data.materials.new("Gray"); m.use_nodes=True; slot.material=m
    a=math.radians(45)
    cam.location=(cx+dist*math.sin(a), cy-dist*math.cos(a), cz)
    direction=mathutils.Vector((cx,cy,cz))-cam.location
    cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.join(out_dir,f"{tag}_{name}_gray.png")
    bpy.ops.render.render(write_still=True)
