"""blender -b --python tools/mpfb_wrap_bake.py -- <scan.blend> <mpfb.blend> <lm3d_mpfb_ids.json> <lm3d_scan.json> <out_prefix> [k_wrap=0.85]
Pipeline de duplo digital: malha limpa (MPFB ajustada) alinhada ao scan por Procrustes (similaridade),
olhos fechados, Shrinkwrap no scan (mistura k), bake da cor do scan para a UV limpa (Cycles), export glb."""
import bpy, bmesh, json, sys, os, numpy as np
from mathutils import Matrix
a = sys.argv[sys.argv.index("--")+1:]; scan_b, mp_b, lm_mp_f, lm_sc_f, out = a[:5]; k = float(a[5]) if len(a) > 5 else 0.85
bpy.ops.wm.open_mainfile(filepath=scan_b); scan = bpy.data.objects['Busto']; scan.name = 'Scan'
with bpy.data.libraries.load(mp_b, link=False) as (src, dst): dst.objects = ['Busto']
mp = dst.objects[0]; bpy.context.scene.collection.objects.link(mp)
bpy.context.view_layer.objects.active = mp; mp.select_set(True)
# aplicar shape keys (mix) numa malha estática
mp.shape_key_add(name='Mix', from_mix=True); mp.active_shape_key_index = len(mp.data.shape_keys.key_blocks)-1
for kb in list(mp.data.shape_keys.key_blocks)[:-1]: mp.shape_key_remove(kb)
mp.shape_key_remove(mp.data.shape_keys.key_blocks[0])
# alinhamento por landmarks comuns
LM = json.load(open(lm_mp_f)); LS = json.load(open(lm_sc_f))
eye = {33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398}
oval = {10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109}
ids = [i for i in LM['vid'] if i in LS and int(i) < 468 and int(i) not in eye and int(i) not in oval]
A = np.array([mp.data.vertices[LM['vid'][i]].co[:] for i in ids]); B = np.array([LS[i] for i in ids])
for it in range(3):
    ca, cb = A.mean(0), B.mean(0); U, S, Vt = np.linalg.svd((B-cb).T @ (A-ca)); D = np.eye(3); D[2,2] = np.sign(np.linalg.det(U@Vt)); R = U@D@Vt
    s = (S*np.diag(D)).sum()/((A-ca)**2).sum(); P = s*((A-ca)@R.T) + cb; r = np.linalg.norm(P-B, axis=1); keep = r < np.median(r)*2.5
    A, B = A[keep], B[keep]
print("WRAP alinhamento: escala %.3f, residuo mediano %.2f cm (%d pts)" % (s, np.median(r)*100, len(A)))
T = Matrix(np.vstack([np.hstack([s*R, (cb - s*(R@ca))[:,None]]), [0,0,0,1]]).tolist())
mp.matrix_world = T @ mp.matrix_world; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# cortar pescoço na base do scan e fechar buracos (olhos e base)
bm = bmesh.new(); bm.from_mesh(mp.data)
bmesh.ops.bisect_plane(bm, geom=bm.verts[:]+bm.edges[:]+bm.faces[:], plane_co=(0,0,0.035), plane_no=(0,0,-1), clear_outer=True)
bound = [e for e in bm.edges if e.is_boundary and e.verts[0].co.z > 0.06]
bmesh.ops.holes_fill(bm, edges=bound, sides=0)
bm.to_mesh(mp.data); bm.free()
V0 = np.array([v.co[:] for v in mp.data.vertices])
m = mp.modifiers.new("Wrap", 'SHRINKWRAP'); m.target = scan; m.wrap_method = 'NEAREST_SURFACEPOINT'; m.wrap_mode = 'ON_SURFACE'
bpy.ops.object.modifier_apply(modifier="Wrap")
V1 = np.array([v.co[:] for v in mp.data.vertices]); d = V1 - V0
# relaxar espinhos: deslocamento muito diferente da vizinhança vira a média dos vizinhos
nb = [[] for _ in V0]
for e in mp.data.edges: a_, b_ = e.vertices; nb[a_].append(b_); nb[b_].append(a_)
for it in range(4):
    dn = np.array([d[n].mean(0) if n else d[i] for i, n in enumerate(nb)])
    bad = np.linalg.norm(d - dn, axis=1) > 0.006
    d[bad] = dn[bad]
    print("WRAP espinhos relaxados:", int(bad.sum()))
V = V0 + k*d; V1 = V0 + d
for i, v in enumerate(mp.data.vertices): v.co = V[i]
bm = bmesh.new(); bm.from_mesh(mp.data)
r_ = bmesh.ops.bisect_plane(bm, geom=bm.verts[:]+bm.edges[:]+bm.faces[:], plane_co=(0,0,0.02), plane_no=(0,0,-1), clear_outer=True)
ce = [e for e in r_['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
if ce: bmesh.ops.holes_fill(bm, edges=ce, sides=0)
bm.to_mesh(mp.data); bm.free()
print("WRAP desloc mediano %.2f cm, max %.2f cm" % (np.median(np.linalg.norm(V1-V0,axis=1))*100, np.linalg.norm(V1-V0,axis=1).max()*100))
bpy.ops.object.shade_smooth()
# bake da cor do scan -> UV do MPFB
img = bpy.data.images.new("BakeTex", 4096, 4096); img.filepath_raw = os.path.abspath(out + "_tex.png"); img.file_format = 'PNG'
mat = bpy.data.materials.new("PeleBake"); mat.use_nodes = True; nt = mat.node_tree
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; nt.nodes.active = tex
bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'); nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value = 0.75
mp.data.materials.clear(); mp.data.materials.append(mat)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.device = 'GPU'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'CUDA'; prefs.get_devices()
    for d in prefs.devices: d.use = True
except Exception as e: print("GPU pref", e)
sc.render.bake.use_selected_to_active = True; sc.render.bake.cage_extrusion = 0.03; sc.render.bake.max_ray_distance = 0.15
sc.render.bake.use_pass_direct = False; sc.render.bake.use_pass_indirect = False; sc.render.bake.use_pass_color = True; sc.render.bake.margin = 16
bpy.ops.object.select_all(action='DESELECT'); scan.select_set(True); mp.select_set(True); bpy.context.view_layer.objects.active = mp
bpy.ops.object.bake(type='DIFFUSE'); img.save(); print("BAKE ok")
scan.hide_render = True; scan.hide_viewport = True
mp.name = 'Busto'; scan.name = 'Scan'
bpy.ops.object.select_all(action='DESELECT'); mp.select_set(True)
bpy.ops.export_scene.gltf(filepath=out + ".glb", export_format='GLB', use_selection=True, export_image_format='JPEG', export_jpeg_quality=88, export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=out + ".blend"); print("WRAP salvo", len(mp.data.vertices), len(mp.data.polygons))
