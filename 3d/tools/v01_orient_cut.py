# v01: orientar kiri-01 (rosto para -Y), cortar busto, limpar ilhas, fechar base, salvar .blend
import bpy, bmesh, sys, math, os, mathutils
argv=sys.argv[sys.argv.index("--")+1:]
src, out_blend, out_dir, zcut = argv[0], argv[1], argv[2], float(argv[3])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=src)
o=[x for x in bpy.context.scene.objects if x.type=='MESH'][0]; o.name="Busto"
bpy.context.view_layer.objects.active=o; o.select_set(True)
o.matrix_world=mathutils.Matrix.Rotation(math.radians(45),4,'Z') @ o.matrix_world
bpy.ops.object.transform_apply(rotation=True,location=True,scale=True)
print('ZRANGE',min(v.co.z for v in o.data.vertices),max(v.co.z for v in o.data.vertices))
bm=bmesh.new(); bm.from_mesh(o.data)
# corte
geom=[v for v in bm.verts if v.co.z<zcut]
bmesh.ops.delete(bm,geom=geom,context='VERTS')
# ilhas soltas: manter só a maior componente conexa
bm.verts.ensure_lookup_table(); seen=set(); comps=[]
for v in bm.verts:
    if v.index in seen: continue
    stack=[v]; comp=[]
    while stack:
        x=stack.pop()
        if x.index in seen: continue
        seen.add(x.index); comp.append(x)
        for e in x.link_edges:
            y=e.other_vert(x)
            if y.index not in seen: stack.append(y)
    comps.append(comp)
comps.sort(key=len,reverse=True); print("COMPONENTS",[len(c) for c in comps[:6]])
for comp in comps[1:]: bmesh.ops.delete(bm,geom=comp,context='VERTS')
bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-4)
# fechar base: bordas abertas mais baixas -> aplanar em zcut e preencher
boundary=[e for e in bm.edges if e.is_boundary]
print("BOUNDARY_EDGES",len(boundary))
bverts=set(v for e in boundary for v in e.verts)
low=[v for v in bverts if v.co.z<zcut+0.02]
for v in low: v.co.z=zcut
low_edges=[e for e in boundary if e.verts[0] in low and e.verts[1] in low]
try:
    r=bmesh.ops.holes_fill(bm,edges=low_edges,sides=0); print("FILLED",len(r.get('faces',[])))
except Exception as ex: print("FILL_ERR",ex)
bm.to_mesh(o.data); bm.free(); o.data.update()
# origem na base, centro X/Y
pts=[v.co for v in o.data.vertices]
cx=(min(p.x for p in pts)+max(p.x for p in pts))/2; cy=(min(p.y for p in pts)+max(p.y for p in pts))/2
for v in o.data.vertices: v.co.x-=cx; v.co.y-=cy; v.co.z-=zcut
h=max(v.co.z for v in o.data.vertices); print("HEIGHT",h,"VERTS",len(o.data.vertices),"FACES",len(o.data.polygons))
# escala: busto ~0.45 m
s=0.45/h
for v in o.data.vertices: v.co*=s
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
# renders
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=600; sc.render.resolution_y=750
w=bpy.data.worlds.new("W"); sc.world=w; w.use_nodes=True; w.node_tree.nodes["Background"].inputs[0].default_value=(0.6,0.6,0.6,1)
cd=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cd); sc.collection.objects.link(cam); sc.camera=cam; cd.lens=60
c=mathutils.Vector((0,0,0.225)); d=1.0
for name,deg in [("front",0),("q_left",-45),("side_left",-90),("back",180),("side_right",90),("q_right",45)]:
    a=math.radians(deg); cam.location=(c.x+d*math.sin(a), c.y-d*math.cos(a), c.z)
    cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=os.path.join(out_dir,f"{name}.png"); bpy.ops.render.render(write_still=True)
