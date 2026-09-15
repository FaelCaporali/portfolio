# v04: crânio por elipsoide anatômico. Proporção tragion->opistocrânio ≈ 0.87 × tragion->pronasal (Farkas).
import bpy, sys, math, os
from mathutils import Vector
argv=sys.argv[sys.argv.index("--")+1:]
src_blend, out_blend, out_dir = argv
bpy.ops.wm.open_mainfile(filepath=src_blend)
o=bpy.data.objects["Busto"]; me=o.data
P=[v.co for v in me.vertices]
nose=min([p for p in P if 0.12<p.z<0.40],key=lambda p:p.y)
ear=max([p for p in P if p.x>0 and 0.15<p.z<0.32],key=lambda p:p.x)
tragion=Vector((ear.x-0.01, ear.y+0.01, ear.z))
d_nose=(nose.y-tragion.y); occ_y=tragion.y+0.87*abs(d_nose)
top_z=max(p.z for p in P); half_w=max(p.x for p in P if 0.30<p.z<0.40)
print("NOSE",nose,"TRAGION",tragion,"OCC_Y",round(occ_y,4),"TOP",round(top_z,3),"HALF_W",round(half_w,3))
# elipsoide: centro (0, yc, zc); semi-eixos a (x), b (y), c (z)
zc=0.30; yc=tragion.y-0.005; b=occ_y-yc; c=top_z-zc+0.005; a=half_w+0.005
print("ELLIPSOID yc=%.3f zc=%.3f a=%.3f b=%.3f c=%.3f"%(yc,zc,a,b,c))
moved=0
for v in me.vertices:
    p=v.co
    if p.y<tragion.y+0.02 or p.z<0.06: continue   # só atrás das orelhas e acima do pescoço
    k=1-(p.x/a)**2-((p.z-zc)/c)**2
    if k<=0: continue
    yt=yc+b*math.sqrt(k)
    # transição suave: peso cresce de 0 (na orelha) a 1 (5 cm atrás)
    w=min(1.0,(p.y-(tragion.y+0.02))/0.05); w=w*w*(3-2*w)
    if yt>p.y:
        v.co.y=p.y+(yt-p.y)*w; moved+=1
    # nuca afunila para o pescoço abaixo de z=0.16
print("MOVED",moved)
me.update()
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=600; sc.render.resolution_y=750
w=bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True; w.node_tree.nodes["Background"].inputs[0].default_value=(0.6,0.6,0.6,1)
cd=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam; cd.lens=60
cen=Vector((0,0,0.225)); d=1.0
for name,deg in [("front",0),("q_left",-45),("side_left",-90),("back",180),("side_right",90),("q_right",45)]:
    ang=math.radians(deg); cam.location=(cen.x+d*math.sin(ang), cen.y-d*math.cos(ang), cen.z)
    cam.rotation_euler=(cen-cam.location).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=os.path.join(out_dir,f"{name}.png"); bpy.ops.render.render(write_still=True)
cam.location=(0,0,cen.z+d); cam.rotation_euler=(cen-cam.location).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=os.path.join(out_dir,"top.png"); bpy.ops.render.render(write_still=True)
