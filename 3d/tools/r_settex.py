"""blender -b --python tools/r_settex.py -- <in.blend> <tex.jpg> <out.blend>
Troca a imagem do material do 'Busto' (empacotada) e salva."""
import bpy, sys, os
a = sys.argv[sys.argv.index("--")+1:]
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(a[0])); bu = bpy.data.objects['Busto']
img = bpy.data.images.load(os.path.abspath(a[1])); img.pack()
if not bu.data.materials:
    m = bpy.data.materials.new('Pele'); m.use_nodes = True; t = m.node_tree.nodes.new('ShaderNodeTexImage')
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.8
    bu.data.materials.append(m)
tex = next(n for n in bu.data.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE'); tex.image = img
if len(a) > 3:                                   # olhos: copia os materiais de outro blend com os mesmos nomes
    with bpy.data.libraries.load(os.path.abspath(a[3]), link=False) as (s_, d_): d_.objects = [n for n in s_.objects if n.startswith('Olho')]
    for src in d_.objects:
        mat = src.data.materials[0] if src.data.materials else None; base = src.name.split('.')[0]
        dst = bpy.data.objects.get(base)
        if dst and dst is not src and mat: dst.data.materials.clear(); dst.data.materials.append(mat)
        bpy.data.objects.remove(src)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a[2])); print("SETTEX", a[2])
