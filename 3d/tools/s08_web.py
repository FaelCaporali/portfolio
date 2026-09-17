"""blender -b --python tools/s08_web.py -- <in.blend> <out.blend> <out.glb> [ratio=0.10]
Versão leve do S08 para a página: decima a cabeça protegendo olhos e boca, RECALCULA o piscar e as expressões pelos mesmos
campos musculares (são funções da posição: não há transferência nem perda), prepara materiais para glTF e exporta o glb."""
import bpy, sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
a = sys.argv[sys.argv.index("--")+1:]; src, outb, outg = a[0], os.path.abspath(a[1]), os.path.abspath(a[2]); ratio = float(a[3]) if len(a) > 3 else 0.10
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(src))
import importlib
E = importlib.import_module(os.environ.get('S_EYE', 's08_eye')); import s08_expr as X
ob = bpy.data.objects['Busto']; me = ob.data; bpy.context.view_layer.objects.active = ob
ob.shape_key_clear(); n0 = len(me.vertices)
V = np.array([v.co[:] for v in me.vertices]); L = X.landmarks(); w = np.ones(n0)
def protect(c, r0, r1, wmin):
    d = np.linalg.norm(V - c, axis=1); t = np.clip((d - r0)/(r1 - r0), 0, 1); return wmin + (1 - wmin)*t*t*(3 - 2*t)
for s in 'DE':
    c = np.array(E.CEN[s]); c[1] -= E.R_EYE; w = np.minimum(w, protect(c, 0.020, 0.034, 0.0))
w = np.minimum(w, protect((L['cornerR'] + L['cornerL'])/2, 0.030, 0.050, 0.25)); w = np.minimum(w, protect(L['glabella'], 0.030, 0.055, 0.35))
# costuras da textura: vértice com mais de uma coordenada UV não pode ser colapsado (senão a textura rasga sobre a barba)
uvd = me.uv_layers[0].data; lv = np.array([l.vertex_index for l in me.loops]); uv = np.array([d.uv[:] for d in uvd])
order = np.argsort(lv, kind='stable'); lvs = lv[order]; uvs = uv[order]; first = np.r_[True, lvs[1:] != lvs[:-1]]; start = np.maximum.accumulate(np.where(first, np.arange(len(lvs)), 0))
seam = np.zeros(n0, bool); diff = np.abs(uvs - uvs[start]).max(1) > 1e-5; seam[lvs[diff]] = True
ring = seam.copy(); ed = np.array([e.vertices[:] for e in me.edges]); hit = seam[ed[:, 0]] | seam[ed[:, 1]]; ring[ed[hit].ravel()] = True
w[seam] = 0.0; w = np.maximum(w, 0.0); w[~seam] = np.maximum(w[~seam], 0.0); print("WEB costuras protegidas: %d vertices (+anel: %d)" % (seam.sum(), ring.sum()))
g = ob.vertex_groups.new(name='decimar')
for wi in np.unique(np.round(w, 2)): g.add(np.nonzero(np.round(w, 2) == wi)[0].tolist(), float(wi), 'REPLACE')
m = ob.modifiers.new('dec', 'DECIMATE'); m.ratio = ratio; m.vertex_group = 'decimar'; m.vertex_group_factor = 1.5; m.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='dec'); ob.vertex_groups.remove(ob.vertex_groups['decimar'])
print("WEB decimado: %d -> %d vertices, %d faces" % (n0, len(me.vertices), len(me.polygons)))
for p in me.polygons: p.use_smooth = True
if 'custom_normal' in me.attributes: me.attributes.remove(me.attributes['custom_normal'])
ob.shape_key_add(name='Basis')
for s in 'DE':
    so = bpy.data.objects['Sombra_'+s]; so.shape_key_clear(); E.shell(s, rings=8); E.blink(s); bpy.data.objects['Sombra_'+s].parent = ob
X.build_all()
# --- materiais para glTF: cor base = textura (a página usa material sem luz); sombra com alfa por vértice
def principled(mat, img=None, col=None):
    nt = mat.node_tree; nt.nodes.clear(); b = nt.nodes.new('ShaderNodeBsdfPrincipled'); o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(b.outputs[0], o.inputs['Surface'])
    b.inputs['Roughness'].default_value = 1.0
    if img: t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if col: b.inputs['Base Color'].default_value = col
    return b
for mat in bpy.data.materials:
    if not mat.use_nodes: continue
    img = next((n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'), None)
    if mat.name == 'SombraOlho':
        b = principled(mat, col=(0.016, 0.004, 0.003, 1)); ca = mat.node_tree.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'; mat.node_tree.links.new(ca.outputs['Alpha'], b.inputs['Alpha'])
        try: mat.surface_render_method = 'BLENDED'
        except Exception: mat.blend_method = 'BLEND'
    elif mat.name == 'Conjuntiva':
        b = principled(mat); ca = mat.node_tree.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'cor'; mat.node_tree.links.new(ca.outputs['Color'], b.inputs['Base Color'])
    elif mat.name == 'ParedePalpebra': principled(mat, col=((62/255)**2.2, (28/255)**2.2, (25/255)**2.2, 1))
    elif mat.name == 'ParedePalpebraSup': principled(mat, col=((40/255)**2.2, (18/255)**2.2, (16/255)**2.2, 1))
    elif img: principled(mat, img=img)
for s in 'DE':
    sm = bpy.data.objects['Sombra_'+s].data; src_ = sm.color_attributes['sombra']; al = np.array([d.color[0] for d in src_.data])
    c = sm.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for i, d in enumerate(c.data): d.color = (1, 1, 1, float(al[i]))
    sm.color_attributes.remove(sm.color_attributes['sombra'])                       # no glb fica um único conjunto: COLOR_0 = (1, 1, 1, alfa)
    c = sm.color_attributes['Col']; sm.color_attributes.active_color = c; sm.color_attributes.render_color_index = 0
for o in bpy.data.objects:
    if o.type == 'MESH' and o.data.shape_keys:
        for k in o.data.shape_keys.key_blocks: k.value = 0
bpy.ops.wm.save_as_mainfile(filepath=outb)
bpy.ops.export_scene.gltf(filepath=outg, export_format='GLB', export_morph=True, export_morph_normal=False, export_image_format='JPEG', export_jpeg_quality=88,
                          export_apply=False, export_yup=True, export_animations=False, export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=False)
print("WEB glb: %.1f MB" % (os.path.getsize(outg)/1e6))
