"""blender -b --python tools/v12_stylize.py -- <in.blend> <out_prefix> <it_dark> <it_skin> <0> [textura_filtrada.jpg]
Suavização por região: vértices cuja cor de textura é escura (cabelo/barba) recebem it_dark iterações,
os demais it_skin. Base plana intocada. Textura: filtro bilateral (cv2) para homogeneizar barba/cabelo.
Exporta OBJ + textura e .blend."""
import bpy, bmesh, sys, os, numpy as np
a = sys.argv[sys.argv.index("--")+1:]
src, out, it_dark, it_skin, _ = a[0], a[1], int(a[2]), int(a[3]), a[4]
bpy.ops.wm.open_mainfile(filepath=src)
o = bpy.data.objects['Busto']; me = o.data
img = next(i for i in bpy.data.images if i.size[0] > 0)
W, H = img.size; px = np.array(img.pixels[:]).reshape(H, W, 4)[..., :3]
# luminância por vértice via UV dos loops
uv = me.uv_layers.active.data
lum = np.zeros(len(me.vertices)); cnt = np.zeros(len(me.vertices))
for poly in me.polygons:
    for li in poly.loop_indices:
        vi = me.loops[li].vertex_index; u, v = uv[li].uv
        x = min(W-1, max(0, int(u*W))); y = min(H-1, max(0, int(v*H)))
        lum[vi] += px[y, x].mean(); cnt[vi] += 1
lum = lum / np.maximum(cnt, 1)
zmin = min(v.co.z for v in me.vertices)
dark = [i for i in range(len(me.vertices)) if lum[i] < 0.22 and me.vertices[i].co.z > zmin + 0.003]
skin = [i for i in range(len(me.vertices)) if lum[i] >= 0.22 and me.vertices[i].co.z > zmin + 0.003]
print("V12 escuros", len(dark), "pele", len(skin))
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
kw = dict(use_axis_x=True, use_axis_y=True, use_axis_z=True)
for _ in range(it_dark): bmesh.ops.smooth_vert(bm, verts=[bm.verts[i] for i in dark], factor=0.5, **kw)
for _ in range(it_skin): bmesh.ops.smooth_vert(bm, verts=[bm.verts[i] for i in skin], factor=0.4, **kw)
bm.to_mesh(me); bm.free()
# textura: se foi passado um arquivo já filtrado (tools/tex_bilateral.py), usa ele
if len(a) > 5 and os.path.exists(a[5]):
    img = bpy.data.images.load(os.path.abspath(a[5]))
os.makedirs(os.path.dirname(out), exist_ok=True)
img.filepath_raw = out + "_tex.jpg"; img.file_format = 'JPEG'; img.save()
for mat in me.materials:
    for n in mat.node_tree.nodes:
        if n.type == 'TEX_IMAGE': n.image = img
bpy.ops.object.shade_smooth()
bpy.ops.wm.obj_export(filepath=out + ".obj", export_materials=True, path_mode='COPY')
bpy.ops.wm.save_as_mainfile(filepath=out + ".blend")
