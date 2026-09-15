# Projeta landmarks 2D do render (câmera igual à de render_phone.py) sobre a malha por raycast -> landmarks 3D no modelo
import bpy, sys, json, math
from mathutils import Vector
from bpy_extras.view3d_utils import region_2d_to_origin_3d
argv=sys.argv[sys.argv.index("--")+1:]
blend, lmjson, out = argv[:3]; scale_arg=float(argv[3]) if len(argv)>3 else None
bpy.ops.wm.open_mainfile(filepath=blend)
o=bpy.data.objects["Busto"]; P=[v.co for v in o.data.vertices]
top=max(p.z for p in P); scale=scale_arg if scale_arg else top/0.23
nose=min([p for p in P if 0.12<p.z<0.40],key=lambda p:p.y); eye_z=nose.z+0.06*scale
sc=bpy.context.scene; sc.render.resolution_x=900; sc.render.resolution_y=1200
cd=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam
cd.sensor_width=36; cd.lens=26; dist=0.42*scale
cam.location=(0,nose.y-dist,eye_z-0.01*scale); target=Vector((0,nose.y,eye_z-0.01*scale))
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.context.view_layer.update()
d=json.load(open(lmjson)); W,H=d['size']
# raio por pixel: usar frame da câmera
frame=[cam.matrix_world @ f for f in cd.view_frame(scene=sc)]  # 4 cantos no espaço mundo (a distância focal/clip)
# view_frame: [top-right, bottom-right, bottom-left, top-left]
tr,br,bl,tl=frame
res={}
depsgraph=bpy.context.evaluated_depsgraph_get()
for i,(px,py) in enumerate(d['pts']):
    u=px/W; v=1-py/H
    p=bl+(br-bl)*u+(tl-bl)*v
    direction=(p-cam.location).normalized()
    hit,loc,nrm,idx,obj,mat=sc.ray_cast(depsgraph,cam.location,direction)
    if hit: res[i]=[round(c,5) for c in loc]
print("HITS",len(res),"/",len(d['pts']))
json.dump(res,open(out,'w'))
ids={'sellion':168,'nasion':6,'nose_tip':4,'subnasale':2,'chin':152,'eyeR_out':33,'eyeR_in':133,'eyeL_in':362,'eyeL_out':263,'cheekR':234,'cheekL':454,'jawR':172,'jawL':397,'mouthR':61,'mouthL':291,'browR':105,'browL':334,'forehead':10}
for k,i in ids.items():
    if i in res: print("%-10s"%k, res[i])
