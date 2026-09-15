# v02: a partir do alinhamento de yaw (v02a), centrar pela ponta do nariz, descartar lado direito e nuca inventada,
# espelhar lado bom, fechar abertura (nuca + base) com tampa suave
import bpy, bmesh, sys, math, os
from mathutils import Vector
argv=sys.argv[sys.argv.index("--")+1:]
src_blend, out_blend, out_dir = argv
bpy.ops.wm.open_mainfile(filepath=src_blend)
o=bpy.data.objects["Busto"]; me=o.data
P=[v.co.copy() for v in me.vertices]
nose=min([p for p in P if 0.12<p.z<0.40],key=lambda p:p.y); print("NOSE_ALIGNED",nose)
for v in me.vertices: v.co.x-=nose.x
bm=bmesh.new(); bm.from_mesh(me)
L=bm.verts.layers.int.new('rim'); F=bm.faces.layers.int.new('cap')
cand=[v for v in bm.verts if v.co.x>0 and 0.15<v.co.z<0.32]
ear=max(cand,key=lambda v:v.co.x); print("EAR",ear.co)
y_back=ear.co.y+0.03
bad=[v for v in bm.verts if v.co.x<-0.004 or v.co.y>y_back]
bmesh.ops.delete(bm,geom=bad,context='VERTS')
for v in bm.verts:
    if abs(v.co.x)<0.010: v.co.x=0
geom=list(bm.verts)+list(bm.edges)+list(bm.faces)
bmesh.ops.mirror(bm,geom=geom,axis='X',merge_dist=0.003)
bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=0.003)
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
boundary=[e for e in bm.edges if e.is_boundary]; print("BOUNDARY",len(boundary))
rimkeys=set((round(v.co.x,4),round(v.co.y,4),round(v.co.z,4)) for e in boundary for v in e.verts)
rimcos=[v.co.copy() for e in boundary for v in e.verts][::5]
def isrim(v): return (round(v.co.x,4),round(v.co.y,4),round(v.co.z,4)) in rimkeys
res=bmesh.ops.holes_fill(bm,edges=boundary,sides=0); capf=res.get('faces',[]); print("HOLES",len(capf))
capf=bmesh.ops.triangulate(bm,faces=capf)['faces']
for f in capf: f[F]=1
for it in range(3):
    edges=list({e for f in capf for e in f.edges})
    sub=bmesh.ops.subdivide_edges(bm,edges=edges,cuts=1,use_grid_fill=True)
    capf=[f for f in bm.faces if f[F]==1]
    inner=list({v for f in capf for v in f.verts if not isrim(v) and v.co.z>0.005})
    for _ in range(12): bmesh.ops.smooth_vert(bm,verts=inner,factor=0.5,use_axis_x=True,use_axis_y=True,use_axis_z=True)
    if it<2:
        for v in inner:
            dmin=min((v.co-r).length for r in rimcos)
            v.co.y+=0.05*min(dmin/0.08,1.0)/(it+1)
        for _ in range(4): bmesh.ops.smooth_vert(bm,verts=inner,factor=0.3,use_axis_x=True,use_axis_y=True,use_axis_z=True)
print("CAPF",len(capf),"INNER",len(inner))
# achatar a base
for v in bm.verts:
    if v.co.z<0.004: v.co.z=0
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
bm.to_mesh(me); bm.free(); me.update()
print("VERTS",len(me.vertices),"FACES",len(me.polygons))
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
