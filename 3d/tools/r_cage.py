"""blender -b --python tools/r_cage.py -- <scan.blend> <cage.blend> <out.blend> [teste=chave=valor]
O scan (asset visível, aparência aprovada) passa a ser deformado pela malha limpa (gaiola, com os shape keys de
expressão) por Surface Deform. A gaiola fica oculta. Com 'teste', aplica um valor de shape key e salva assim."""
import bpy, sys, os
a = sys.argv[sys.argv.index("--")+1:]; scan_b, cage_b, out = a[:3]; teste = a[3] if len(a) > 3 else None
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(scan_b)); sc = bpy.data.objects['Busto']; sc.name = 'Scan'
with bpy.data.libraries.load(os.path.abspath(cage_b), link=False) as (s_, d_):
    d_.objects = [n for n in s_.objects if n in ('Busto', 'OlhoD', 'OlhoE', 'Cabelo')]
cage = None
for o in d_.objects:
    bpy.context.scene.collection.objects.link(o)
    if o.name.startswith('Busto'): o.name = 'Gaiola'; cage = o
cage.hide_render = True; cage.hide_viewport = False
bpy.context.view_layer.objects.active = sc; sc.select_set(True)
m = sc.modifiers.new('Gaiola', 'SURFACE_DEFORM'); m.target = cage; m.falloff = 4.0
r = bpy.ops.object.surfacedeform_bind(modifier='Gaiola')
print("R_CAGE bind:", r, "scan %d v, gaiola %d v" % (len(sc.data.vertices), len(cage.data.vertices)))
if teste:
    k, v = teste.split('='); cage.data.shape_keys.key_blocks[k].value = float(v); print("R_CAGE teste", k, v)
cage.hide_render = True   # oculto só no render: escondê-lo do viewport desliga a avaliação e o Surface Deform congela
for nm_ in ('OlhoD', 'OlhoE', 'Cabelo'):
    o_ = bpy.data.objects.get(nm_)
    if o_ and nm_ != 'Cabelo': o_.hide_render = False
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out)); print("R_CAGE salvo", out)
