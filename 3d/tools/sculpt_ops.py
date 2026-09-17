"""Operações de escultura pontual no objeto 'Busto' do Blender interativo ou em batch. Uso interativo:
    exec(open('tools/sculpt_ops.py').read(), G); G['op_mirror'](...)
Toda operação atua numa esfera (centro em mm no frame do busto-base, raio em mm) com decaimento suave
w = (1-(d/r)^2)^2, como um pincel. Frame: x+ = lado ESQUERDO do Fael, -y = frente, z = altura. Plano de simetria x=0.
Cada chamada é registrada em analise/sculpt_log.json para reprodução."""
import bpy, json, os, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
LOG = 'analise/sculpt_log.json'
def _ob(): return bpy.data.objects['Busto']
def _V():
    me = _ob().data; V = np.empty(len(me.vertices)*3); me.vertices.foreach_get('co', V); return V.reshape(-1, 3)
def _set(V):
    me = _ob().data; me.vertices.foreach_set('co', V.ravel()); me.update()
def _w(V, c, r):
    d = np.linalg.norm(V - np.array(c)/1000, axis=1)/(r/1000); return np.where(d < 1, (1 - np.clip(d, 0, 1)**2)**2, 0.0)
def _edges():
    me = _ob().data; E = np.empty(len(me.edges)*2, np.int64); me.edges.foreach_get('vertices', E); return E.reshape(-1, 2)
def _log(name, **kw):
    L = json.load(open(LOG)) if os.path.exists(LOG) else []
    L.append(dict(op=name, file=bpy.data.filepath, **kw)); json.dump(L, open(LOG, 'w'), indent=1)
def _lap(V, E, n):
    s = np.zeros_like(V); np.add.at(s, E[:, 0], V[E[:, 1]]); np.add.at(s, E[:, 1], V[E[:, 0]])
    deg = np.bincount(E.ravel(), minlength=n)[:, None]; return s/np.maximum(deg, 1)
def op_smooth(c, r, strength=0.5, it=10, taubin=True):
    """Suaviza (Taubin: não encolhe) dentro da esfera."""
    V = _V(); w = _w(V, c, r)[:, None]*strength; E = _edges(); n = len(V)
    for _ in range(it):
        V = V + w*(_lap(V, E, n) - V)
        if taubin: V = V - 1.03*w*(_lap(V, E, n) - V)
    _set(V); _log('smooth', c=c, r=r, strength=strength, it=it, taubin=taubin); return int((w > 0).sum())
def op_mirror(c, r, strength=1.0):
    """Copia a forma do lado oposto (espelho em x=0) para a esfera centrada em c."""
    ob = _ob(); V = _V(); w = _w(V, c, r); idx = np.nonzero(w > 0)[0]
    bvh = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get()); V0 = V.copy()
    for i in idx:
        p = Vector((-V0[i, 0], V0[i, 1], V0[i, 2])); q = bvh.find_nearest(p)[0]
        if q is None: continue
        V[i] = V0[i] + w[i]*strength*(np.array((-q.x, q.y, q.z)) - V0[i])
    _set(V); _log('mirror', c=c, r=r, strength=strength); return len(idx)
def op_restore(c, r, ref_blend, strength=1.0):
    """Volta a esfera para a forma de outro blend com a mesma topologia (ex.: desfazer retração)."""
    with bpy.data.libraries.load(ref_blend) as (src, dst): dst.meshes = ['3DModel'] if '3DModel' in src.meshes else [src.meshes[0]]
    mr = dst.meshes[0]; R = np.empty(len(mr.vertices)*3); mr.vertices.foreach_get('co', R); R = R.reshape(-1, 3); bpy.data.meshes.remove(mr)
    V = _V(); assert len(R) == len(V); w = _w(R, c, r)[:, None]*strength
    _set(V + w*(R - V)); _log('restore', c=c, r=r, ref=ref_blend, strength=strength); return int((w > 0).sum())
def _nfilt(N, ndir, ndot):
    if ndir is None: return 1.0
    d = np.array(ndir, float); d /= np.linalg.norm(d); return np.clip(((N @ d) - ndot)/(1 - ndot), 0, 1)
def op_inflate(c, r, mm, ndir=None, ndot=0.3):
    """Empurra ao longo da normal (mm > 0 para fora). ndir: só vértices com normal apontando para ndir
    (evita atingir dobras/superfícies de trás)."""
    me = _ob().data; V = _V(); N = np.empty(len(V)*3); me.vertices.foreach_get('normal', N); N = N.reshape(-1, 3)
    w = _w(V, c, r)*_nfilt(N, ndir, ndot)
    _set(V + w[:, None]*N*mm/1000); _log('inflate', c=c, r=r, mm=mm, ndir=ndir); return int((w > 0).sum())
def op_diff(c, r, ref_blend):
    """Deslocamento (mm) desta malha em relação ao ref dentro da esfera: mediana, máx, média com sinal na normal."""
    with bpy.data.libraries.load(ref_blend) as (src, dst): dst.meshes = [src.meshes[0]]
    mr = dst.meshes[0]; R = np.empty(len(mr.vertices)*3); mr.vertices.foreach_get('co', R); R = R.reshape(-1, 3); bpy.data.meshes.remove(mr)
    me = _ob().data; V = _V(); N = np.empty(len(V)*3); me.vertices.foreach_get('normal', N); N = N.reshape(-1, 3)
    m = _w(R, c, r) > 0; D = (V - R)[m]; s = (D*N[m]).sum(1)*1000
    return dict(n=int(m.sum()), med=float(np.median(np.linalg.norm(D, axis=1))*1000), max=float(np.linalg.norm(D, axis=1).max()*1000), normal_mean=float(s.mean()), normal_min=float(s.min()))
def op_fill(c, r, strength=1.0, dry=False, ring=(0.65, 1.0)):
    """Pincel Fill: ajusta uma superfície quadrática ao anel da esfera (no referencial da normal média) e sobe os
    pontos internos que estão ABAIXO dela (concavidade) até ela. dry=True só mede (profundidade máx./média, mm)."""
    me = _ob().data; V = _V(); N = np.empty(len(V)*3); me.vertices.foreach_get('normal', N); N = N.reshape(-1, 3)
    C = np.array(c)/1000; d = np.linalg.norm(V - C, axis=1)/(r/1000); m = d < 1
    n = N[m].mean(0); n /= np.linalg.norm(n); t1 = np.cross(n, [0, 0, 1.0]); t1 = t1 if np.linalg.norm(t1) > 0.1 else np.cross(n, [1.0, 0, 0]); t1 /= np.linalg.norm(t1); t2 = np.cross(n, t1)
    P = V - C; u, v, h = P @ t1, P @ t2, P @ n
    A = lambda u, v: np.stack([np.ones_like(u), u, v, u*u, u*v, v*v], 1)
    rg = m & (d > ring[0]); coef = np.linalg.lstsq(A(u[rg], v[rg]), h[rg], rcond=None)[0]
    gap = A(u, v) @ coef - h; gap[~m] = 0; inner = m & (d < ring[0]) & (gap > 0)
    rep = dict(n=int(m.sum()), ring=int(rg.sum()), depth_max=float(gap[inner].max()*1000) if inner.any() else 0.0, depth_mean=float(gap[inner].mean()*1000) if inner.any() else 0.0)
    if not dry:
        w = _w(V, c, r)*strength; up = np.where(m & (gap > 0), gap, 0)*w
        _set(V + up[:, None]*n); _log('fill', c=c, r=r, strength=strength)
    return rep
def op_symavg(c, r, strength=1.0, zmin=-9, zmax=9):
    """Simetria por média: cada vértice vai para a média entre ele e o espelho da superfície oposta (x -> -x).
    Remove elevações de um lado só sem escolher um lado 'certo'. Limites z em metros."""
    ob = _ob(); V = _V(); w = _w(V, c, r)*((V[:, 2] > zmin) & (V[:, 2] < zmax))
    bvh = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get()); V0 = V.copy()
    for i in np.nonzero(w > 0)[0]:
        q = bvh.find_nearest(Vector((-V0[i, 0], V0[i, 1], V0[i, 2])))[0]
        if q is None: continue
        V[i] = V0[i] + w[i]*strength*(0.5*(V0[i] + np.array((-q.x, q.y, q.z))) - V0[i])
    _set(V); _log('symavg', c=c, r=r, strength=strength, zmin=zmin, zmax=zmax); return int((w > 0).sum())
def op_smooth_mask(mask, strength=0.6, it=20, taubin=False, feather=6):
    """Suavização com máscara por vértice (bool), borda esfumada por difusão no grafo. taubin=False encolhe
    relevos (bom para cabelo 'preso')."""
    V = _V(); E = _edges(); n = len(V); w = mask.astype(float)
    for _ in range(feather): w = 0.5*w + 0.5*_lap(w[:, None], E, n)[:, 0]
    w = w[:, None]*strength
    for _ in range(it):
        V = V + w*(_lap(V, E, n) - V)
        if taubin: V = V - 1.03*w*(_lap(V, E, n) - V)
    _set(V); _log('smooth_mask', n=int(mask.sum()), strength=strength, it=it, taubin=taubin); return int(mask.sum())
def vert_lum():
    """Luminância da textura ORIGINAL por vértice (export/toon06/base_vdata.npz) mapeada por proximidade."""
    from mathutils.kdtree import KDTree
    vd = np.load('export/toon06/base_vdata.npz'); Vb, lum = vd['V'], vd['lum']; kd = KDTree(len(Vb))
    for i, p in enumerate(Vb): kd.insert(p, i)
    kd.balance(); return np.array([lum[kd.find(p)[1]] for p in _V()])
def op_subdivide(c=None, r=None, cuts=1):
    """Subdivide (arestas inteiras dentro da esfera, ou a malha toda se c=None), com UV interpolado."""
    import bmesh
    me = _ob().data; bm = bmesh.new(); bm.from_mesh(me)
    if c is None: es = bm.edges[:]
    else:
        C = Vector(np.array(c)/1000); es = [e for e in bm.edges if all((v.co - C).length < r/1000 for v in e.verts)]
    bmesh.ops.subdivide_edges(bm, edges=es, cuts=cuts, use_grid_fill=True, use_only_quads=False)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bm.to_mesh(me); bm.free(); me.update(); _log('subdivide', c=c, r=r, cuts=cuts); return len(me.vertices)
def op_crease(p0, p1, sigma, depth, r_end, ndir=None, ndot=0.3, fixed_dir=None):
    """Pincel Crease: sulco ao longo do segmento p0->p1 (mm). Perfil gaussiano (sigma mm) pela distância ao segmento
    medida só em x (faca vertical no plano x = x do segmento), profundidade 'depth' mm para dentro da normal,
    decaimento nas pontas (r_end mm além do segmento)."""
    me = _ob().data; V = _V(); N = np.empty(len(V)*3); me.vertices.foreach_get('normal', N); N = N.reshape(-1, 3)
    a, b = np.array(p0)/1000, np.array(p1)/1000; ab = b - a; t = np.clip(((V - a) @ ab)/(ab @ ab), 0, 1)
    Q = a + t[:, None]*ab; dx = np.abs(V[:, 0] - Q[:, 0]); dq = np.linalg.norm((V - Q)[:, 1:], axis=1)
    # só a superfície próxima do segmento (em y/z) e sem passar das pontas
    tr = ((V - a) @ ab)/(ab @ ab); over = np.maximum(np.maximum(-tr, tr - 1)*np.linalg.norm(ab), 0)
    w = np.exp(-(dx/(sigma/1000))**2) * np.exp(-(dq/0.004)**2) * np.clip(1 - over/(r_end/1000), 0, 1) * _nfilt(N, ndir, ndot)
    D = N if fixed_dir is None else np.tile(np.array(fixed_dir, float)/np.linalg.norm(fixed_dir), (len(V), 1))
    _set(V - w[:, None]*D*depth/1000); _log('crease', p0=p0, p1=p1, sigma=sigma, depth=depth, fixed_dir=fixed_dir); return int((w > 0.1).sum())
def replay(recipe_json, base_blend, out_blend, upto=None):
    """Reaplica uma receita curada (lista de {op, args, kwargs, mask?}) sobre base_blend e salva out_blend.
    mask: 'hair' | 'beard' (seleções por vértice calculadas na hora). Retorna o log de cada passo."""
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(base_blend)); R = json.load(open(recipe_json)); rep = []
    for k, st in enumerate(R[:upto]):
        f = globals()['op_' + st['op']]; kw = dict(st.get('kwargs', {}))
        if st.get('mask'): kw_mask = sel_mask(st['mask']); r = f(kw_mask, *st.get('args', []), **kw)
        else: r = f(*st.get('args', []), **kw)
        rep.append((k, st['op'], st.get('note', ''), r))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out_blend)); return rep
def sel_mask(name):
    V = _V()
    if name == 'hair':
        lum = vert_lum()
        return (lum < 0.35) & ~((V[:, 2] < 0.125) & (V[:, 1] < 0.07)) & ~((V[:, 1] < 0.02) & (V[:, 2] < 0.22)) & (V[:, 2] > 0.03)
    if name == 'beard':
        m = (V[:, 2] < 0.118) & (V[:, 2] > 0.03) & (V[:, 1] < 0.045)
        return m & (np.linalg.norm((V - np.array([0.002, -0.02, 0.1]))*[1, 1, 1.3], axis=1) > 0.021)
    raise KeyError(name)
def op_subsurf(levels=1):
    o = _ob(); bpy.context.view_layer.objects.active = o; o.select_set(True)
    m = o.modifiers.new('CC', 'SUBSURF'); m.subdivision_type = 'CATMULL_CLARK'; m.levels = levels; m.uv_smooth = 'PRESERVE_BOUNDARIES'
    with bpy.context.temp_override(object=o, active_object=o): bpy.ops.object.modifier_apply(modifier='CC')
    for p in o.data.polygons: p.use_smooth = True
    return len(o.data.vertices)
def op_bandpass(mask, it_detail=80, it_low=120, strength=0.6, feather=8):
    """Remove relevos (calombos/sulcos) SEM encolher: d = suavizado - original; o encolhimento é a parte de baixa
    frequência de d (d suavizado no grafo); aplica d - d_baixa. Mantém a silhueta e deixa a superfície uniforme."""
    V = _V(); E = _edges(); n = len(V); w = mask.astype(float)
    for _ in range(feather): w = 0.5*w + 0.5*_lap(w[:, None], E, n)[:, 0]
    S = V.copy(); ws = w[:, None]*strength
    for _ in range(it_detail): S = S + ws*(_lap(S, E, n) - S)
    d = S - V; dl = d.copy()
    for _ in range(it_low): dl = 0.5*dl + 0.5*_lap(dl, E, n)
    _set(V + d - dl*w[:, None]); _log('bandpass', n=int(mask.sum()), it_detail=it_detail, it_low=it_low)
    return dict(n=int(mask.sum()), d_med=float(np.median(np.linalg.norm(d[mask], axis=1))*1000), net_med=float(np.median(np.linalg.norm((d - dl)[mask], axis=1))*1000))
def op_grab(c, r, delta_mm):
    """Pincel Grab/Move: translada a esfera por delta (mm) com decaimento suave."""
    V = _V(); w = _w(V, c, r); _set(V + w[:, None]*np.array(delta_mm)/1000); _log('grab', c=c, r=r, delta=delta_mm); return int((w > 0).sum())
def vert_tex_lum():
    """Luminância (0-1) da textura ATUAL por vértice, amostrada pelo UV (média dos loops). Serve para achar
    narinas, olhos e boca na posição em que a textura realmente os desenha."""
    o = _ob(); me = o.data; img = None
    for nd in me.materials[0].node_tree.nodes:
        if nd.type == 'TEX_IMAGE' and nd.image: img = nd.image; break
    W, H = img.size; px = np.empty(W*H*4, np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)
    lum_img = px[..., :3] @ np.array([0.299, 0.587, 0.114], np.float32)
    uv = np.empty(len(me.loops)*2); me.uv_layers.active.data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
    lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
    ix = np.clip((uv[:, 0]*W).astype(int), 0, W-1); iy = np.clip((uv[:, 1]*H).astype(int), 0, H-1)
    s = np.bincount(lv, lum_img[iy, ix], minlength=len(me.vertices)); c = np.bincount(lv, minlength=len(me.vertices))
    return s/np.maximum(c, 1)
def _wsmooth(w, it=4):
    E = _edges(); n = len(w)
    for _ in range(it): w = 0.5*w + 0.5*_lap(w[:, None], E, n)[:, 0]
    return w
def op_grab_n(c, r, delta_mm, ndir, ndot=0.3, wit=4):
    """Grab só na superfície cuja normal aponta para ndir; peso esfumado no grafo (sem alternância/dentes)."""
    me = _ob().data; V = _V(); N = np.empty(len(V)*3); me.vertices.foreach_get('normal', N); N = N.reshape(-1, 3)
    w = _wsmooth(_w(V, c, r)*_nfilt(N, ndir, ndot), wit)
    _set(V + w[:, None]*np.array(delta_mm)/1000); _log('grab_n', c=c, r=r, delta=delta_mm, ndir=ndir); return int((w > 0.05).sum())
def op_crease_n(p0, p1, sigma, depth, fixed_dir, ndir, ndot=0.3, wit=4):
    """Sulco em direção fixa, só na superfície voltada para ndir, peso esfumado."""
    me = _ob().data; V = _V(); N = np.empty(len(V)*3); me.vertices.foreach_get('normal', N); N = N.reshape(-1, 3)
    a, b = np.array(p0)/1000, np.array(p1)/1000; ab = b - a; t = np.clip(((V - a) @ ab)/(ab @ ab), 0, 1)
    Q = a + t[:, None]*ab; dx = np.abs(V[:, 0] - Q[:, 0]); dq = np.linalg.norm((V - Q)[:, 1:], axis=1)
    w = np.exp(-(dx/(sigma/1000))**2)*np.exp(-(dq/0.003)**2)*_nfilt(N, ndir, ndot); w = _wsmooth(w, wit)
    d = np.array(fixed_dir, float); d /= np.linalg.norm(d)
    _set(V - w[:, None]*d*depth/1000); _log('crease_n', p0=p0, p1=p1, sigma=sigma, depth=depth); return int((w > 0.1).sum())
