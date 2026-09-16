"""blender -b --python tools/v10_cut_smooth.py -- <in.obj> <out_prefix> <zcut_m> <smooth_iters> <smooth_factor>
Corta o busto em y=ycut (altura fica em Y após obj_import), fecha a base plana, suaviza a malha
(modificador Smooth, preserva base), material fosco. Exporta OBJ (+mtl/textura copiada) e .blend."""
import bpy, bmesh, sys
a = sys.argv[sys.argv.index("--")+1:]
src, out, zcut, iters, fac = a[0], a[1], float(a[2]), int(a[3]), float(a[4])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=src)
o = [x for x in bpy.context.scene.objects if x.type == 'MESH'][0]
bpy.context.view_layer.objects.active = o; o.select_set(True)
bm = bmesh.new(); bm.from_mesh(o.data)
r = bmesh.ops.bisect_plane(bm, geom=bm.verts[:]+bm.edges[:]+bm.faces[:], plane_co=(0,zcut,0), plane_no=(0,-1,0), clear_outer=True)
cut_edges = [e for e in r['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
if cut_edges:
    bmesh.ops.holes_fill(bm, edges=cut_edges, sides=0)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.to_mesh(o.data); bm.free()
# vértices da base não suavizam
vg = o.vertex_groups.new(name="Corpo")
vg.add([v.index for v in o.data.vertices if v.co.y > zcut + 0.002], 1.0, 'REPLACE')
m = o.modifiers.new("Smooth", 'SMOOTH'); m.factor = fac; m.iterations = iters; m.vertex_group = "Corpo"
bpy.ops.object.modifier_apply(modifier="Smooth")
for mat in o.data.materials:
    if mat and mat.use_nodes:
        b = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if b: b.inputs['Roughness'].default_value = 0.85; b.inputs['Specular IOR Level'].default_value = 0.2
bpy.ops.object.shade_smooth()
ys=[v.co.y for v in o.data.vertices]; o.location.y = -min(ys); bpy.ops.object.transform_apply(location=True)
bpy.ops.wm.obj_export(filepath=out+".obj", export_materials=True, path_mode='COPY')
bpy.ops.wm.save_as_mainfile(filepath=out+".blend")
print("V10", len(o.data.vertices), len(o.data.polygons))
