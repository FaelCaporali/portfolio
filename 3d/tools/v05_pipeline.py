# v05: cadeia completa a partir do OBJ do KIRI-01.
# 1) orientar (45° Z), cortar z>=ZCUT, maior ilha  2) yaw 16° + centro pela linha média dos olhos (landmarks 3D)
# 3) guardar original alinhado (para restaurar rosto)  4) descartar x<0 e nuca inventada, espelhar, fechar
# 5) restaurar rosto original por projeção  6) crânio elipsoide  7) suavizar região nova  8) materiais planos na nuca/base
import bpy, bmesh, sys, math, os
from mathutils import Vector, Matrix, bvhtree
argv=sys.argv[sys.argv.index("--")+1:]
src, out_blend, out_dir = argv
ZCUT=0.50; YAW=16.0; X0_FIT=-0.0472; X_MID=0.0635   # do ajuste v02a e dos landmarks 3D (sellion/olhos)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=src)
o=[x for x in bpy.context.scene.objects if x.type=='MESH'][0]; o.name="Busto"
bpy.context.view_layer.objects.active=o; o.select_set(True)
o.matrix_world=Matrix.Rotation(math.radians(45),4,'Z') @ o.matrix_world
bpy.ops.object.transform_apply(rotation=True,location=True,scale=True)
me=o.data
# --- corte + maior ilha
bm=bmesh.new(); bm.from_mesh(me)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<ZCUT],context='VERTS')
seen=set(); comps=[]
for v in bm.verts:
    if v.index in seen: continue
    st=[v]; comp=[]
    while st:
        x=st.pop()
        if x.index in seen: continue
        seen.add(x.index); comp.append(x)
        for e in x.link_edges:
            y=e.other_vert(x)
            if y.index not in seen: st.append(y)
    comps.append(comp)
comps.sort(key=len,reverse=True)
for c in comps[1:]: bmesh.ops.delete(bm,geom=c,context='VERTS')
bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-4)
for v in bm.verts:
    if v.co.z<ZCUT+0.02: v.co.z=ZCUT
bm.to_mesh(me); bm.free(); me.update()
# --- mesma normalização da v01 (centro XY do bbox, z=0 na base, escala 0.45/altura) para reutilizar YAW/X0
pts=[v.co for v in me.vertices]
cx=(min(p.x for p in pts)+max(p.x for p in pts))/2; cy=(min(p.y for p in pts)+max(p.y for p in pts))/2
for v in me.vertices: v.co.x-=cx; v.co.y-=cy; v.co.z-=ZCUT
h=max(v.co.z for v in me.vertices); s=0.45/h
for v in me.vertices: v.co*=s
print("V01-like: cx=%.4f cy=%.4f h=%.4f s=%.4f"%(cx,cy,h,s))
# --- v02a: yaw + centro (o centro do bbox mudou com o corte mais baixo; compensar usando a ponta do nariz)
R=Matrix.Rotation(math.radians(YAW),4,'Z')
for v in me.vertices: v.co=R@(v.co-Vector((X0_FIT,0,0)))
P=[v.co.copy() for v in me.vertices]
nose=min([p for p in P if 0.15<p.z<0.45],key=lambda p:p.y); print("NOSE_TMP",nose)
# na v02a a ponta do nariz (vértice) estava em x=0.0704 e a linha média em 0.0635 -> linha média = nariz - 0.0069
xshift=nose.x-0.0069
for v in me.vertices: v.co.x-=xshift
me.update()
# --- guardar original alinhado
orig_verts=[(v.co.x,v.co.y,v.co.z) for v in me.vertices]; orig_polys=[list(p.vertices) for p in me.polygons]
bvh=bvhtree.BVHTree.FromPolygons(orig_verts,orig_polys)
P=[v.co.copy() for v in me.vertices]
nose=min([p for p in P if 0.15<p.z<0.45],key=lambda p:p.y)
ear=max([p for p in P if p.x>0 and nose.z-0.02<p.z<nose.z+0.12],key=lambda p:p.x); print("NOSE",nose,"EAR",ear)
# --- espelhar
bm=bmesh.new(); bm.from_mesh(me)
y_back=ear.y+0.03
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.x<-0.004 or v.co.y>y_back],context='VERTS')
for v in bm.verts:
    if abs(v.co.x)<0.010: v.co.x=0
bmesh.ops.mirror(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),axis='X',merge_dist=0.003)
bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=0.003)
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
boundary=[e for e in bm.edges if e.is_boundary]
rimkeys=set((round(v.co.x,4),round(v.co.y,4),round(v.co.z,4)) for e in boundary for v in e.verts)
rimcos=[v.co.copy() for e in boundary for v in e.verts][::5]
isrim=lambda v:(round(v.co.x,4),round(v.co.y,4),round(v.co.z,4)) in rimkeys
F=bm.faces.layers.int.new('cap')
res=bmesh.ops.holes_fill(bm,edges=boundary,sides=0); capf=bmesh.ops.triangulate(bm,faces=res.get('faces',[]))['faces']
for f in capf: f[F]=1
for it in range(3):
    edges=list({e for f in capf for e in f.edges})
    bmesh.ops.subdivide_edges(bm,edges=edges,cuts=1,use_grid_fill=True)
    capf=[f for f in bm.faces if f[F]==1]
    inner=list({v for f in capf for v in f.verts if not isrim(v) and v.co.z>0.005})
    for _ in range(12): bmesh.ops.smooth_vert(bm,verts=inner,factor=0.5,use_axis_x=True,use_axis_y=True,use_axis_z=True)
    if it<2:
        for v in inner:
            dmin=min((v.co-r).length for r in rimcos); v.co.y+=0.05*min(dmin/0.08,1.0)/(it+1)
        for _ in range(4): bmesh.ops.smooth_vert(bm,verts=inner,factor=0.3,use_axis_x=True,use_axis_y=True,use_axis_z=True)
for v in bm.verts:
    if v.co.z<0.004: v.co.z=0
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
# marcar vértices da tampa para suavização posterior
L=bm.verts.layers.int.new('cap')
for f in capf:
    for v in f.verts: v[L]=1
bm.to_mesh(me); bm.free(); me.update()
print("MIRRORED verts",len(me.vertices),"faces",len(me.polygons))
# --- restaurar rosto original (frente até as orelhas, todo z abaixo do topo)
y0=nose.y+0.09; y1=ear.y-0.01
def smooth(t): return t*t*(3-2*t)
moved=0
for v in me.vertices:
    if v.co.y>y1 or v.co.z<0.02: continue
    r=bvh.find_nearest(v.co,0.03)
    if r[0] is None: continue
    w=1.0 if v.co.y<y0 else 1.0-smooth((v.co.y-y0)/(y1-y0))
    v.co=v.co.lerp(r[0],w); moved+=1
print("RESTORED",moved)
# --- crânio elipsoide (Farkas: tragion->opistocrânio = 0.87 × tragion->pronasal)
tragion=Vector((ear.x-0.01,ear.y+0.01,ear.z))
occ_y=tragion.y+0.87*abs(nose.y-tragion.y)
top_z=max(v.co.z for v in me.vertices); half_w=max(v.co.x for v in me.vertices if top_z-0.15<v.co.z<top_z-0.05)
zc=nose.z+0.12; yc=tragion.y-0.005; b=occ_y-yc; c=top_z-zc+0.005; a=half_w+0.005
print("ELLIPSOID yc=%.3f zc=%.3f a=%.3f b=%.3f c=%.3f occ_y=%.3f"%(yc,zc,a,b,c,occ_y))
for v in me.vertices:
    p=v.co
    if p.y<tragion.y+0.02 or p.z<nose.z-0.10: continue
    k=1-(p.x/a)**2-((p.z-zc)/c)**2
    if k<=0: continue
    yt=yc+b*math.sqrt(k); w=min(1.0,(p.y-(tragion.y+0.02))/0.05); w=w*w*(3-2*w)
    if yt>p.y: v.co.y=p.y+(yt-p.y)*w
# --- suavizar só a região nova (tampa) várias vezes, preservando borda
bm=bmesh.new(); bm.from_mesh(me); L=bm.verts.layers.int.get('cap')
capv=[v for v in bm.verts if v[L]==1 and v.co.z>0.005]
for _ in range(30): bmesh.ops.smooth_vert(bm,verts=capv,factor=0.5,use_axis_x=True,use_axis_y=True,use_axis_z=True)
# re-aplicar elipsoide após suavizar (a suavização encolhe)
for v in capv:
    p=v.co
    if p.y<tragion.y+0.02: continue
    k=1-(p.x/a)**2-((p.z-zc)/c)**2
    if k>0:
        yt=yc+b*math.sqrt(k)
        if yt>p.y: v.co.y=p.y+(yt-p.y)*0.7
for _ in range(6): bmesh.ops.smooth_vert(bm,verts=capv,factor=0.3,use_axis_x=True,use_axis_y=True,use_axis_z=True)
# --- materiais planos na tampa: cabelo acima da linha da orelha, pele abaixo, base escura
F=bm.faces.layers.int.get('cap')
bm.to_mesh(me); bm.free(); me.update()
mat_hair=bpy.data.materials.new("NucaCabelo"); mat_hair.use_nodes=True; mat_hair.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(0.035,0.025,0.02,1); mat_hair.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value=0.7
mat_skin=bpy.data.materials.new("NucaPele"); mat_skin.use_nodes=True; mat_skin.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(0.55,0.36,0.26,1); mat_skin.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value=0.6
mat_base=bpy.data.materials.new("Base"); mat_base.use_nodes=True; mat_base.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(0.08,0.08,0.08,1)
me.materials.append(mat_hair); me.materials.append(mat_skin); me.materials.append(mat_base)
i_hair=len(me.materials)-3; i_skin=len(me.materials)-2; i_base=len(me.materials)-1
capflag=me.polygon_layers_int.get('cap') if hasattr(me,'polygon_layers_int') else None
bm=bmesh.new(); bm.from_mesh(me); F=bm.faces.layers.int.get('cap')
for f in bm.faces:
    if f[F]==1:
        cz=sum(v.co.z for v in f.verts)/len(f.verts)
        if cz<0.003: f.material_index=i_base
        elif cz>ear.z-0.03: f.material_index=i_hair
        else: f.material_index=i_skin
bm.to_mesh(me); bm.free(); me.update()
print("FINAL verts",len(me.vertices),"faces",len(me.polygons))
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
# --- renders: 7 vistas
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=600; sc.render.resolution_y=750
w=bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True; w.node_tree.nodes["Background"].inputs[0].default_value=(0.6,0.6,0.6,1)
cd=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam; cd.lens=60
cen=Vector((0,0,0.225)); d=1.1
for name,deg in [("front",0),("q_left",-45),("side_left",-90),("back",180),("side_right",90),("q_right",45)]:
    ang=math.radians(deg); cam.location=(cen.x+d*math.sin(ang), cen.y-d*math.cos(ang), cen.z)
    cam.rotation_euler=(cen-cam.location).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=os.path.join(out_dir,f"{name}.png"); bpy.ops.render.render(write_still=True)
cam.location=(0,0,cen.z+d); cam.rotation_euler=(cen-cam.location).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=os.path.join(out_dir,"top.png"); bpy.ops.render.render(write_still=True)
