"""Cirurgia local dos olhos no scan (S08). Rodar DENTRO do Blender (interativo): import s08_eye as E; depois chamar as etapas.
Cada etapa é pequena, idempotente por lado e imprime suas medidas. Nada fora da região do olho é tocado.
  subdiv(s)  -> subdivide só as faces da região do olho (sem suavizar: a superfície não muda)
  cut(s)     -> apaga as faces dentro do contorno traçado à mão e encosta a borda na curva
  rim(s)     -> borda de pálpebra: extrusão da margem até a superfície do globo
  ball(s)    -> globo ocular (objeto próprio, gira para olhar)
Unidades do arquivo: metros. Contornos e centros em analise/gate/."""
import bpy, bmesh, json, math, os, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
CONT = json.load(open(ROOT + 'analise/gate/olhos_contorno_mao.json')); CEN = json.load(open(ROOT + 'analise/gate/olhos_centro.json'))
R_EYE = 0.0136

def spline(s, n=600, shrink=0.0):
    P = np.array(CONT[s], float)/1000; m = len(P); out = []
    for i in range(m):
        p0, p1, p2, p3 = P[(i-1) % m], P[i], P[(i+1) % m], P[(i+2) % m]
        for t in np.linspace(0, 1, n//m, endpoint=False):
            out.append(0.5*((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t*t + (-p0+3*p1-3*p2+p3)*t**3))
    Q = np.array(out)
    if shrink: c = Q.mean(0); d = Q - c; Q = c + d*(1 - shrink/np.linalg.norm(d, axis=1, keepdims=True))
    return Q

def inpoly(px, pz, poly):
    x, z = poly[:, 0], poly[:, 1]; ins = np.zeros(len(px), bool); j = len(poly)-1
    for i in range(len(poly)):
        ins ^= ((z[i] > pz) != (z[j] > pz)) & (px < (x[j]-x[i])*(pz-z[i])/(z[j]-z[i]+1e-15) + x[i]); j = i
    return ins

def _bm():
    me = bpy.data.objects['Busto'].data; bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table(); bm.verts.ensure_lookup_table(); return me, bm

def _region_faces(bm, s, margin):
    Q = spline(s); x0, z0 = Q.min(0) - margin; x1, z1 = Q.max(0) + margin; yc = CEN[s][1]
    return [f for f in bm.faces if f.normal.y < 0.3 and x0 < (c := f.calc_center_median()).x < x1 and z0 < c.z < z1 and c.y < yc]

def subdiv(s, cuts=2, margin=0.004):
    me, bm = _bm(); nv = len(bm.verts); F = _region_faces(bm, s, margin)
    ed = list({e for f in F for e in f.edges}); L0 = np.mean([e.calc_length() for e in ed])
    bmesh.ops.subdivide_edges(bm, edges=ed, cuts=cuts, use_grid_fill=True, smooth=0.0)
    bm.to_mesh(me); me.update(); print("SUBDIV %s: %d faces, aresta media %.2f mm -> ~%.2f mm; vertices %d -> %d" % (s, len(F), L0*1000, L0*1000/(cuts+1), nv, len(bm.verts))); bm.free()

def hole(s, shrink=0.0003, k=0.95, n=720):
    """Abertura = contorno traçado INTERSEÇÃO disco de raio k*R em torno do centro do globo: além da silhueta do globo
    o que se vê é carúncula (medial), que fica como está pintada no scan."""
    Q = spline(s, shrink=shrink); cx, _, cz = CEN[s]; d = np.hypot(Q[:, 0]-cx, Q[:, 1]-cz); rc = k*R_EYE
    Q2 = Q.copy(); far = d > rc; Q2[far] = np.c_[cx + (Q[far, 0]-cx)*rc/d[far], cz + (Q[far, 1]-cz)*rc/d[far]]
    return Q2, int(far.sum())

def center(s, cx, cz, lid=0.0008):
    """Centro do globo ANTES do corte: (cx, cz) medidos; y = o mais à frente possível ficando atrás de toda a margem."""
    me, bm = _bm(); bvh = BVHTree.FromBMesh(bm); Q = spline(s, n=240); ys = []
    for x, z in Q:
        d2 = (x-cx)**2 + (z-cz)**2
        if d2 > ((R_EYE+lid)**2)*0.9: continue
        h = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
        if h[0] is not None: ys.append(h[0].y + math.sqrt((R_EYE+lid)**2 - d2))
    bm.free(); yc = float(max(ys)); CEN[s] = [cx, yc, cz]; json.dump(CEN, open(ROOT + 'analise/gate/olhos_centro.json', 'w'))
    print("CENTRO %s = (%.1f, %.1f, %.1f) mm; frente do globo y %.1f mm" % (s, cx*1000, yc*1000, cz*1000, (yc-R_EYE)*1000))

def cut(s, shrink=0.0003):
    me, bm = _bm(); Q, nclip = hole(s, shrink=shrink); F = _region_faces(bm, s, 0.001)
    print("   abertura: %d de %d pontos do contorno recuados para a silhueta do globo (caruncula preservada)" % (nclip, len(Q)))
    C = np.array([f.calc_center_median()[:] for f in F]); ins = inpoly(C[:, 0], C[:, 2], Q)
    dead = [f for f, k in zip(F, ins) if k]
    bvh = BVHTree.FromBMesh(bm)
    bmesh.ops.delete(bm, geom=dead, context='FACES'); bm.verts.ensure_lookup_table()
    B = [v for v in bm.verts if v.is_boundary and abs(v.co.x - Q[:, 0].mean()) < 0.03 and abs(v.co.z - Q[:, 1].mean()) < 0.02 and v.co.y < CEN[s][1]]
    mv = []
    for v in B:
        d = np.hypot(Q[:, 0]-v.co.x, Q[:, 1]-v.co.z); k = d.argmin()
        if d[k] > 0.0012: continue
        hit = bvh.ray_cast(Vector((Q[k, 0], -1.0, Q[k, 1])), Vector((0, 1, 0)))
        if hit[0] is None: continue
        mv.append(d[k]); v.co = hit[0]
    vg = bpy.data.objects['Busto'].vertex_groups.get('margem_'+s) or bpy.data.objects['Busto'].vertex_groups.new(name='margem_'+s)
    idx = [v.index for v in B]
    bm.to_mesh(me); me.update(); vg.add(idx, 1.0, 'REPLACE'); bm.free()
    print("CUT %s: %d faces removidas, %d vertices de borda encostados na curva (media %.2f mm, max %.2f mm)" % (s, len(dead), len(mv), np.mean(mv)*1000, np.max(mv)*1000))

# ---------------------------------------------------------------- borda de pálpebra
def rim(s, sink=0.0004):
    ob = bpy.data.objects['Busto']; me, bm = _bm(); gi = ob.vertex_groups['margem_'+s].index; dl = bm.verts.layers.deform.verify(); uvl = bm.loops.layers.uv.verify()
    c = Vector(CEN[s]); B = {v for v in bm.verts if gi in v[dl] and v.is_boundary}
    E = [e for e in bm.edges if e.is_boundary and e.verts[0] in B and e.verts[1] in B]
    uv_of = {v: v.link_loops[0][uvl].uv.copy() for v in B}
    r = bmesh.ops.extrude_edge_only(bm, edges=E); newv = [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]; newf = [g for g in r['geom'] if isinstance(g, bmesh.types.BMFace)]
    src = {}
    for f in newf:
        for e in f.edges:
            a, b = e.verts
            if (a in B) != (b in B): src[b if a in B else a] = a if a in B else b
    depth = []
    for v in newv:                                   # parede reta na direção do olhar (+y): de frente não ocupa área nenhuma
        p = v.co.copy(); d2 = (p.x-c.x)**2 + (p.z-c.z)**2; ys = c.y - math.sqrt(max(R_EYE**2 - d2, 0.0)) + sink
        q = Vector((p.x, max(ys, p.y + 0.0003), p.z)); depth.append((q-p).length); v.co = q
        v[dl].clear()
    mid = sum((v.co for v in B), Vector())/len(B)
    for f in newf:
        if f.normal.dot(mid - f.calc_center_median()) < 0: f.normal_flip()
        for l in f.loops: l[uvl].uv = uv_of[l.vert if l.vert in B else src[l.vert]]
        f.smooth = True
    idx_new = [v.index for v in newv]
    bm.to_mesh(me); me.update(); bm.free()
    vg = ob.vertex_groups.get('borda_'+s) or ob.vertex_groups.new(name='borda_'+s); vg.add(idx_new, 1.0, 'REPLACE')
    print("RIM %s: %d arestas, parede media %.2f mm, min %.2f, max %.2f mm" % (s, len(E), np.mean(depth)*1000, np.min(depth)*1000, np.max(depth)*1000))

# ---------------------------------------------------------------- textura e globo
COL = dict(sclera=(142, 108, 100), sclera_far=(96, 54, 45), iris=(24, 10, 9), iris_in=(36, 16, 13), limbus=(15, 5, 5), pupil=(13, 5, 5), glint=(225, 215, 212))
def eye_texture(size=1024, r_iris=0.0070, path=ROOT + 'export/s08/olho_tex.png'):
    """Projeção azimutal equidistante em torno do eixo do olhar: raio 0.5 da imagem = 180 graus."""
    yy, xx = np.mgrid[0:size, 0:size]; u = (xx + 0.5)/size - 0.5; v = 0.5 - (yy + 0.5)/size
    th = np.hypot(u, v)*2*math.pi; arc = th*R_EYE; chord = np.sin(np.clip(th, 0, math.pi/2))*R_EYE      # raio projetado, em metros
    lin = lambda c: (np.array(c)/255.0)**2.2
    sm = lambda a, b, x: np.clip((x-a)/(b-a), 0, 1)**2*(3 - 2*np.clip((x-a)/(b-a), 0, 1))
    img = lin(COL['sclera'])[None, None]*(1 - sm(0.0060, 0.0130, chord)[..., None]) + lin(COL['sclera_far'])[None, None]*sm(0.0060, 0.0130, chord)[..., None]
    img[th > math.pi/2] = lin(COL['sclera_far'])
    rr = chord/r_iris; ang = np.arctan2(v, u)
    fib = 0.5 + 0.5*np.sin(ang*41 + 3*np.sin(ang*7))                                                  # estrias radiais discretas
    iris = lin(COL['iris'])[None, None]*(1 - 0.18*fib[..., None]*sm(0.35, 0.8, rr)[..., None]) + lin(COL['iris_in'])[None, None]*(0.18*fib*sm(0.35, 0.8, rr)*(1 - sm(0.8, 1.0, rr)))[..., None]
    iris = iris*(1 - sm(0.78, 1.0, rr))[..., None] + lin(COL['limbus'])[None, None]*sm(0.78, 1.0, rr)[..., None]
    iris = iris*sm(0.30, 0.38, rr)[..., None] + lin(COL['pupil'])[None, None]*(1 - sm(0.30, 0.38, rr))[..., None]
    a = (1 - sm(0.94, 1.10, rr))[..., None]*(th < math.pi/2)[..., None]; img = img*(1 - a) + iris*a
    gx, gz = 0.0016, 0.0012; g = np.exp(-(((np.sin(th)*R_EYE*np.cos(ang) - gx)**2 + (np.sin(th)*R_EYE*np.sin(ang) - gz)**2)/(2*0.00032**2)))*(th < math.pi/2)
    img = img*(1 - 0.85*g[..., None]) + lin(COL['glint'])[None, None]*0.85*g[..., None]
    out = np.concatenate([np.clip(img, 0, 1)**(1/2.2), np.ones((size, size, 1))], 2)[::-1]
    im = bpy.data.images.get('olho_tex') or bpy.data.images.new('olho_tex', size, size, alpha=False)
    im.pixels.foreach_set(out.astype(np.float32).ravel()); im.filepath_raw = path; im.file_format = 'PNG'; im.save(); im.pack(); return im

def eye_material():
    m = bpy.data.materials.get('Olho')
    if m: eye_texture(); return m
    m = bpy.data.materials.new('Olho'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = eye_texture(); em = nt.nodes.new('ShaderNodeEmission'); o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(t.outputs['Color'], em.inputs['Color']); nt.links.new(em.outputs[0], o.inputs['Surface']); nt.nodes.active = t; return m

def set_center(s, cx, cz, lid=0.0008):
    """Centro do globo: (cx, cz) medidos; y = o mais à frente possível ficando atrás de TODA a margem da pálpebra."""
    ob = bpy.data.objects['Busto']; gi = ob.vertex_groups['margem_'+s].index
    P = np.array([v.co[:] for v in ob.data.vertices if any(g.group == gi for g in v.groups)])
    d2 = (P[:, 0]-cx)**2 + (P[:, 2]-cz)**2; ok = d2 < ((R_EYE+lid)**2)*0.97
    yc = float((P[ok, 1] + np.sqrt((R_EYE+lid)**2 - d2[ok])).max()); CEN[s] = [cx, yc, cz]
    json.dump(CEN, open(ROOT + 'analise/gate/olhos_centro.json', 'w'))
    print("CENTRO %s = (%.1f, %.1f, %.1f) mm; frente do globo y %.1f; %d de %d pontos de margem sobre o globo" % (s, cx*1000, yc*1000, cz*1000, (yc-R_EYE)*1000, ok.sum(), len(P)))

def ball(s, pitch=0.0, yaw=0.0, seg=64, rings=32):
    nm = 'Olho_'+s
    if nm in bpy.data.objects: bpy.data.objects.remove(bpy.data.objects[nm])
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=R_EYE)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(math.radians(90), 3, 'X'))   # polo +Z -> -Y (olhar)
    uvl = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        f.smooth = True; fc = f.calc_center_median(); phi_f = math.atan2(fc.z, fc.x)
        for l in f.loops:
            p = l.vert.co; th = math.acos(max(-1, min(1, -p.y/R_EYE))); phi = math.atan2(p.z, p.x) if math.hypot(p.x, p.z) > 1e-7 else phi_f
            rr = th/(2*math.pi); l[uvl].uv = (0.5 + rr*math.cos(phi), 0.5 + rr*math.sin(phi))
    me = bpy.data.meshes.new(nm); bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new(nm, me); bpy.context.scene.collection.objects.link(ob)
    ob.location = CEN[s]; ob.rotation_euler = (math.radians(pitch), 0, math.radians(yaw)); me.materials.append(eye_material()); print("BALL %s centro %s mm raio %.1f mm" % (s, np.round(np.array(CEN[s])*1000, 1), R_EYE*1000)); return ob

# ---------------------------------------------------------------- sombra das pálpebras (malha de oclusão)
def flat_materials():
    """Pele sem luz de cena (a luz já está assada na textura do scan): textura -> emissão. Só troca o material."""
    ob = bpy.data.objects['Busto']; m = ob.data.materials[0]; nt = m.node_tree
    if any(n.type == 'EMISSION' for n in nt.nodes): return
    t = next(n for n in nt.nodes if n.type == 'TEX_IMAGE'); out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(t.outputs['Color'], em.inputs['Color']); nt.links.new(em.outputs[0], out.inputs['Surface']); nt.nodes.active = t

def shade_material():
    m = bpy.data.materials.get('SombraOlho')
    if m: return m
    m = bpy.data.materials.new('SombraOlho'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'sombra'; em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (0.016, 0.004, 0.003, 1)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader'); o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(a.outputs['Color'], mx.inputs['Fac']); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], o.inputs['Surface'])
    try: m.surface_render_method = 'BLENDED'
    except Exception: m.blend_method = 'BLEND'
    return m

def shell(s, a_up=0.92, a_lo=0.50, a_med=0.92, a_lat=0.75, width=0.85, power=0.95, lash=0.97, lash_w=0.16, lift=0.00030, rings=16):
    """Calota sobre o globo (0,3 mm à frente), presa à pálpebra. Alfa: forte na margem, zero no centro; mais forte sob a
    pálpebra superior e no canto medial, como na foto (a esclera dele nunca é clara junto às pálpebras)."""
    nm = 'Sombra_'+s
    if nm in bpy.data.objects: bpy.data.objects.remove(bpy.data.objects[nm])
    Q, _ = hole(s, shrink=-0.0005); step = max(1, len(Q)//200); Q = Q[::step]; n = len(Q); cx, yc, cz = CEN[s]; ctr = Q.mean(0); Rl = R_EYE + lift
    bm = bmesh.new(); col = bm.loops.layers.float_color.new('sombra'); V = []; A = []
    ang = np.arctan2(Q[:, 1]-ctr[1], (Q[:, 0]-ctr[0])*(1 if s == 'E' else -1))          # 0 = medial... espelhado por lado
    for r in range(rings+1):
        t = 1 - r/rings; row = []; arow = []
        for i in range(n):
            x, z = ctr + (Q[i]-ctr)*t; d2 = min((x-cx)**2 + (z-cz)**2, Rl**2*0.999); y = yc - math.sqrt(Rl**2 - d2)
            up = max(0.0, math.sin(ang[i])); lo = max(0.0, -math.sin(ang[i])); md = max(0.0, -math.cos(ang[i]))**2; lt = max(0.0, math.cos(ang[i]))**2
            edge = (a_up*up + a_lo*lo)*(1 - max(md, lt)) + a_med*md + a_lat*lt
            k = max(0.0, (t - (1-width))/width); a_ = edge*k**power
            lk = max(0.0, (t - (1-lash_w))/lash_w); lk = lk*lk*(3-2*lk)                      # linha dos cílios: faixa escura junto à margem superior
            a_ = max(a_, lash*lk*min(1.0, up*2.2 + 0.35*lt + 0.5*md)); arow.append(a_); row.append(bm.verts.new((x, y, z)))
        V.append(row); A.append(arow)
    for r in range(rings):
        for i in range(n):
            j = (i+1) % n; vs = [V[r][i], V[r][j], V[r+1][j], V[r+1][i]]; al = [A[r][i], A[r][j], A[r+1][j], A[r+1][i]]
            if r == rings-1: vs, al = vs[:3], al[:3]
            try: f = bm.faces.new(vs)
            except ValueError: continue
            for l, a_ in zip(f.loops, al): l[col] = (a_, a_, a_, 1.0)
            f.smooth = True
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(nm); bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new(nm, me); bpy.context.scene.collection.objects.link(ob); me.materials.append(shade_material())
    print("SHELL %s: %d vertices, alfa max %.2f" % (s, len(me.vertices), max(max(r) for r in A))); return ob


# ---------------------------------------------------------------- carúncula: repintura local da textura
def paint_caruncle(s, col=(96, 44, 36), col_lat=(52, 26, 22), mix=0.80, path=ROOT + 'export/s08/3DModel_s08.png'):
    """O trecho da abertura pintada que fica ALÉM da silhueta do globo não é esclera: é carúncula/prega (carne rosada escura
    na foto). Repinta só esses texels, com borda esfumada. A textura original não é alterada: salva cópia em export/s08."""
    ob = bpy.data.objects['Busto']; me = ob.data; img = next(n for n in me.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE').image
    W, H = img.size; px = np.empty(W*H*4, np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)
    full = spline(s, shrink=0.0); hq, _ = hole(s, shrink=0.0003); cx, yc, cz = CEN[s]
    bm = bmesh.new(); bm.from_mesh(me); uvl = bm.loops.layers.uv.verify(); mask = np.zeros((H, W), np.float32); mask_l = np.zeros((H, W), np.float32); n = 0
    for f in bm.faces:
        c = f.calc_center_median()
        if f.normal.y > 0.3 or c.y > yc or abs(c.x-cx) > 0.03 or abs(c.z-cz) > 0.02: continue
        if not inpoly(np.array([c.x]), np.array([c.z]), full)[0] or inpoly(np.array([c.x]), np.array([c.z]), hq)[0]: continue
        uv = np.array([l[uvl].uv[:] for l in f.loops]); u0, v0 = (uv.min(0)*[W, H]).astype(int) - 1; u1, v1 = (uv.max(0)*[W, H]).astype(int) + 1
        lateral = (c.x - cx)*(1 if s == 'E' else -1) > 0
        (mask_l if lateral else mask)[max(v0, 0):v1+1, max(u0, 0):u1+1] = 1.0; n += 1
    bm.free()
    k = np.array([1, 4, 6, 4, 1], np.float32)/16
    def soft(m):
        ys, xs = np.nonzero(m)
        if not len(ys): return m
        y0, y1, x0, x1 = ys.min()-8, ys.max()+9, xs.min()-8, xs.max()+9; w = m[y0:y1, x0:x1]
        for _ in range(2):
            w = np.apply_along_axis(lambda r: np.convolve(r, k, 'same'), 1, w); w = np.apply_along_axis(lambda r: np.convolve(r, k, 'same'), 0, w)
        m = m.copy(); m[y0:y1, x0:x1] = w; return m
    for mk, cc in ((soft(mask), col), (soft(mask_l), col_lat)):
        a = (mk*mix)[..., None]; px[..., :3] = px[..., :3]*(1 - a) + (np.array(cc)/255.0)[None, None]*a
    new = bpy.data.images.get('3DModel_s08') or bpy.data.images.new('3DModel_s08', W, H, alpha=False)
    new.pixels.foreach_set(px.ravel()); new.filepath_raw = path; new.file_format = 'PNG'; new.save(); new.pack()
    for nd in me.materials[0].node_tree.nodes:
        if nd.type == 'TEX_IMAGE': nd.image = new
    print("CARUNCULA %s: %d faces; texels: medial %d, lateral %d" % (s, n, int(mask.sum()), int(mask_l.sum())))

def build(s, cx, cz, pitch=-5.0, yaw=0.0):
    center(s, cx, cz); subdiv(s); cut(s); rim(s); flat_materials(); paint_caruncle(s); ball(s, pitch=pitch, yaw=yaw); shell(s)

# ---------------------------------------------------------------- piscar (shape key anatômica)
ARKIT = {'D': 'eyeBlinkRight', 'E': 'eyeBlinkLeft'}
def _margins(s):
    """z da margem superior e inferior em função de x, pelo contorno COMPLETO da fenda (inclui a carúncula pintada: ao fechar,
    as pálpebras se encontram até o canto medial e a escondem)."""
    Q = spline(s, shrink=0.0003); i0, i1 = Q[:, 0].argmin(), Q[:, 0].argmax(); a, b = sorted((i0, i1))
    c1 = Q[a:b+1]; c2 = np.r_[Q[b:], Q[:a+1]]; up, lo = (c1, c2) if c1[:, 1].mean() > c2[:, 1].mean() else (c2, c1)
    up = up[np.argsort(up[:, 0])]; lo = lo[np.argsort(lo[:, 0])]; xs = np.linspace(Q[:, 0].min(), Q[:, 0].max(), 200)
    zu = np.interp(xs, up[:, 0], up[:, 1]); zl = np.interp(xs, lo[:, 0], lo[:, 1]); return xs, np.maximum(zu, zl), np.minimum(zu, zl)

def _blink_field(s, X, Z, share_lo=0.22, H_up=0.011, H_lo=0.007, taper=0.004, overlap=0.00015):
    """Deslocamento vertical do fechamento para pontos (X, Z). Devolve dz e um rótulo: 1 pálpebra sup., -1 inf., 0 abertura."""
    xs, zu, zl = _margins(s); xe = np.clip(X, xs[0], xs[-1]); out = np.maximum(np.abs(X - xe), 0.0)
    g = 1 - np.clip(out/taper, 0, 1)**2*(3 - 2*np.clip(out/taper, 0, 1))                       # some além dos cantos
    ZU = np.interp(xe, xs, zu); ZL = np.interp(xe, xs, zl); ZC = ZL + share_lo*(ZU - ZL)
    sm = lambda u: 1 - np.clip(u, 0, 1)**2*(3 - 2*np.clip(u, 0, 1))
    dz = np.zeros_like(Z); lab = np.zeros(len(Z), int)
    up = Z >= ZU; lo = Z <= ZL; mid = ~up & ~lo
    open_ = (ZU - ZL) > 2*overlap                                                              # nos cantos não há o que sobrepor
    dz[up] = -((ZU - ZC) + overlap*open_)[up]*sm((Z - ZU)[up]/H_up); lab[up] = 1
    dz[lo] = ((ZC - ZL) + overlap*open_)[lo]*sm((ZL - Z)[lo]/H_lo); lab[lo] = -1
    sp = np.where(ZU - ZL > 1e-9, (Z - ZL)/np.maximum(ZU - ZL, 1e-9), 0.5); dz[mid] = (ZC - Z)[mid]   # dentro da abertura: colapsa na linha de fechamento
    return dz*g, lab

def _ysph(s, X, Z, R=None, kmax=0.98):
    cx, yc, cz = CEN[s]; R = R or R_EYE; d2 = np.minimum((X-cx)**2 + (Z-cz)**2, (kmax*R)**2); return yc - np.sqrt(R**2 - d2)

def blink(s):
    ob = bpy.data.objects['Busto']; me = ob.data; cx, yc, cz = CEN[s]
    if not me.shape_keys: ob.shape_key_add(name='Basis')
    name = ARKIT[s]
    if name in me.shape_keys.key_blocks: ob.shape_key_remove(me.shape_keys.key_blocks[name])
    n = len(me.vertices); V = np.empty(n*3, np.float32); me.shape_keys.key_blocks[0].data.foreach_get('co', V); V = V.reshape(-1, 3).astype(np.float64)
    N = np.empty(n*3, np.float32); me.vertices.foreach_get('normal', N); N = N.reshape(-1, 3)
    gi = ob.vertex_groups['borda_'+s].index; wall = np.array([any(g.group == gi for g in v.groups) for v in me.vertices])
    reg = (np.abs(V[:, 0]-cx) < 0.026) & (V[:, 2] > cz-0.020) & (V[:, 2] < cz+0.020) & (V[:, 1] < yc) & ((N[:, 1] < 0.35) | wall)
    idx = np.nonzero(reg)[0]; X, Y, Z = V[idx, 0], V[idx, 1], V[idx, 2]
    dz, lab = _blink_field(s, X, Z); Zn = Z + dz
    h = _ysph(s, X, Z, kmax=0.72) - Y; Yn = _ysph(s, X, Zn, kmax=0.72) - h   # guia: só a zona central do globo; perto da silhueta a pálpebra mantém a própria profundidade
    #                                          # mantém a espessura original da pálpebra sobre o globo
    w_ = wall[idx]; Yn[w_] = _ysph(s, X[w_], Zn[w_]) + 0.0004
    mv = np.abs(dz) > 1e-6; Yn[~mv] = Y[~mv]
    K = V.copy(); K[idx, 1] = Yn; K[idx, 2] = Zn
    kb = ob.shape_key_add(name=name, from_mix=False); kb.data.foreach_set('co', K.astype(np.float32).ravel())
    d = np.linalg.norm(K - V, axis=1); print("BLINK %s (%s): %d vertices movem, max %.1f mm (sup. desce ate %.1f, inf. sobe ate %.1f mm)" % (s, name, (d > 1e-6).sum(), d.max()*1000, -dz[lab == 1].min()*1000 if (lab == 1).any() else 0, dz[lab == -1].max()*1000 if (lab == -1).any() else 0))
    # a sombra acompanha as pálpebras
    so = bpy.data.objects['Sombra_'+s]; sm_ = so.data
    if not sm_.shape_keys: so.shape_key_add(name='Basis')
    if name in sm_.shape_keys.key_blocks: so.shape_key_remove(sm_.shape_keys.key_blocks[name])
    S = np.array([v.co[:] for v in sm_.vertices]); dzs, _ = _blink_field(s, S[:, 0], S[:, 2]); S2 = S.copy(); S2[:, 2] += dzs; S2[:, 1] = _ysph(s, S2[:, 0], S2[:, 2], R_EYE + 0.0003)
    kb2 = so.shape_key_add(name=name, from_mix=False); kb2.data.foreach_set('co', S2.astype(np.float32).ravel())


def wall_material(s, col=(62, 28, 25)):
    """Paredes internas das pálpebras com material próprio (carne escura), em vez do pixel da margem esticado."""
    ob = bpy.data.objects['Busto']; me = ob.data; m = bpy.data.materials.get('ParedePalpebra')
    if not m:
        m = bpy.data.materials.new('ParedePalpebra'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
        em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = tuple((c/255.0)**2.2 for c in col) + (1,); o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs[0], o.inputs['Surface'])
        m.diffuse_color = tuple(c/255.0 for c in col) + (1,)
    if m.name not in [x.name for x in me.materials]: me.materials.append(m)
    mi = [x.name for x in me.materials].index(m.name); gi = ob.vertex_groups['borda_'+s].index
    inb = np.array([any(g.group == gi for g in v.groups) for v in me.vertices]); n = 0
    for p_ in me.polygons:
        if any(inb[i] for i in p_.vertices): p_.material_index = mi; n += 1
    me.update(); print("PAREDE %s: %d faces com material proprio" % (s, n))
