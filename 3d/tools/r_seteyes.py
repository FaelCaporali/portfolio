"""blender -b --python tools/r_seteyes.py -- <in.blend> <olho_tex.png> <out.blend>
Aplica a textura de olho (íris centrada para a frente) nos objetos OlhoD/OlhoE."""
import bpy, sys, os
a = sys.argv[sys.argv.index("--")+1:]
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(a[0]))
img = bpy.data.images.load(os.path.abspath(a[1])); img.pack()
for nm in ('OlhoD', 'OlhoE'):
    o = bpy.data.objects.get(nm)
    if not o: continue
    m = bpy.data.materials.new('Olho'); m.use_nodes = True; nt = m.node_tree
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.18; b.inputs['Specular IOR Level'].default_value = 0.6
    o.data.materials.clear(); o.data.materials.append(m)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a[2])); print("SETEYES", a[2])
