import bpy, sys, json, math, numpy as np
from mathutils import Vector, Matrix
argv=sys.argv[sys.argv.index("--")+1:]; blend,pnp_json,out=argv
bpy.ops.wm.open_mainfile(filepath=blend)
d=json.load(open(pnp_json)); f=d['f']; W,H=d['w'],d['h']
def rodrigues(r):
    r=np.array(r,dtype=float); th=np.linalg.norm(r)
    k=r/th; K=np.array([[0,-k[2],k[1]],[k[2],0,-k[0]],[-k[1],k[0],0]])
    return np.eye(3)+math.sin(th)*K+(1-math.cos(th))*(K@K)
R=rodrigues(d['rvec']); t=np.array(d['tvec']); cam_pos=-R.T@t; Rw=R.T@np.diag([1,-1,-1])
sc=bpy.context.scene
for ob in list(sc.objects):
    if ob.type in ('CAMERA','LIGHT'): bpy.data.objects.remove(ob)
cd=bpy.data.cameras.new("P"); cam=bpy.data.objects.new("P",cd); sc.collection.objects.link(cam); sc.camera=cam
cd.sensor_fit='HORIZONTAL'; cd.sensor_width=36; cd.lens=f/W*36
M=Matrix.Identity(4)
for i in range(3):
    for j in range(3): M[i][j]=Rw[i,j]
    M[i][3]=cam_pos[i]
cam.matrix_world=M
sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=W//4; sc.render.resolution_y=H//4
w=bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True; w.node_tree.nodes["Background"].inputs[0].default_value=(0.5,0.5,0.5,1)
sc.render.filepath=out; bpy.ops.render.render(write_still=True)
print("CAM",cam_pos,"lens",cd.lens)
