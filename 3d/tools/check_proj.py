import bpy, sys, json, math, numpy as np
from mathutils import Vector, Matrix
argv=sys.argv[sys.argv.index("--")+1:]; blend,pnp_json,out_dir=argv
bpy.ops.wm.open_mainfile(filepath=blend)
o=bpy.data.objects["Busto"]
# forçar fator=1 (só foto) 
for slot in o.material_slots:
    nt=slot.material.node_tree
    for n in nt.nodes:
        if n.type=='MIX' and n.data_type=='RGBA':
            for l in list(nt.links):
                if l.to_socket==n.inputs[0]: nt.links.remove(l)
            n.inputs[0].default_value=1.0
d=json.load(open(pnp_json)); f=d['f']; W,H=d['w'],d['h']
def rodrigues(r):
    r=np.array(r,dtype=float); th=np.linalg.norm(r); k=r/th; K=np.array([[0,-k[2],k[1]],[k[2],0,-k[0]],[-k[1],k[0],0]])
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
w=bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True; w.node_tree.nodes["Background"].inputs[0].default_value=(0.5,0.5,0.5,1); w.node_tree.nodes["Background"].inputs[1].default_value=1.0
sc.render.filepath=out_dir+"/proj_from_pnp.png"; bpy.ops.render.render(write_still=True)
# vista frontal padrão
cd.sensor_fit='AUTO'; cd.lens=60; sc.render.resolution_x=600; sc.render.resolution_y=750
cen=Vector((0,0,0.225)); cam.matrix_world=Matrix.Identity(4); cam.location=(0,-1.1,0.225); cam.rotation_euler=(cen-cam.location).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=out_dir+"/proj_front.png"; bpy.ops.render.render(write_still=True)
