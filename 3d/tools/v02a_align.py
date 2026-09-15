# v02a: estimar plano sagital com Chamfer aparado na pele (olhos/nariz/bochechas), alinhar, salvar e renderizar com linha central
import bpy, sys, math, os
from mathutils import Vector, Matrix, kdtree
argv=sys.argv[sys.argv.index("--")+1:]
src_blend, out_blend, out_dir = argv
bpy.ops.wm.open_mainfile(filepath=src_blend)
o=bpy.data.objects["Busto"]; me=o.data
P=[v.co.copy() for v in me.vertices]
nose=min([p for p in P if 0.12<p.z<0.40],key=lambda p:p.y); print("NOSE",nose)
region=[p for p in P if p.y<nose.y+0.10 and 0.14<p.z<0.36]
print("REGION",len(region))
def score(theta,x0):
    R=Matrix.Rotation(theta,3,'Z'); piv=Vector((x0,nose.y,0))
    q=[R@(p-piv) for p in region]
    kd=kdtree.KDTree(len(q)); [kd.insert(p,i) for i,p in enumerate(q)]; kd.balance()
    ds=sorted(kd.find(Vector((-p.x,p.y,p.z)))[2] for p in q[::2])
    k=int(len(ds)*0.6); return sum(ds[:k])/k
best=None
for deg in range(-30,31,3):
    for dx in [i*0.01 for i in range(-6,7)]:
        s=score(math.radians(deg),nose.x+dx)
        if best is None or s<best[0]: best=(s,deg,nose.x+dx)
for _ in range(2):
    s0,deg,x0=best
    for d2 in [deg+k for k in (-2,-1,-0.5,0,0.5,1,2)]:
        for dx in [x0+k for k in (-0.005,-0.0025,0,0.0025,0.005)]:
            s=score(math.radians(d2),dx)
            if s<best[0]: best=(s,d2,dx)
s0,deg,x0=best; print("SYM_FIT err=%.5f yaw=%.1f x0=%.4f"%(s0,deg,x0))
R=Matrix.Rotation(math.radians(deg),4,'Z')
for v in me.vertices: v.co=R@(v.co-Vector((x0,0,0)))
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=600; sc.render.resolution_y=750
w=bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True; w.node_tree.nodes["Background"].inputs[0].default_value=(0.6,0.6,0.6,1)
cd=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam; cd.lens=60
c=Vector((0,0,0.225)); d=1.0
for name,loc in [("front",(0,-d,c.z)),("top",(0,0,c.z+d))]:
    cam.location=loc; cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=os.path.join(out_dir,f"{name}.png"); bpy.ops.render.render(write_still=True)
