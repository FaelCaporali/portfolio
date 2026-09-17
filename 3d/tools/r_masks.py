"""blender -b --python tools/r_masks.py -- <baked.blend> <cls.blend> <out_prefix> [size=2048]
Bake na UV do 'Busto': classes do alvo (cor por vértice do r_classify: pele/cabelo/barba) e posição 3D (para as
áreas que o scan não cobre: nuca, topo, base). Salva <out>_cls.png e <out>_pos.npy."""
import bpy, sys, os, numpy as np
a = sys.argv[sys.argv.index("--")+1:]; src, clsb, out = a[:3]; S = int(a[3]) if len(a) > 3 else 2048
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(src)); bu = bpy.data.objects['Busto']
with bpy.data.libraries.load(os.path.abspath(clsb), link=False) as (s_, d_): d_.objects = ['Busto']
al = d_.objects[0]; al.name = 'Cls'; bpy.context.scene.collection.objects.link(al)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 1; sc.cycles.device = 'GPU'
try:
    pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'OPTIX'; pr.get_devices()
    for dv in pr.devices: dv.use = True
except Exception as e: print("GPU", e)
def emit_mat(kind):
    m = bpy.data.materials.new(kind); m.use_nodes = True; nt = m.node_tree
    for nd in list(nt.nodes): nt.nodes.remove(nd)
    em = nt.nodes.new('ShaderNodeEmission'); oo = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs[0], oo.inputs[0])
    if kind == 'cls':
        at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'cls'; nt.links.new(at.outputs['Color'], em.inputs[0])
    else:
        g = nt.nodes.new('ShaderNodeNewGeometry'); nt.links.new(g.outputs['Position'], em.inputs[0])
    return m, nt
mc, _ = emit_mat('cls'); al.data.materials.clear(); al.data.materials.append(mc)
mt = bu.data.materials[0]
def target_img(name, float_buf):
    img = bpy.data.images.new(name, S, S, alpha=True, float_buffer=float_buf); img.pixels.foreach_set(np.zeros(S*S*4, np.float32))
    if float_buf: img.colorspace_settings.name = 'Non-Color'
    m = bpy.data.materials.new('T' + name); m.use_nodes = True; ti = m.node_tree.nodes.new('ShaderNodeTexImage'); ti.image = img; m.node_tree.nodes.active = ti
    bu.data.materials[0] = m; return img
bk = sc.render.bake; bk.margin = 8
img = target_img('cls', False)
bk.use_selected_to_active = True; bk.cage_extrusion = 0.01; bk.max_ray_distance = 0.06
bpy.ops.object.select_all(action='DESELECT'); al.select_set(True); bu.select_set(True); bpy.context.view_layer.objects.active = bu
bpy.ops.object.bake(type='EMIT')
px = np.zeros(S*S*4, np.float32); img.pixels.foreach_get(px); np.save(out + "_cls.npy", px.reshape(S, S, 4)[::-1])
mp, _ = emit_mat('pos'); bu.data.materials[0] = mp
imp = target_img('pos', True); bu.data.materials.append(mp); bu.data.materials[0] = mp
# a imagem ativa precisa estar no material do Busto
nt = mp.node_tree; ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = imp; nt.nodes.active = ti
bk.use_selected_to_active = False
bpy.ops.object.select_all(action='DESELECT'); bu.select_set(True)
bpy.ops.object.bake(type='EMIT')
px = np.zeros(S*S*4, np.float32); imp.pixels.foreach_get(px); np.save(out + "_pos.npy", px.reshape(S, S, 4)[::-1])
ml, ntl = emit_mat('cls'); ntl.nodes['Attribute'].attribute_name = 'lid'
iml = target_img('lid', False); nl = ml.node_tree.nodes.new('ShaderNodeTexImage'); nl.image = iml; ml.node_tree.nodes.active = nl; bu.data.materials[0] = ml
bpy.ops.object.select_all(action='DESELECT'); bu.select_set(True); bpy.ops.object.bake(type='EMIT')
px = np.zeros(S*S*4, np.float32); iml.pixels.foreach_get(px); np.save(out + "_lid.npy", px.reshape(S, S, 4)[::-1])
print("R_MASKS salvo", out)
