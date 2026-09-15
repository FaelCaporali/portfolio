# v03: restaurar o rosto assimétrico original (v02a alinhado) sobre a cabeça espelhada (v02),
# projetando os vértices da região facial na superfície original com peso que decai para trás
import bpy, sys, math, os
from mathutils import Vector, bvhtree
argv=sys.argv[sys.argv.index("--")+1:]
aligned_blend, mirrored_blend, out_blend, out_dir = argv
bpy.ops.wm.open_mainfile(filepath=aligned_blend)
me=bpy.data.objects["Busto"].data
P=[v.co.copy() for v in me.vertices]
nose=min([p for p in P if 0.12<p.z<0.40],key=lambda p:p.y); print("NOSE",nose)
verts=[(p.x-nose.x,p.y,p.z) for p in P]
polys=[list(pg.vertices) for pg in me.polygons]
bvh=bvhtree.BVHTree.FromPolygons(verts,polys)
bpy.ops.wm.open_mainfile(filepath=mirrored_blend)
o=bpy.data.objects["Busto"]; me=o.data
y0=nose.y+0.06; y1=nose.y+0.16
moved=0; maxd=0
def smooth(t): return t*t*(3-2*t)
for v in me.vertices:
    if v.co.y>y1 or v.co.z>0.36 or v.co.z<0.02: continue
    loc,nrm,idx,dist=bvh.find_nearest(v.co,0.03)
    if loc is None: continue
    w=1.0 if v.co.y<y0 else 1.0-smooth((v.co.y-y0)/(y1-y0))
    v.co=v.co.lerp(loc,w); moved+=1; maxd=max(maxd,dist)
print("MOVED",moved,"MAXD",round(maxd,4))
me.update()
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=600; sc.render.resolution_y=750
w=bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True; w.node_tree.nodes["Background"].inputs[0].default_value=(0.6,0.6,0.6,1)
cd=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam; cd.lens=60
c=Vector((0,0,0.225)); d=1.0
for name,deg in [("front",0),("q_left",-45),("side_left",-90),("back",180),("side_right",90),("q_right",45)]:
    a=math.radians(deg); cam.location=(c.x+d*math.sin(a), c.y-d*math.cos(a), c.z)
    cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=os.path.join(out_dir,f"{name}.png"); bpy.ops.render.render(write_still=True)
cam.location=(0,0,c.z+d); cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=os.path.join(out_dir,"top.png"); bpy.ops.render.render(write_still=True)
