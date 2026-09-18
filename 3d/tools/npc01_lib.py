"""Biblioteca do NPC01 (personagem cartoon riggado do Fael). Usada por tools/npc01_build.py e tools/npc01_render.py.
Tudo em numpy sobre a malha do MPFB2; nada de modificadores alem do Armature (para as chaves de forma sobreviverem ao glb)."""
import bpy, bmesh, numpy as np

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0); return t * t * (3 - 2 * t)

def tri_list(polys):
    """lista de poligonos (listas de indices) -> array (T,3) por leque"""
    out = []
    for p in polys:
        for i in range(1, len(p) - 1): out.append((p[0], p[i], p[i + 1]))
    return np.array(out, dtype=np.int64)

def vertex_normals(V, T):
    """normais por vertice ponderadas por area (T = triangulos)"""
    n = np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]])
    N = np.zeros_like(V)
    for k in range(3): np.add.at(N, T[:, k], n)
    l = np.linalg.norm(N, axis=1); l[l == 0] = 1
    return N / l[:, None]

def laplacian_smooth(X, adj, iters=3, lam=0.5, mask=None):
    """suaviza um campo X (n,k) pela media dos vizinhos (adj = lista de vizinhos por vertice)"""
    X = X.copy()
    for _ in range(iters):
        M = np.array([X[a].mean(0) if len(a) else X[i] for i, a in enumerate(adj)])
        if mask is None: X = X + lam * (M - X)
        else: X[mask] = X[mask] + lam * (M[mask] - X[mask])
    return X

def adjacency(nv, polys):
    adj = [[] for _ in range(nv)]
    for p in polys:
        for i in range(len(p)):
            a, b = p[i], p[(i + 1) % len(p)]; adj[a].append(b); adj[b].append(a)
    return [sorted(set(a)) for a in adj]

def read_mesh(o):
    """(V, polys) do objeto"""
    me = o.data; V = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('co', V)
    return V.reshape(-1, 3), [list(p.vertices) for p in me.polygons]

def new_mesh_object(name, V, polys, col=None):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in V], [], [list(map(int, p)) for p in polys])
    me.validate(); me.update()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    for p in me.polygons: p.use_smooth = True
    return o

def set_vcolor(o, C):
    """cor por vertice (n,3) em atributo 'Col' (FLOAT_COLOR por vertice, sRGB assumido linear ja convertido)"""
    me = o.data
    if 'Col' not in me.color_attributes: me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    a = me.color_attributes['Col']; C4 = np.concatenate([C, np.ones((len(C), 1))], 1).astype(np.float32)
    a.data.foreach_set('color', C4.ravel()); me.color_attributes.active_color = a; me.color_attributes.render_color_index = 0

def srgb(hexcol):
    """'#rrggbb' -> linear rgb"""
    h = hexcol.lstrip('#'); c = np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def shell(V, N, polys_sub, src, thick, inner=0.0015, smooth=0, disp=None):
    """Casca fechada sobre um subconjunto de poligonos da malha fonte.
    V,N: posicoes/normais da malha fonte; polys_sub: poligonos (indices da fonte); src: indices unicos usados;
    thick: espessura por vertice fonte (array n_fonte). Retorna (Vs, polys, src_of_vertex) com camada externa (offset +thick),
    camada interna (offset -inner) e paredes na borda. src_of_vertex mapeia cada vertice da casca ao vertice fonte."""
    src = np.array(sorted(set(src))); loc = {int(s): i for i, s in enumerate(src)}; n = len(src)
    Vo = V[src] + N[src] * thick[src][:, None] + (0 if disp is None else disp[src]); Vi = V[src] - N[src] * inner
    if smooth:   # arredonda a camada externa (tira os degraus da borda da regiao)
        loc_polys = [[loc[int(i)] for i in p] for p in polys_sub]; adj = adjacency(n, loc_polys)
        Ns = N[src]
        for _ in range(smooth):   # suavizacao so tangencial (nao encolhe a casca para dentro da pele)
            M = np.array([Vo[a].mean(0) if len(a) else Vo[i] for i, a in enumerate(adj)]); d = M - Vo
            d -= (d * Ns).sum(1)[:, None] * Ns; Vo += 0.5 * d
    Vs = np.concatenate([Vo, Vi]); polys = []
    edge_count = {}
    for p in polys_sub:
        q = [loc[int(i)] for i in p]; polys.append(q); polys.append([i + n for i in q[::-1]])
        for i in range(len(q)):
            e = (q[i], q[(i + 1) % len(q)]); edge_count[e] = edge_count.get(e, 0) + 1
    for (a, b), c in edge_count.items():
        if (b, a) in edge_count: continue   # aresta interna
        polys.append([b, a, a + n, b + n])
    return Vs, polys, np.concatenate([src, src])

def region_polys(polys, vmask):
    """poligonos cujos vertices estao todos na mascara"""
    return [p for p in polys if all(vmask[i] for i in p)]

def toon_material(name, ramp=((0.0, 0.55), (0.45, 0.82), (0.75, 1.0)), use_vcol=True, outline=False, color=(1, 1, 1), image=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    if outline:
        em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (0.02, 0.015, 0.012, 1); em.inputs['Strength'].default_value = 1.0
        nt.links.new(em.outputs[0], out.inputs[0]); m.use_backface_culling = True; m.diffuse_color = (0.02, 0.02, 0.02, 1)
        return m
    dif = nt.nodes.new('ShaderNodeBsdfDiffuse'); s2r = nt.nodes.new('ShaderNodeShaderToRGB')
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.interpolation = 'CONSTANT'
    els = cr.color_ramp.elements
    els[0].position, els[0].color = ramp[0][0], (ramp[0][1],) * 3 + (1,)
    els[1].position, els[1].color = ramp[1][0], (ramp[1][1],) * 3 + (1,)
    for pos, val in ramp[2:]:
        e = els.new(pos); e.color = (val,) * 3 + (1,)
    mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs[0].default_value = 1.0
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 1.0
    # PBR paralelo para o glb: Principled com a cor de vertice (o exportador so le o Principled)
    pr = nt.nodes.new('ShaderNodeBsdfPrincipled'); pr.inputs['Roughness'].default_value = 0.9
    nt.links.new(dif.outputs[0], s2r.inputs[0]); nt.links.new(s2r.outputs[0], cr.inputs[0]); nt.links.new(cr.outputs[0], mul.inputs[6])
    if image is not None:
        va = nt.nodes.new('ShaderNodeTexImage'); va.image = image; va.interpolation = 'Linear'
        nt.links.new(va.outputs[0], mul.inputs[7]); nt.links.new(va.outputs[0], pr.inputs['Base Color'])
    elif use_vcol:
        va = nt.nodes.new('ShaderNodeVertexColor'); va.layer_name = 'Col'
        nt.links.new(va.outputs[0], mul.inputs[7]); nt.links.new(va.outputs[0], pr.inputs['Base Color'])
    else:
        mul.inputs[7].default_value = tuple(color) + (1,); pr.inputs['Base Color'].default_value = tuple(color) + (1,)
    nt.links.new(mul.outputs[2], em.inputs[0]); nt.links.new(em.outputs[0], out.inputs[0])
    m.diffuse_color = tuple(color) + (1,)
    return m

def add_shape_keys(o, keys, basis_V=None):
    """keys: dict nome -> posicoes absolutas (n,3). Cria Basis se nao houver."""
    if o.data.shape_keys is None:
        o.shape_key_add(name='Basis', from_mix=False)
        if basis_V is not None: o.data.shape_keys.key_blocks['Basis'].data.foreach_set('co', np.asarray(basis_V, dtype=np.float64).ravel())
    for nm, P in keys.items():
        k = o.shape_key_add(name=nm, from_mix=False); k.data.foreach_set('co', np.asarray(P, dtype=np.float64).ravel()); k.value = 0.0
        k.slider_min = 0.0; k.slider_max = 1.0

def set_weights(o, groups):
    """groups: dict nome_osso -> array pesos (n)"""
    for nm, w in groups.items():
        g = o.vertex_groups.get(nm) or o.vertex_groups.new(name=nm)
        idx = np.nonzero(w > 1e-4)[0]
        for i in idx: g.add([int(i)], float(w[i]), 'REPLACE')

def get_weights(o):
    """dict nome_grupo -> array pesos (n)"""
    n = len(o.data.vertices); W = {g.name: np.zeros(n) for g in o.vertex_groups}; names = {g.index: g.name for g in o.vertex_groups}
    for v in o.data.vertices:
        for g in v.groups: W[names[g.group]][v.index] = g.weight
    return {k: v for k, v in W.items() if v.max() > 0}

def uv_sphere(name, r, center, seg=48, ring=24):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=r)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); o.location = center
    for p in me.polygons: p.use_smooth = True
    return o
