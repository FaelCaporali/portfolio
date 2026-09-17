"""blender -b --python tools/toon_setup.py -- <in.blend> <tex.jpg> <out.blend> [smooth_iters=6] [outline_px=2.0]
Busto cartoon: suaviza a malha (Smooth), material toon (Diffuse -> Shader to RGB -> ColorRamp em 3 bandas x textura
+ luz de borda Fresnel), contorno Freestyle. Salva o blend para closeup.py/render_studio.py."""
import bpy, sys, os
a = sys.argv[sys.argv.index("--")+1:]; src, texf, out = a[:3]; it = int(a[3]) if len(a) > 3 else 6; opx = float(a[4]) if len(a) > 4 else 2.0
bpy.ops.wm.open_mainfile(filepath=src); mp = bpy.data.objects['Busto']; sc = bpy.context.scene
bpy.ops.object.select_all(action='DESELECT'); mp.select_set(True); bpy.context.view_layer.objects.active = mp
if it > 0:
    m = mp.modifiers.new("Suave", 'SMOOTH'); m.factor = 0.5; m.iterations = it; bpy.ops.object.modifier_apply(modifier="Suave")
bpy.ops.object.shade_smooth()
img = bpy.data.images.load(os.path.abspath(texf)); img.pack()
mat = bpy.data.materials.new("Toon"); mat.use_nodes = True; nt = mat.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
dif = nt.nodes.new('ShaderNodeBsdfDiffuse'); dif.inputs['Color'].default_value = (1, 1, 1, 1)
s2r = nt.nodes.new('ShaderNodeShaderToRGB'); ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'CONSTANT'
cr = ramp.color_ramp; cr.elements[0].position = 0.0; cr.elements[0].color = (0.8, 0.76, 0.8, 1); cr.elements[1].position = 0.22; cr.elements[1].color = (0.98, 0.96, 0.98, 1)
e = cr.elements.new(0.5); e.color = (1.15, 1.15, 1.15, 1)
mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs[0].default_value = 1.0
fr = nt.nodes.new('ShaderNodeFresnel'); fr.inputs['IOR'].default_value = 1.25; rim = nt.nodes.new('ShaderNodeMath'); rim.operation = 'MULTIPLY'; rim.inputs[1].default_value = 0.06
add = nt.nodes.new('ShaderNodeMix'); add.data_type = 'RGBA'; add.blend_type = 'ADD'; add.inputs[0].default_value = 1.0
em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 1.0; outn = nt.nodes.new('ShaderNodeOutputMaterial')
L = nt.links
L.new(dif.outputs[0], s2r.inputs[0]); L.new(s2r.outputs['Color'], ramp.inputs[0]); L.new(ramp.outputs['Color'], mul.inputs[6]); L.new(tex.outputs['Color'], mul.inputs[7])
L.new(fr.outputs[0], rim.inputs[0]); L.new(mul.outputs[2], add.inputs[6]); L.new(rim.outputs[0], add.inputs[7]); L.new(add.outputs[2], em.inputs['Color']); L.new(em.outputs[0], outn.inputs[0])
mp.data.materials.clear(); mp.data.materials.append(mat)
sc.render.use_freestyle = True; sc.render.line_thickness = opx; fs = sc.view_layers[0].freestyle_settings; fs.as_render_pass = False
ls = fs.linesets.new("Contorno") if not fs.linesets else fs.linesets[0]; ls.select_silhouette = True; ls.select_border = True; ls.select_crease = False; ls.select_edge_mark = False
if ls.linestyle is None: ls.linestyle = bpy.data.linestyles.new("Contorno")
fs.crease_angle = 2.1; ls.linestyle.color = (0.08, 0.05, 0.05); ls.linestyle.thickness = opx
bpy.ops.wm.save_as_mainfile(filepath=out); print("TOON setup", out, len(mp.data.vertices))
