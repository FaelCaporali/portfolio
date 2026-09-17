"""blender -b --python tools/dd_wrap_bake.py -- <scan.blend> <mpfb.blend> <lm3d_mpfb_ids.json> <lm3d_scan.json> <out_prefix> [subdiv=1]
DD06+: duplo digital por ajuste multi-resolução (método Wrap/R3DS): malha limpa (MPFB ajustada) alinhada ao scan por
Procrustes, subdividida, e envolvida no scan em estágios (campo de deslocamento suavizado 40 → 12 → 4 → 1 iterações,
projeção pela normal nos estágios grossos, ponto mais próximo nos finos). O scan usado no wrap e no bake NÃO tem a
tampa da base. Bake Cycles da cor para UV limpa (4k, pixels não atingidos ficam magenta/alpha 0 para inpaint) e
máscara das ilhas UV (EMIT). Saídas: <out>.blend, <out>_tex_raw.png, <out>_islands.png."""
import bpy, bmesh, json, sys, os, numpy as np
from mathutils import Matrix, Vector
a = sys.argv[sys.argv.index("--")+1:]; scan_b, mp_b, lm_mp_f, lm_sc_f, out = a[:5]; subdiv = int(a[5]) if len(a) > 5 else 1
bpy.ops.wm.open_mainfile(filepath=scan_b); scan = bpy.data.objects['Busto']; scan.name = 'Scan'
bpy.ops.object.select_all(action='DESELECT'); scan.select_set(True); bpy.context.view_layer.objects.active = scan
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# cópia do scan sem a tampa da base (faces planas viradas para baixo, na altura mínima)
sw = scan.copy(); sw.data = scan.data.copy(); sw.name = 'ScanW'; bpy.context.scene.collection.objects.link(sw)
bm = bmesh.new(); bm.from_mesh(sw.data); zmin = min(v.co.z for v in bm.verts)
cap = [f for f in bm.faces if f.normal.z < -0.5 and f.calc_center_median().z < zmin + 0.004]
bmesh.ops.delete(bm, geom=cap, context='FACES')
# fechar rachaduras pequenas do scan (raios do bake atravessavam e batiam no interior do crânio)
bm.edges.ensure_lookup_table(); be = [e for e in bm.edges if e.is_boundary and e.verts[0].co.z > zmin + 0.01]
nf0 = len(bm.faces); bmesh.ops.holes_fill(bm, edges=be, sides=24); print("WRAP rachaduras: %d arestas de borda, %d faces criadas" % (len(be), len(bm.faces)-nf0))
bm.to_mesh(sw.data); bm.free(); print("WRAP tampa removida: %d faces" % len(cap))
with bpy.data.libraries.load(mp_b, link=False) as (src, dst): dst.objects = ['Busto']
mp = dst.objects[0]; bpy.context.scene.collection.objects.link(mp)
bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = mp; mp.select_set(True)
mp.shape_key_add(name='Mix', from_mix=True); mp.active_shape_key_index = len(mp.data.shape_keys.key_blocks)-1
for kb in list(mp.data.shape_keys.key_blocks)[:-1]: mp.shape_key_remove(kb)
mp.shape_key_remove(mp.data.shape_keys.key_blocks[0])
# alinhamento por landmarks comuns (similaridade)
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
bm = bmesh.new(); bm.from_mesh(mp.data)
bmesh.ops.bisect_plane(bm, geom=bm.verts[:]+bm.edges[:]+bm.faces[:], plane_co=(0,0,0.035), plane_no=(0,0,-1), clear_outer=True)
bm.to_mesh(mp.data); bm.free()
if subdiv > 0:
    m = mp.modifiers.new("Sub", 'SUBSURF'); m.levels = subdiv; m.render_levels = subdiv; bpy.ops.object.modifier_apply(modifier="Sub")
print("WRAP malha limpa: %d v, %d f" % (len(mp.data.vertices), len(mp.data.polygons)))
# wrap multi-resolução
n = len(mp.data.vertices); nb = [[] for _ in range(n)]
for e in mp.data.edges: x, y = e.vertices; nb[x].append(y); nb[y].append(x)
V = np.array([v.co[:] for v in mp.data.vertices]); V0 = V.copy()
def targets(mode, lim):
    mp.data.vertices.foreach_set('co', V.ravel()); mp.data.update()
    N = np.array([v.normal[:] for v in mp.data.vertices]); P = V.copy(); miss = 0
    for i in range(n):
        co, nn = Vector(V[i]), Vector(N[i]); best = None
        if mode == 'ray':
            for sgn in (1, -1):
                ok, loc, _, _ = sw.ray_cast(co, sgn*nn, distance=lim)
                if ok and (best is None or (loc-co).length < (best-co).length): best = loc
        if best is None:
            ok, loc, _, _ = sw.closest_point_on_mesh(co); best = loc; miss += (mode == 'ray')
        P[i] = best[:]
    return P, miss
for smooth, mode, lim in ((40, 'ray', 0.10), (12, 'ray', 0.06), (4, 'near', 0), (1, 'near', 0)):
    P, miss = targets(mode, lim); d = P - V
    for it in range(smooth):
        dn = np.array([d[k].mean(0) if k else d[i] for i, k in enumerate(nb)]); d = 0.5*d + 0.5*dn
    V = V + d
    print("WRAP estagio suav=%d modo=%s: desloc mediano %.2f cm, max %.2f cm, sem raio=%d" % (smooth, mode, np.median(np.linalg.norm(d,axis=1))*100, np.linalg.norm(d,axis=1).max()*100, miss))
# relaxamento tangencial: média dos vizinhos + reprojeção no scan (tira o zigue-zague dos loops densos)
for it in range(6):
    Vn = np.array([V[k].mean(0) if k else V[i] for i, k in enumerate(nb)]); V = 0.4*V + 0.6*Vn
    P, _ = targets('near', 0); V = P
mp.data.vertices.foreach_set('co', V.ravel()); mp.data.update()
bmq = bmesh.new(); bmq.from_mesh(mp.data); bmq.normal_update(); bad = 0
for f in bmq.faces:
    nv = sum((v.normal for v in f.verts), start=Vector()); bad += (nv.length > 0 and f.normal.dot(nv.normalized()) < 0.3)
bmq.free(); print("WRAP faces dobradas apos relax:", bad)
print("WRAP total: desloc mediano %.2f cm, max %.2f cm" % (np.median(np.linalg.norm(V-V0,axis=1))*100, np.linalg.norm(V-V0,axis=1).max()*100))
bm = bmesh.new(); bm.from_mesh(mp.data)
r_ = bmesh.ops.bisect_plane(bm, geom=bm.verts[:]+bm.edges[:]+bm.faces[:], plane_co=(0,0,0.02), plane_no=(0,0,-1), clear_outer=True)
ce = [e for e in r_['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
if ce: bmesh.ops.holes_fill(bm, edges=ce, sides=0)
bm.to_mesh(mp.data); bm.free(); bpy.ops.object.shade_smooth()
# bake da cor do scan (sem tampa) -> UV limpa; pixels não atingidos = magenta alpha 0
S = 4096; img = bpy.data.images.new("BakeTex", S, S, alpha=True); img.filepath_raw = os.path.abspath(out + "_tex_raw.png"); img.file_format = 'PNG'
px = np.zeros((S*S, 4), np.float32); px[:, 0] = 1; px[:, 2] = 1; img.pixels.foreach_set(px.ravel())
mat = bpy.data.materials.new("Pele"); mat.use_nodes = True; nt = mat.node_tree
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; nt.nodes.active = tex
bsdf = next(nd for nd in nt.nodes if nd.type == 'BSDF_PRINCIPLED'); nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value = 0.85; bsdf.inputs['Specular IOR Level'].default_value = 0.2
mp.data.materials.clear(); mp.data.materials.append(mat)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.device = 'GPU'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'CUDA'; prefs.get_devices()
    for dv in prefs.devices: dv.use = True
except Exception as e: print("GPU pref", e)
bk = sc.render.bake; bk.use_selected_to_active = True; bk.cage_extrusion = 0.006; bk.max_ray_distance = 0.02
bk.use_pass_direct = False; bk.use_pass_indirect = False; bk.use_pass_color = True; bk.margin = 16
scan.hide_render = True; scan.hide_viewport = True
bpy.ops.object.select_all(action='DESELECT'); sw.select_set(True); mp.select_set(True); bpy.context.view_layer.objects.active = mp
bpy.ops.object.bake(type='DIFFUSE'); img.save(); print("BAKE cor ok")
# máscara das ilhas UV: emissão branca da própria malha
isl = bpy.data.images.new("Islands", S, S); isl.filepath_raw = os.path.abspath(out + "_islands.png"); isl.file_format = 'PNG'
me = bpy.data.materials.new("Emit"); me.use_nodes = True; ntm = me.node_tree
for nd in list(ntm.nodes): ntm.nodes.remove(nd)
em = ntm.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (1,1,1,1); o_ = ntm.nodes.new('ShaderNodeOutputMaterial'); ntm.links.new(em.outputs[0], o_.inputs[0])
ti = ntm.nodes.new('ShaderNodeTexImage'); ti.image = isl; ntm.nodes.active = ti
mp.data.materials[0] = me; bk.use_selected_to_active = False; bk.margin = 0
bpy.ops.object.select_all(action='DESELECT'); mp.select_set(True); bpy.ops.object.bake(type='EMIT'); isl.save(); print("BAKE ilhas ok")
mp.data.materials[0] = mat; sw.hide_render = True; sw.hide_viewport = True; mp.name = 'Busto'
bpy.ops.wm.save_as_mainfile(filepath=out + ".blend"); print("WRAP salvo", len(mp.data.vertices), len(mp.data.polygons))
