"""blender -b --python tools/dd_prep.py -- <scan.blend> <mpfb.blend> <lm3d_mpfb_ids.json> <lm3d_scan.json> <out_prefix>
Prepara o registro não rígido: scan sem tampa (ScanW), malha limpa MPFB (mix das shape keys) alinhada ao scan por
Procrustes de similaridade e cortada em z=0,035. Exporta <out>_src.npz (V, E, F da malha limpa), <out>_tgt.npz
(V, F triangulado do scan) e <out>_lm.npz (idx de vértice da malha limpa, posição alvo no scan) e salva <out>_prep.blend."""
import bpy, bmesh, json, sys, os, numpy as np
from mathutils import Matrix, Vector
a = sys.argv[sys.argv.index("--")+1:]; scan_b, mp_b, lm_mp_f, lm_sc_f, out = a[:5]
bpy.ops.wm.open_mainfile(filepath=scan_b); scan = bpy.data.objects['Busto']; scan.name = 'Scan'
bpy.ops.object.select_all(action='DESELECT'); scan.select_set(True); bpy.context.view_layer.objects.active = scan
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
sw = scan.copy(); sw.data = scan.data.copy(); sw.name = 'ScanW'; bpy.context.scene.collection.objects.link(sw)
bm = bmesh.new(); bm.from_mesh(sw.data); zmin = min(v.co.z for v in bm.verts)
cap = [f for f in bm.faces if f.normal.z < -0.5 and f.calc_center_median().z < zmin + 0.004]
bmesh.ops.delete(bm, geom=cap, context='FACES'); bm.to_mesh(sw.data); bm.free(); print("PREP tampa removida: %d faces" % len(cap))
with bpy.data.libraries.load(mp_b, link=False) as (src, dst): dst.objects = ['Busto']
mp = dst.objects[0]; bpy.context.scene.collection.objects.link(mp)
bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = mp; mp.select_set(True)
mp.shape_key_add(name='Mix', from_mix=True); mp.active_shape_key_index = len(mp.data.shape_keys.key_blocks)-1
for kb in list(mp.data.shape_keys.key_blocks)[:-1]: mp.shape_key_remove(kb)
mp.shape_key_remove(mp.data.shape_keys.key_blocks[0])
LM = json.load(open(lm_mp_f)); LS = json.load(open(lm_sc_f))
eye = {33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398}
oval = {10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109}
ids = [i for i in LM['vid'] if i in LS and int(i) < 468 and int(i) not in eye and int(i) not in oval]
A = np.array([mp.data.vertices[LM['vid'][i]].co[:] for i in ids]); B = np.array([LS[i] for i in ids])
for it in range(3):
    ca, cb = A.mean(0), B.mean(0); U, S, Vt = np.linalg.svd((B-cb).T @ (A-ca)); D = np.eye(3); D[2,2] = np.sign(np.linalg.det(U@Vt)); R = U@D@Vt
    s = (S*np.diag(D)).sum()/((A-ca)**2).sum(); P = s*((A-ca)@R.T) + cb; r = np.linalg.norm(P-B, axis=1); keep = r < np.median(r)*2.5
    A, B = A[keep], B[keep]
print("PREP alinhamento: escala %.3f, residuo mediano %.2f cm (%d pts)" % (s, np.median(r)*100, len(A)))
T = Matrix(np.vstack([np.hstack([s*R, (cb - s*(R@ca))[:,None]]), [0,0,0,1]]).tolist())
mp.matrix_world = T @ mp.matrix_world; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# landmarks (todos, inclusive olhos e oval) antes do corte: posição do vértice -> reencontrar depois
all_ids = [i for i in LM['vid'] if i in LS and int(i) < 468]
lm_src = np.array([mp.data.vertices[LM['vid'][i]].co[:] for i in all_ids]); lm_tgt = np.array([LS[i] for i in all_ids])
bm = bmesh.new(); bm.from_mesh(mp.data)
bmesh.ops.bisect_plane(bm, geom=bm.verts[:]+bm.edges[:]+bm.faces[:], plane_co=(0,0,0.035), plane_no=(0,0,-1), clear_outer=True)
bm.to_mesh(mp.data); bm.free()
V = np.array([v.co[:] for v in mp.data.vertices]); E = np.array([e.vertices[:] for e in mp.data.edges])
F = []
for p in mp.data.polygons:
    vs = p.vertices[:]
    for k in range(1, len(vs)-1): F.append((vs[0], vs[k], vs[k+1]))
# vértices internos (cavidade da boca, garganta, dobras fechadas): nenhum de 26 raios escapa da malha
# fechar a base temporariamente para o teste (senão a garganta escapa por baixo)
bmt = bmesh.new(); bmt.from_mesh(mp.data); bot = [e for e in bmt.edges if e.is_boundary]; nf0 = len(bmt.faces)
bmesh.ops.holes_fill(bmt, edges=bot, sides=0); bmt.to_mesh(mp.data); bmt.free(); nfill = len(mp.data.polygons) - nf0
mp.data.update(); occl = np.zeros(len(V), bool)
dirs = [Vector((x, y, z)).normalized() for x in (-1,0,1) for y in (-1,0,1) for z in (-1,0,1) if (x, y, z) != (0,0,0)]
for v in mp.data.vertices:
    esc = False
    for dd in dirs:
        hit, _, _, _ = mp.ray_cast(v.co + dd*0.0008, dd, distance=0.6)
        if not hit: esc = True; break
    occl[v.index] = not esc
print("PREP vertices ocultos: %d/%d -> removidos, buracos fechados" % (occl.sum(), len(V)))
bm = bmesh.new(); bm.from_mesh(mp.data); bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.faces[i] for i in range(nf0, nf0+nfill)], context='FACES_ONLY')
bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.nonzero(occl)[0]], context='VERTS')
be = [e for e in bm.edges if e.is_boundary and e.verts[0].co.z > 0.045]; nf0 = len(bm.faces); old = set(bm.faces)
bmesh.ops.holes_fill(bm, edges=be, sides=0); print("PREP buracos: %d arestas, %d faces novas" % (len(be), len(bm.faces)-nf0))
uvl = bm.loops.layers.uv.active; nuv = 0
for f in [f for f in bm.faces if f not in old]:             # faces novas herdam UV dos vértices (faces vizinhas antigas)
    for l in f.loops:
        srcs = [l2[uvl].uv.copy() for l2 in l.vert.link_loops if l2.face in old]
        if srcs: l[uvl].uv = srcs[0]; nuv += 1
print("PREP UVs herdadas:", nuv)
loose = [v for v in bm.verts if not v.link_faces]; bmesh.ops.delete(bm, geom=loose, context='VERTS'); print("PREP soltos removidos:", len(loose))
# alisar pálpebras e lábios (detalhe do MPFB que o scan não tem e que enruga na projeção)
lmp = {int(i): np.array(mp_pos) for i, mp_pos in zip(all_ids, lm_src)}
G = ((33,133,159,145,160,153), (362,263,386,374,387,380), (61,291,0,17,13,14), (2,98,327,94)); R = (0.030, 0.030, 0.034, 0.013)
regions = []
for g, r in zip(G, R):
    regions.append((np.mean([lmp[i] for i in g if i in lmp], 0), r)); regions.append((np.mean([LS[str(i)] for i in g], 0), r))
bm.verts.ensure_lookup_table(); P = np.array([v.co[:] for v in bm.verts]); sel = np.zeros(len(P), bool)
for c, r in regions: sel |= np.linalg.norm(P - c, axis=1) < r
# fundir camadas sobrepostas (margens das pálpebras, lábios) e alisar forte: vira membrana com as UVs originais
bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if sel[v.index]], dist=0.0035)
bmesh.ops.dissolve_degenerate(bm, dist=0.0008, edges=bm.edges[:])
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.verts.ensure_lookup_table(); bm.verts.index_update(); P = np.array([v.co[:] for v in bm.verts]); sel = np.zeros(len(P), bool)
for c, r in regions: sel |= np.linalg.norm(P - c, axis=1) < r + 0.004
nbv = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
for it in range(40):
    Pn = P.copy()
    for i in np.nonzero(sel)[0]: Pn[i] = 0.5*P[i] + 0.5*P[nbv[i]].mean(0)
    P = Pn
for i in np.nonzero(sel)[0]: bm.verts[i].co = P[i]
def folded():
    bm.normal_update(); out = []
    for f in bm.faces:
        nv = sum((v.normal for v in f.verts), start=Vector())
        if nv.length > 0 and f.normal.dot(nv.normalized()) < 0.3: out.append(f)
    return out
fd = folded(); print("PREP faces dobradas apos fusao/alisamento:", len(fd))
for _rep in range(3):
    fd = folded()
    if not fd: break
    old = set(bm.faces) - set(fd); bmesh.ops.delete(bm, geom=fd, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    be = [e for e in bm.edges if e.is_boundary and e.verts[0].co.z > 0.045]; bmesh.ops.holes_fill(bm, edges=be, sides=0)
    for f in [f for f in bm.faces if f not in old]:
        for l in f.loops:
            srcs = [l2[uvl].uv.copy() for l2 in l.vert.link_loops if l2.face in old]
            if srcs: l[uvl].uv = srcs[0]
    bm.verts.ensure_lookup_table(); bm.verts.index_update(); P = np.array([v.co[:] for v in bm.verts]); sel = np.zeros(len(P), bool)
    for c, r in regions: sel |= np.linalg.norm(P - c, axis=1) < r + 0.004
    print("PREP dobras residuais apos refechar:", len(folded()))

# UVs misturadas pela fusão (loops de ilhas diferentes no mesmo vértice): loop discrepante recebe a UV majoritária
fixed = 0
for v in bm.verts:
    if not sel[v.index] or len(v.link_loops) < 2: continue
    uvs = [l[uvl].uv.copy() for l in v.link_loops]
    best = max(uvs, key=lambda u: sum((u - w).length < 0.02 for w in uvs))
    for l in v.link_loops:
        if (l[uvl].uv - best).length > 0.03: l[uvl].uv = best; fixed += 1
print("PREP loops de UV corrigidos:", fixed)
print("PREP vertices macios: %d" % int(sel.sum()))
bm.to_mesh(mp.data); bm.free(); mp.data.update()
# re-unwrap das regiões fundidas com a borda fixada (LSCM com pins): UVs sem sobreposição
bpy.ops.object.mode_set(mode='EDIT'); bm2 = bmesh.from_edit_mesh(mp.data); uv2 = bm2.loops.layers.uv.active; bm2.verts.ensure_lookup_table()
bpy.context.scene.tool_settings.use_uv_select_sync = True
for f in bm2.faces:
    f.select = any(sel[v.index] for v in f.verts)
    for l in f.loops: l[uv2].pin_uv = not sel[l.vert.index]
bmesh.update_edit_mesh(mp.data); bpy.ops.uv.unwrap(method='ANGLE_BASED', margin=0.001); bpy.ops.object.mode_set(mode='OBJECT')
print("PREP re-unwrap das regioes macias: %d faces" % sum(1 for f in mp.data.polygons if f.select))
V = np.array([v.co[:] for v in mp.data.vertices]); E = np.array([e.vertices[:] for e in mp.data.edges]); F = []
for p in mp.data.polygons:
    vs = p.vertices[:]
    for k in range(1, len(vs)-1): F.append((vs[0], vs[k], vs[k+1]))
occl = np.zeros(len(V), bool)
d2 = ((V[None,:,:] - lm_src[:,None,:])**2).sum(2); idx = d2.argmin(1); ok = d2.min(1) < 1e-10
print("PREP landmarks reencontrados: %d/%d" % (ok.sum(), len(ok)))
np.savez(out + "_src.npz", V=V, E=E, F=np.array(F), occl=occl, soft=sel); np.savez(out + "_lm.npz", idx=idx[ok], pos=lm_tgt[ok], mp_id=np.array([int(i) for i in all_ids])[ok])
TV = np.array([v.co[:] for v in sw.data.vertices]); TF = []
for p in sw.data.polygons:
    vs = p.vertices[:]
    for k in range(1, len(vs)-1): TF.append((vs[0], vs[k], vs[k+1]))
np.savez(out + "_tgt.npz", V=TV, F=np.array(TF))
print("PREP src %d v / tgt %d v" % (len(V), len(TV)))
bpy.ops.wm.save_as_mainfile(filepath=out + "_prep.blend")
