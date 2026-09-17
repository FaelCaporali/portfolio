"""blender -b --python tools/dd_finish.py -- <prep.blend> <nicp.npy> <out_prefix> [subdiv=1]
Aplica os vértices do registro não rígido na malha limpa, subdivide, projeção fina no scan (ponto mais próximo com
normais compatíveis, ≤4 mm, suavizada), corte do pescoço, bake da cor (4k, não atingidos magenta/alpha 0) e máscara de ilhas."""
import bpy, bmesh, sys, os, numpy as np
from mathutils import Vector
a = sys.argv[sys.argv.index("--")+1:]; prep, npy, out = a[:3]; subdiv = int(a[3]) if len(a) > 3 else 1
SRC = np.load(prep.replace('_prep.blend', '_src.npz')); soft0 = SRC['soft'] if 'soft' in SRC else None
bpy.ops.wm.open_mainfile(filepath=prep); mp = bpy.data.objects['Busto']; sw = bpy.data.objects['ScanW']; scan = bpy.data.objects['Scan']
V = np.load(npy); assert len(V) == len(mp.data.vertices); mp.data.vertices.foreach_set('co', V.ravel()); mp.data.update()
bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = mp; mp.select_set(True)
def folds():
    bm = bmesh.new(); bm.from_mesh(mp.data); bm.normal_update(); bad = 0
    for f in bm.faces:
        nv = sum((v.normal for v in f.verts), start=Vector()); bad += (nv.length > 0 and f.normal.dot(nv.normalized()) < 0.3)
    bm.free(); return bad
print("FINISH faces dobradas apos NICP:", folds())
if subdiv > 0:
    m = mp.modifiers.new("Sub", 'SUBSURF'); m.levels = subdiv; m.render_levels = subdiv; bpy.ops.object.modifier_apply(modifier="Sub")
n = len(mp.data.vertices); nb = [[] for _ in range(n)]
for e in mp.data.edges: x, y = e.vertices; nb[x].append(y); nb[y].append(x)
soft = np.zeros(n, bool)
if soft0 is not None:
    n0 = len(soft0); soft[:n0] = soft0
    for i in range(n0, n): soft[i] = any(soft[k] for k in nb[i] if k < n0)
print("FINISH vertices macios (olhos/boca):", int(soft.sum()))
def smooth(d, it):
    for _ in range(it): d = 0.5*d + 0.5*np.array([d[k].mean(0) if k else d[i] for i, k in enumerate(nb)])
    return d
def diffuse_soft(d):                      # olhos/boca: deslocamento interpolado dos vizinhos (sem projeção própria)
    idx = np.nonzero(soft)[0]
    for _ in range(30):
        for i in idx: d[i] = d[nb[i]].mean(0)
    return d
def stage(lim, ray, ndot, sm):
    V = np.array([v.co[:] for v in mp.data.vertices]); mp.data.update(); N = np.array([v.normal[:] for v in mp.data.vertices]); d = np.zeros_like(V); okc = 0
    for i in range(n):
        co, nn = Vector(V[i]), Vector(N[i]); best = None
        if ray:
            for sgn in (1, -1):
                hit, loc, _, _ = sw.ray_cast(co, sgn*nn, distance=lim)
                if hit and (best is None or (loc-co).length < (best-co).length): best = loc
        if best is None:
            hit, loc, nrm, _ = sw.closest_point_on_mesh(co, distance=lim)
            if hit and nrm.dot(nn) > ndot: best = loc
        if best is not None: d[i] = (best - co)[:]; okc += 1
    for _ in range(4):                       # espinhos: deslocamento muito diferente da vizinhança vira a média
        dn = np.array([d[k].mean(0) if k else d[i] for i, k in enumerate(nb)]); bad = np.linalg.norm(d - dn, axis=1) > 0.003; d[bad] = dn[bad]
    d = smooth(d, sm); d = diffuse_soft(d); V = V + d; mp.data.vertices.foreach_set('co', V.ravel()); mp.data.update()
    print("FINISH projecao lim=%.3f raio=%s: %d/%d vertices, desloc mediano %.2f mm, max %.1f mm, dobradas %d" % (lim, ray, okc, n, np.median(np.linalg.norm(d,axis=1))*1000, np.linalg.norm(d,axis=1).max()*1000, folds()))
stage(0.04, True, 0.0, 3)      # grossa: pela normal, cobre pescoço/nuca/pálpebras/lábios que o NICP deixou longe
stage(0.006, False, 0.5, 1)    # fina: ponto mais próximo com normal compatível
def repair_folds():             # dobras residuais: alisa os vértices envolvidos (+1 anel) e reprojeta no scan
    for rep in range(4):
        bm = bmesh.new(); bm.from_mesh(mp.data); bm.normal_update(); vs = set()
        for f in bm.faces:
            nv = sum((v.normal for v in f.verts), start=Vector())
            if nv.length > 0 and f.normal.dot(nv.normalized()) < 0.3: vs.update(v.index for v in f.verts)
        bm.free()
        if not vs: break
        ring = set(vs)
        for i in list(vs): ring.update(nb[i])
        V = np.array([v.co[:] for v in mp.data.vertices]); idx = np.array(sorted(ring))
        for _ in range(6):
            Vn = V.copy()
            for i in idx: Vn[i] = 0.3*V[i] + 0.7*V[nb[i]].mean(0)
            V = Vn
        mp.data.vertices.foreach_set('co', V.ravel()); mp.data.update()
        for i in idx:
            co = Vector(V[i]); hit, loc, nrm, _ = sw.closest_point_on_mesh(co, distance=0.004)
            if hit and nrm.dot(mp.data.vertices[i].normal) > 0.5: mp.data.vertices[i].co = loc
        mp.data.update(); print("FINISH reparo de dobras %d: %d vertices, restam %d" % (rep+1, len(idx), folds()))
repair_folds()
bm = bmesh.new(); bm.from_mesh(mp.data)
r_ = bmesh.ops.bisect_plane(bm, geom=bm.verts[:]+bm.edges[:]+bm.faces[:], plane_co=(0,0,0.02), plane_no=(0,0,-1), clear_outer=True)
ce = [e for e in r_['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
if ce: bmesh.ops.holes_fill(bm, edges=ce, sides=0)
bm.to_mesh(mp.data); bm.free(); bpy.ops.object.shade_smooth()
S = 4096; img = bpy.data.images.new("BakeTex", S, S, alpha=True); img.filepath_raw = os.path.abspath(out + "_tex_raw.png"); img.file_format = 'PNG'
px = np.zeros((S*S, 4), np.float32); px[:, 0] = 1; px[:, 2] = 1; img.pixels.foreach_set(px.ravel())
mat = bpy.data.materials.new("Pele"); mat.use_nodes = True; nt = mat.node_tree
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; nt.nodes.active = tex
bsdf = next(nd for nd in nt.nodes if nd.type == 'BSDF_PRINCIPLED'); nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.85; bsdf.inputs['Specular IOR Level'].default_value = 0.2
mp.data.materials.clear(); mp.data.materials.append(mat)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.device = 'GPU'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'CUDA'; prefs.get_devices()
    for dv in prefs.devices: dv.use = True
except Exception as e: print("GPU pref", e)
bk = sc.render.bake; bk.use_selected_to_active = True; bk.cage_extrusion = 0.01; bk.max_ray_distance = 0.06
bk.use_pass_direct = False; bk.use_pass_indirect = False; bk.use_pass_color = True; bk.margin = 16
scan.hide_render = True; scan.hide_viewport = True
bpy.ops.object.select_all(action='DESELECT'); sw.select_set(True); mp.select_set(True); bpy.context.view_layer.objects.active = mp
bpy.ops.object.bake(type='DIFFUSE'); img.save(); print("BAKE cor ok")
isl = bpy.data.images.new("Islands", S, S); isl.filepath_raw = os.path.abspath(out + "_islands.png"); isl.file_format = 'PNG'
me = bpy.data.materials.new("Emit"); me.use_nodes = True; ntm = me.node_tree
for nd in list(ntm.nodes): ntm.nodes.remove(nd)
em = ntm.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (1,1,1,1); o_ = ntm.nodes.new('ShaderNodeOutputMaterial'); ntm.links.new(em.outputs[0], o_.inputs[0])
ti = ntm.nodes.new('ShaderNodeTexImage'); ti.image = isl; ntm.nodes.active = ti
mp.data.materials[0] = me; bk.use_selected_to_active = False; bk.margin = 0
bpy.ops.object.select_all(action='DESELECT'); mp.select_set(True); bpy.ops.object.bake(type='EMIT'); isl.save(); print("BAKE ilhas ok")
mp.data.materials[0] = mat; sw.hide_render = True; sw.hide_viewport = True
bpy.ops.wm.save_as_mainfile(filepath=out + ".blend"); print("FINISH salvo", len(mp.data.vertices), len(mp.data.polygons))
