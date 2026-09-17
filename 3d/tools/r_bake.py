"""blender -b --python tools/r_bake.py -- <in.blend> <target.blend> <out_prefix> [size=4096]
Transfere a cor do alvo (S07, textura do KIRI) para a UV limpa do 'Busto' e dos olhos (Cycles, selected-to-active,
cage 1 cm / raio 6 cm; segundo bake de alcance 15 cm para completar), preenche furos (inpaint na venv) e liga a
textura num material 'Pele'. Salva <out>.blend e <out>_tex.png."""
import bpy, sys, os, subprocess, numpy as np
a = sys.argv[sys.argv.index("--")+1:]; src, tgt_b, out = a[:3]; S = int(a[3]) if len(a) > 3 else 4096
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(src))
with bpy.data.libraries.load(os.path.abspath(tgt_b), link=False) as (s_, d_): d_.objects = ['Busto']
al = d_.objects[0]; al.name = 'AlvoTex'; bpy.context.scene.collection.objects.link(al)
for o in bpy.data.objects:
    if o.name == 'Alvo': bpy.data.objects.remove(o)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 8; sc.cycles.device = 'GPU'
try:
    pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'OPTIX'; pr.get_devices()
    for dv in pr.devices: dv.use = True
except Exception as e: print("GPU", e)
bk = sc.render.bake; bk.use_selected_to_active = True; bk.use_pass_direct = False; bk.use_pass_indirect = False; bk.use_pass_color = True; bk.margin = 16
def bake_into(obj, name, size, cage, ray):
    img = bpy.data.images.new(name, size, size, alpha=True); img.pixels.foreach_set(np.zeros(size*size*4, np.float32))
    img.filepath_raw = os.path.abspath(out + "_" + name + ".png"); img.file_format = 'PNG'
    mat = bpy.data.materials.new("M" + name); mat.use_nodes = True; nt = mat.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; nt.nodes.active = tex
    bsdf = next(nd for nd in nt.nodes if nd.type == 'BSDF_PRINCIPLED'); nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.8
    obj.data.materials.clear(); obj.data.materials.append(mat)
    bk.cage_extrusion = cage; bk.max_ray_distance = ray
    bpy.ops.object.select_all(action='DESELECT'); al.select_set(True); obj.select_set(True); bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='DIFFUSE'); img.save(); return img, mat, tex
bu = bpy.data.objects['Busto']
img, mat, tex = bake_into(bu, 'tex_raw', S, 0.01, 0.06)
img2, _, _ = bake_into(bu, 'tex_far', S, 0.02, 0.15)
bu.data.materials.clear(); bu.data.materials.append(mat)
# ilhas UV (onde a textura existe)
isl = bpy.data.images.new('isl', S, S); isl.filepath_raw = os.path.abspath(out + "_islands.png"); isl.file_format = 'PNG'
me_ = bpy.data.materials.new("Emit"); me_.use_nodes = True; nt = me_.node_tree
for nd in list(nt.nodes): nt.nodes.remove(nd)
em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (1, 1, 1, 1); oo = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs[0], oo.inputs[0])
ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = isl; nt.nodes.active = ti
bu.data.materials[0] = me_; bk.use_selected_to_active = False; bk.margin = 0
bpy.ops.object.select_all(action='DESELECT'); bu.select_set(True); bpy.context.view_layer.objects.active = bu
bpy.ops.object.bake(type='EMIT'); isl.save(); bu.data.materials[0] = mat; bk.use_selected_to_active = True; bk.margin = 16
eimgs = {}
for side in ('E', 'D'):
    eo = bpy.data.objects.get('Olho' + side)
    if eo: eimgs[side] = bake_into(eo, 'olho' + side, 1024, 0.01, 0.05)
r = subprocess.run(['/data/venv-face/bin/python', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex_inpaint.py'), out + "_tex_raw.png", out + "_islands.png", out + "_tex.jpg", out + "_tex_far.png"], capture_output=True, text=True); print(r.stdout[-300:], r.stderr[-300:])
tex.image = bpy.data.images.load(os.path.abspath(out + "_tex.jpg")); tex.image.pack()
for side, (im, _, _) in eimgs.items(): im.pack()
bpy.data.objects.remove(al)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out + ".blend")); print("R_BAKE salvo", out)
