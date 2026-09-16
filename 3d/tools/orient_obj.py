"""blender -b --python tools/orient_obj.py -- <in.obj> <out.obj> <rx> <ry> <rz> [zcut_frac]
Aplica rotação em graus (Euler XYZ) ao OBJ, recentra no origem (XY) com base em Z=0,
opcionalmente remove tudo abaixo de zcut_frac da altura, e exporta OBJ com materiais."""
import bpy, sys, math, mathutils, bmesh
a = sys.argv[sys.argv.index("--")+1:]
src, dst = a[0], a[1]; rx, ry, rz = map(float, a[2:5]); zcut = float(a[5]) if len(a) > 5 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=src)
o = [x for x in bpy.context.scene.objects if x.type == 'MESH'][0]
o.matrix_world = mathutils.Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_matrix().to_4x4() @ o.matrix_world
bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
bpy.ops.object.transform_apply(rotation=True, location=True, scale=True)
if zcut is not None:
    zs = [v.co.z for v in o.data.vertices]; z0, z1 = min(zs), max(zs); zc = z0 + zcut * (z1 - z0)
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:]+bm.edges[:]+bm.faces[:], plane_co=(0,0,zc), plane_no=(0,0,-1), clear_outer=True)
    bm.to_mesh(o.data); bm.free()
zs = [v.co.z for v in o.data.vertices]; xs = [v.co.x for v in o.data.vertices]; ys = [v.co.y for v in o.data.vertices]
o.location = (-(min(xs)+max(xs))/2, -(min(ys)+max(ys))/2, -min(zs)); bpy.ops.object.transform_apply(location=True)
bpy.ops.wm.obj_export(filepath=dst, export_materials=True, path_mode='COPY')
print("BBOX", max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))
