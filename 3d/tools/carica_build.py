"""Caricatura paramétrica (roda dentro do Blender interativo ou em batch):
  CFG = {'k': 1.6, 'out': 'export/toon05/busto-toon05', 'targets': {...}, 'expr': {...}, 'bake': True}
  exec(open('tools/carica_build.py').read())
Método (Brennan 1985): caricatura = média + k·(ajuste − média). O ajuste é o MPFB fitado (blend/mpfb-02), sem nenhuma
distorção do scan (nariz, contorno, olho, sobrancelha vêm do modelo limpo). Do scan (DD07/DD08) só entram: a textura
(bake por proximidade para a UV do MPFB) e o volume de cabelo/barba (deslocamento por ponto mais próximo, mascarado
pela escuridão da textura e suavizado). Alinhado ao frame do busto-base por Procrustes nos landmarks."""
import bpy, bmesh, json, os, numpy as np
from mathutils import Vector, Matrix
R = '/home/fael/projects/portfolio/3d'
C = globals().get('CFG', {}); K = C.get('k', 1.6); OUT = os.path.join(R, C.get('out', 'export/toon05/busto-toon05'))
bpy.ops.wm.open_mainfile(filepath=R + '/blend/mpfb-02.blend'); o = bpy.data.objects['Busto']; kb = o.data.shape_keys.key_blocks
def evalV():
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get(); ev = o.evaluated_get(dg)
    return np.array([v.co[:] for v in ev.data.vertices])
F = evalV(); n = len(F)
# --- alinhamento Procrustes (ajuste k=1 -> frame do busto-base) pelos landmarks, sem oval (barba/cabelo) e sem íris
L = json.load(open(R + '/analise/lm3d_mpfb01.json')); B = json.load(open(R + '/analise/lm3d_base.json'))
oval = {10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109}
ids = [i for i in L['vid'] if i in B and int(i) < 468 and int(i) not in oval]
A = F[[L['vid'][i] for i in ids]]; P = np.array([B[i] for i in ids]); ca, cb = A.mean(0), P.mean(0); A0, P0 = A - ca, P - cb
U, S, Vt = np.linalg.svd(A0.T @ P0); D = np.eye(3); D[2, 2] = np.sign(np.linalg.det(Vt.T @ U.T)); Rm = Vt.T @ D @ U.T
s = (S * np.diag(D)).sum() / (A0 ** 2).sum(); res = np.linalg.norm((s * (A0 @ Rm.T)) - P0, axis=1)
print("CARICA procrustes s=%.3f residuo mediano %.2f cm (%d lm)" % (s, np.median(res) * 100, len(ids)))
M = Matrix.Translation(Vector(cb)) @ (Matrix(Rm.tolist()) * s).to_4x4() @ Matrix.Translation(-Vector(ca)); o.matrix_world = M
W = lambda V: (V - ca) @ (s * Rm).T + cb            # local -> mundo
# --- DD08 (malha registrada + textura das fotos) como fonte de textura e de volume de cabelo/barba
with bpy.data.libraries.load(R + '/export/dd08/busto-dd08.blend') as (src, dst): dst.objects = ['Busto']
dd = dst.objects[0]; dd.name = 'DD08'; bpy.context.scene.collection.objects.link(dd)
sc = bpy.context.scene
def bake(t):                                    # no Blender vivo o bake precisa de contexto de janela/área 3D
    win = bpy.context.window_manager.windows[0] if bpy.context.window_manager.windows else None
    if win:
        area = next((a for a in win.screen.areas if a.type == 'VIEW_3D'), None)
        if area:
            with bpy.context.temp_override(window=win, area=area, region=next(r for r in area.regions if r.type == 'WINDOW')):
                return bpy.ops.object.bake(type=t)
    return bpy.ops.object.bake(type=t)
# --- bake da textura DD08 para a UV limpa do MPFB (k=1, alinhado)
S_ = 4096; img = bpy.data.images.new("CaricaTex", S_, S_, alpha=True); img.filepath_raw = OUT + "_tex_base.png"; img.file_format = 'PNG'
px = np.zeros((S_ * S_, 4), np.float32); px[:, 0] = 1; px[:, 2] = 1; img.pixels.foreach_set(px.ravel())
mat = bpy.data.materials.new("Pele"); mat.use_nodes = True; nt = mat.node_tree
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; nt.nodes.active = tex
bsdf = next(nd for nd in nt.nodes if nd.type == 'BSDF_PRINCIPLED'); nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.85; o.data.materials.clear(); o.data.materials.append(mat)
if C.get('bake', True):
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.device = 'GPU'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'CUDA'; prefs.get_devices()
        for dv in prefs.devices: dv.use = True
    except Exception as e: print("GPU pref", e)
    bk = sc.render.bake; bk.use_selected_to_active = True; bk.cage_extrusion = 0.012; bk.max_ray_distance = 0.05
    bk.use_pass_direct = False; bk.use_pass_indirect = False; bk.use_pass_color = True; bk.margin = 16
    bpy.ops.object.select_all(action='DESELECT'); dd.select_set(True); o.select_set(True); bpy.context.view_layer.objects.active = o
    bake('DIFFUSE'); img.save(); print("CARICA bake ok")
    isl = bpy.data.images.new("Islands", S_, S_); isl.filepath_raw = OUT + "_islands.png"; isl.file_format = 'PNG'
    me = bpy.data.materials.new("Emit"); me.use_nodes = True; ntm = me.node_tree
    for nd in list(ntm.nodes): ntm.nodes.remove(nd)
    em = ntm.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (1, 1, 1, 1); o_ = ntm.nodes.new('ShaderNodeOutputMaterial'); ntm.links.new(em.outputs[0], o_.inputs[0])
    ti = ntm.nodes.new('ShaderNodeTexImage'); ti.image = isl; ntm.nodes.active = ti
    o.data.materials[0] = me; bk.use_selected_to_active = False; bk.margin = 0
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bake('EMIT'); isl.save(); o.data.materials[0] = mat
    img2 = bpy.data.images.new("BakeFar", S_, S_, alpha=True); img2.filepath_raw = OUT + "_tex_far.png"; img2.file_format = 'PNG'
    img2.pixels.foreach_set(np.zeros(S_ * S_ * 4, np.float32)); tex.image = img2; bk.use_selected_to_active = True; bk.margin = 16; bk.cage_extrusion = 0.03; bk.max_ray_distance = 0.12
    bpy.ops.object.select_all(action='DESELECT'); dd.select_set(True); o.select_set(True); bpy.context.view_layer.objects.active = o
    bake('DIFFUSE'); img2.save(); tex.image = img; print("CARICA bake longo ok")
else:
    img = bpy.data.images.load(os.path.join(R, C.get('tex', OUT + "_tex_base.png"))); tex.image = img
# --- escuridão por vértice (cabelo/barba) a partir da textura na UV do MPFB
mimg = bpy.data.images.load(os.path.join(R, C['mask_tex'])) if C.get('mask_tex') else img      # máscara sempre da textura crua do bake
pxa = np.zeros(S_ * S_ * 4, np.float32); mimg.pixels.foreach_get(pxa); pxa = pxa.reshape(S_, S_, 4)
uvl = o.data.uv_layers.active.data; lum = np.zeros(n); cnt = np.zeros(n)
for p_ in o.data.polygons:
    for li in p_.loop_indices:
        u, v = uvl[li].uv; ix, iy = int(u * S_) % S_, int(v * S_) % S_; c = pxa[iy, ix]
        if c[3] > 0.5: lum[o.data.loops[li].vertex_index] += 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; cnt[o.data.loops[li].vertex_index] += 1
lum = np.where(cnt > 0, lum / np.maximum(cnt, 1), 0.5)
nb = [[] for _ in range(n)]
for e in o.data.edges: x, y = e.vertices; nb[x].append(y); nb[y].append(x)
def smooth(d, it, a=0.5):
    for _ in range(it): d = (1 - a) * d + a * np.array([d[k].mean(0) if k else d[i] for i, k in enumerate(nb)])
    return d
Fw = W(F)
eyes = np.array([B[i] for i in ('468', '473')]) if '468' in B else np.array([B['33'], B['263']])
deye = np.min(np.linalg.norm(Fw[:, None, :] - eyes[None], axis=2), axis=1)
mask = (lum < C.get('dark', 0.22)).astype(float); mask[deye < 0.035] = 0; mask[Fw[:, 2] < C.get('zmin', 0.07)] = 0   # ombros/pescoço fora           # sobrancelha/olho não recebem volume
mask = smooth(mask, 4); mask = np.clip(mask * 1.3, 0, 1)
# --- deslocamento para a superfície do DD08 (cabelo/barba do scan), só onde a máscara vale
dwm = dd.matrix_world; dwi = dwm.inverted(); d = np.zeros((n, 3))
for i in range(n):
    if mask[i] < 0.02: continue
    hit, loc, nrm, _ = dd.closest_point_on_mesh(dwi @ Vector(Fw[i]), distance=C.get('dmax', 0.04))
    if hit: d[i] = np.array((dwm @ loc)[:]) - Fw[i]
d = smooth(d * mask[:, None], C.get('dsmooth', 8)) * C.get('vol', 1.0)
print("CARICA volume scan: %d vertices, desloc mediano %.1f mm, max %.1f mm" % ((mask > 0.5).sum(), np.median(np.linalg.norm(d[mask > 0.5], axis=1)) * 1000, np.linalg.norm(d, axis=1).max() * 1000))
# --- exagero paramétrico + targets de estilo + expressão
for k_ in kb:
    if k_.value: k_.slider_max = 4.0; k_.value = min(k_.value * K, C.get('cap', 2.5))
for name, val in C.get('targets', {}).items():
    if name in kb: kb[name].slider_max = 4.0; kb[name].value = val
    else: print("CARICA target ausente", name)
if C.get('expr'):
    from bl_ext.blender_org.mpfb.services.targetservice import TargetService
    base = os.path.dirname(__import__('bl_ext.blender_org.mpfb', fromlist=['x']).__file__) + '/data/targets/expression/units/caucasian/'
    for name, val in C['expr'].items():
        TargetService.load_target(o, base + name + '.target.gz', weight=val, name='expr-' + name)
V = evalV(); Vw = W(V) + d                       # posição final no frame do busto-base
# --- coque: esfera encostada no fundo da cabeça (o DD07 não tem o coque; posição vem da própria malha)
if C.get('bun', True):
    zc = (irises_z := (B['468'][2] + B['473'][2]) / 2 if '468' in B else 0.17)
    sel = (Vw[:, 2] > zc - 0.01) & (Vw[:, 2] < zc + 0.05); ymax = Vw[sel, 1].max(); br = C.get('bun_r', 0.036)
    bc = np.array([0.0, ymax + br * 0.55, zc + C.get('bun_dz', 0.02)])
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=br, location=Vector(bc)); bun = bpy.context.view_layer.objects.active; bun.name = 'Coque'
    bun.scale = (1.0, 0.85, 0.9); bpy.ops.object.shade_smooth()
    mb = bpy.data.materials.new('CabeloMat'); mb.use_nodes = True; bb = next(nd for nd in mb.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED'); bb.inputs['Base Color'].default_value = (0.055, 0.035, 0.028, 1); bb.inputs['Roughness'].default_value = 0.8
    bun.data.materials.append(mb); print("CARICA coque centro %s" % bc.round(3))
# --- globos oculares: centro = média dos vértices da cavidade (raio 1,7 cm da íris do scan) recuada pela normal
irises = np.array([B[i] for i in ('468', '473')]) if '468' in B else np.array([B['33'], B['263']])
eyeobjs = []
for j, ir in enumerate(irises):
    sel = np.linalg.norm(Fw - ir, axis=1) < 0.017; cen = Vw[sel].mean(0); N_ = np.array([o.data.vertices[i].normal[:] for i in np.nonzero(sel)[0]]) @ (s * Rm).T
    nm = N_.mean(0); nm /= np.linalg.norm(nm); rad = C.get('eye_r', 0.0125); cen = cen - nm * C.get('eye_back', 0.006)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=rad, location=Vector(cen))
    ey = bpy.context.view_layer.objects.active; ey.name = 'Olho.%s' % ('L' if j == 0 else 'R'); eyeobjs.append(ey)   # olha para a frente (-Y): sem rotação, os dois olhos convergem no infinito
    bpy.ops.object.shade_smooth()
    print("CARICA olho %d centro %s n %s" % (j, cen.round(4), nm.round(2)))
    m = bpy.data.materials.new('OlhoMat'); m.use_nodes = True; ntm = m.node_tree     # esclera / íris / pupila por coordenada local (−Y = frente)
    for n_ in list(ntm.nodes): ntm.nodes.remove(n_)
    tc = ntm.nodes.new('ShaderNodeTexCoord'); sep = ntm.nodes.new('ShaderNodeSeparateXYZ'); ntm.links.new(tc.outputs['Object'], sep.inputs[0])
    div = ntm.nodes.new('ShaderNodeMath'); div.operation = 'DIVIDE'; div.inputs[1].default_value = rad; ntm.links.new(sep.outputs['Y'], div.inputs[0])
    add = ntm.nodes.new('ShaderNodeMath'); add.operation = 'ADD'; add.inputs[1].default_value = 1.0; ntm.links.new(div.outputs[0], add.inputs[0])
    ramp = ntm.nodes.new('ShaderNodeValToRGB'); cr = ramp.color_ramp; cr.interpolation = 'CONSTANT'
    cr.elements[0].position = 0.0; cr.elements[0].color = (0.02, 0.015, 0.01, 1); cr.elements[1].position = C.get('pupil', 0.07); cr.elements[1].color = C.get('iris', (0.22, 0.11, 0.045, 1))
    e2 = cr.elements.new(C.get('iris_edge', 0.30)); e2.color = (0.93, 0.92, 0.90, 1); ntm.links.new(add.outputs[0], ramp.inputs[0])
    em = ntm.nodes.new('ShaderNodeEmission'); ntm.links.new(ramp.outputs['Color'], em.inputs['Color']); om = ntm.nodes.new('ShaderNodeOutputMaterial'); ntm.links.new(em.outputs[0], om.inputs[0])
    ey.data.materials.clear(); ey.data.materials.append(m)
# --- congela: malha simples no frame do busto-base, corte z=0.02 + tampa, suavização leve
o.shape_key_clear(); o.data.vertices.foreach_set('co', Vw.ravel()); o.matrix_world = Matrix.Identity(4); o.data.update()
bm = bmesh.new(); bm.from_mesh(o.data)
r_ = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0.02), plane_no=(0, 0, -1), clear_outer=True)
ce = [e for e in r_['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
if ce: bmesh.ops.holes_fill(bm, edges=ce, sides=0)
bm.to_mesh(o.data); bm.free()
bpy.data.objects.remove(dd); bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o; bpy.ops.object.shade_smooth()
for m_ in list(o.modifiers): o.modifiers.remove(m_)
img.pack()
bpy.ops.wm.save_as_mainfile(filepath=OUT + "_geo.blend"); print("CARICA salvo", OUT + "_geo.blend", len(o.data.vertices))
