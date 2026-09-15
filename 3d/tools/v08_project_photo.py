# v08: projetar a foto frontal (ref-15) sobre a malha via pose PnP; UV de projeção; material mistura foto (frente, visível) + textura do scan.
# Render de apresentação com iluminação de estúdio.
import bpy, bmesh, sys, json, math, os, numpy as np
from mathutils import Vector, Matrix
argv=sys.argv[sys.argv.index("--")+1:]
blend, pnp_json, photo, out_blend, out_dir = argv
bpy.ops.wm.open_mainfile(filepath=blend)
o=bpy.data.objects["Busto"]; me=o.data
d=json.load(open(pnp_json)); f=d['f']; W,H=d['w'],d['h']
def rodrigues(r):
    r=np.array(r,dtype=float); th=np.linalg.norm(r)
    if th<1e-12: return np.eye(3)
    k=r/th; K=np.array([[0,-k[2],k[1]],[k[2],0,-k[0]],[-k[1],k[0],0]])
    return np.eye(3)+math.sin(th)*K+(1-math.cos(th))*(K@K)
R=rodrigues(d['rvec']); t=np.array(d['tvec'])
def project(p):
    X=R@np.array(p)+t
    if X[2]<=0: return None
    return (f*X[0]/X[2]+W/2, f*X[1]/X[2]+H/2, X[2])
# câmera Blender equivalente (para checagem visual): world = inv(extrinsics), com conversão OpenCV->Blender (y,z invertidos)
Rb=R.T; cam_pos=-R.T@t
M=Matrix.Identity(4)
flip=np.diag([1,-1,-1])
Rw=R.T@flip
for i in range(3):
    for j in range(3): M[i][j]=Rw[i,j]
    M[i][3]=cam_pos[i]
# UV de projeção + visibilidade (raycast do ponto até a câmera)
uv=me.uv_layers.new(name="Foto"); sc=bpy.context.scene
depsgraph=bpy.context.evaluated_depsgraph_get()
cam_v=Vector(cam_pos.tolist())
vis={}; 
for v in me.vertices:
    pr=project(v.co)
    if pr is None: vis[v.index]=0; continue
    # oclusão
    dirn=(cam_v-v.co); dist=dirn.length; dirn.normalize()
    hit=False
    inside= 0<=pr[0]<W and 0<=pr[1]<H
    facing=(v.normal.dot(dirn))
    tt=min(1.0,max(0.0,(facing-0.30)/0.25)); w=0.0 if not inside else tt*tt*(3-2*tt)
    vis[v.index]=w
# gravar uv por loop e peso em vertex color
vc=me.color_attributes.new(name="FotoPeso",type='FLOAT_COLOR',domain='POINT')
for v in me.vertices:
    pr=project(v.co); u=(pr[0]/W) if pr else 0; vv=1-(pr[1]/H) if pr else 0
    vc.data[v.index].color=(vis[v.index],vis[v.index],vis[v.index],1)
for poly in me.polygons:
    for li in poly.loop_indices:
        vi=me.loops[li].vertex_index; pr=project(me.vertices[vi].co)
        uv.data[li].uv=((pr[0]/W),(1-pr[1]/H)) if pr else (0,0)
print("VIS>0.5:",sum(1 for k in vis if vis[k]>0.5),"de",len(vis))
# material: misturar
img=bpy.data.images.load(photo)
for slot in o.material_slots:
    m=slot.material
    if m.name in ("NucaCabelo","NucaPele","Base"): continue
    nt=m.node_tree; bsdf=nt.nodes.get("Principled BSDF")
    base_link=[l for l in nt.links if l.to_socket==bsdf.inputs["Base Color"]]
    scan_tex=base_link[0].from_node if base_link else None
    tex=nt.nodes.new("ShaderNodeTexImage"); tex.image=img; tex.interpolation='Cubic'
    uvn=nt.nodes.new("ShaderNodeUVMap"); uvn.uv_map="Foto"; nt.links.new(uvn.outputs[0],tex.inputs[0])
    attr=nt.nodes.new("ShaderNodeVertexColor"); attr.layer_name="FotoPeso"
    mix=nt.nodes.new("ShaderNodeMix"); mix.data_type='RGBA'; mix.blend_type='MIX'
    nt.links.new(attr.outputs["Color"],mix.inputs["Factor"])
    if scan_tex: nt.links.new(scan_tex.outputs["Color"],mix.inputs[6])
    nt.links.new(tex.outputs["Color"],mix.inputs[7])
    nt.links.new(mix.outputs[2],bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value=0.8; bsdf.inputs["Specular IOR Level"].default_value=0.12
    print("MATERIAL",m.name,"scan_tex",bool(scan_tex))
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
# --- render de apresentação: 3 luzes, fundo neutro, Filmic
sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=700; sc.render.resolution_y=900
sc.view_settings.view_transform='AgX'; sc.view_settings.look='AgX - Medium High Contrast'
for ob in list(sc.objects):
    if ob.type in ('CAMERA','LIGHT'): bpy.data.objects.remove(ob)
w=bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True; w.node_tree.nodes["Background"].inputs[0].default_value=(0.25,0.25,0.27,1); w.node_tree.nodes["Background"].inputs[1].default_value=0.35
def light(name,loc,energy,size,color=(1,1,1)):
    ld=bpy.data.lights.new(name,'AREA'); ld.energy=energy; ld.size=size; ld.color=color
    lo=bpy.data.objects.new(name,ld); sc.collection.objects.link(lo); lo.location=loc
    lo.rotation_euler=(Vector((0,0,0.25))-Vector(loc)).to_track_quat('-Z','Y').to_euler(); return lo
light("Key",(0.9,-1.2,0.9),40,1.2,(1,0.97,0.93)); light("Fill",(-1.2,-1.0,0.4),20,1.6,(0.97,0.97,1)); light("Rim",(0.3,1.2,0.8),25,0.8)
cd=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam; cd.lens=85
top=max(v.co.z for v in me.vertices); cen=Vector((0,0,top*0.55)); dist=1.6
for name,deg in [("front",0),("q_left",-35),("side_left",-90),("q_right",35),("side_right",90),("back",180)]:
    a=math.radians(deg); cam.location=(cen.x+dist*math.sin(a), cen.y-dist*math.cos(a), cen.z+0.05)
    cam.rotation_euler=(cen-cam.location).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=os.path.join(out_dir,f"{name}.png"); bpy.ops.render.render(write_still=True)
