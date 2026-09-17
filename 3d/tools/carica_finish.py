"""blender -b --python tools/carica_finish.py -- <geo.blend> <out_prefix> [shadow=0.7] [outline_px=1.5] [smooth_iters=2]
Acabamento cartoon do busto caricatura: Smooth leve, material cel de 2 bandas (sombra quente) + luz de borda, contorno
Freestyle (silhueta + borda), olhos mantidos com o material próprio, exporta <out>.blend e <out>.glb (Three.js)."""
import bpy, sys, os
a = sys.argv[sys.argv.index("--")+1:]; src, out = a[:2]; shadow = float(a[2]) if len(a) > 2 else 0.7; opx = float(a[3]) if len(a) > 3 else 1.5; it = int(a[4]) if len(a) > 4 else 2
bpy.ops.wm.open_mainfile(filepath=src); mp = bpy.data.objects['Busto']; sc = bpy.context.scene
bpy.ops.object.select_all(action='DESELECT'); mp.select_set(True); bpy.context.view_layer.objects.active = mp
if it > 0:
    m = mp.modifiers.new("Suave", 'SMOOTH'); m.factor = 0.5; m.iterations = it; bpy.ops.object.modifier_apply(modifier="Suave")
bpy.ops.object.shade_smooth()
img = next(n.image for n in mp.data.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE' and n.image)   # a textura ligada ao material do build
mat = bpy.data.materials.new("Toon"); mat.use_nodes = True; nt = mat.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
dif = nt.nodes.new('ShaderNodeBsdfDiffuse'); dif.inputs['Color'].default_value = (1, 1, 1, 1)
s2r = nt.nodes.new('ShaderNodeShaderToRGB'); ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'CONSTANT'
cr = ramp.color_ramp; cr.elements[0].position = 0.0; cr.elements[0].color = (shadow, shadow * 0.9, shadow * 0.88, 1); cr.elements[1].position = 0.32; cr.elements[1].color = (1.0, 1.0, 1.0, 1)
e = cr.elements.new(0.75); e.color = (1.08, 1.08, 1.06, 1)
mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs[0].default_value = 1.0
fr = nt.nodes.new('ShaderNodeFresnel'); fr.inputs['IOR'].default_value = 1.3; rim = nt.nodes.new('ShaderNodeMath'); rim.operation = 'MULTIPLY'; rim.inputs[1].default_value = 0.08
add = nt.nodes.new('ShaderNodeMix'); add.data_type = 'RGBA'; add.blend_type = 'ADD'; add.inputs[0].default_value = 1.0
em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 1.0; outn = nt.nodes.new('ShaderNodeOutputMaterial')
L = nt.links
L.new(dif.outputs[0], s2r.inputs[0]); L.new(s2r.outputs['Color'], ramp.inputs[0]); L.new(ramp.outputs['Color'], mul.inputs[6]); L.new(tex.outputs['Color'], mul.inputs[7])
L.new(fr.outputs[0], rim.inputs[0]); L.new(mul.outputs[2], add.inputs[6]); L.new(rim.outputs[0], add.inputs[7]); L.new(add.outputs[2], em.inputs['Color']); L.new(em.outputs[0], outn.inputs[0])
mp.data.materials.clear(); mp.data.materials.append(mat)
sc.render.use_freestyle = True; sc.render.line_thickness = opx; fs = sc.view_layers[0].freestyle_settings; fs.as_render_pass = False
ls = fs.linesets.new("Contorno") if not fs.linesets else fs.linesets[0]; ls.select_silhouette = True; ls.select_border = True; ls.select_crease = False; ls.select_edge_mark = False
if ls.linestyle is None: ls.linestyle = bpy.data.linestyles.new("Contorno")
ls.linestyle.color = (0.08, 0.05, 0.05); ls.linestyle.thickness = opx
bpy.ops.wm.save_as_mainfile(filepath=out + ".blend")
# glb: malha + olhos, textura como Base Color (no site: MeshToonMaterial)
mat_glb = bpy.data.materials.new("PeleGLB"); mat_glb.use_nodes = True; ntg = mat_glb.node_tree
b = next(n for n in ntg.nodes if n.type == 'BSDF_PRINCIPLED'); t2 = ntg.nodes.new('ShaderNodeTexImage'); t2.image = img; ntg.links.new(t2.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.9
mp.data.materials[0] = mat_glb
for ey in [o for o in bpy.data.objects if o.name.startswith('Olho')]:
    me = bpy.data.materials.new(ey.name + "GLB"); me.use_nodes = True; bb = next(n for n in me.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bb.inputs['Base Color'].default_value = (0.93, 0.92, 0.9, 1); bb.inputs['Roughness'].default_value = 0.2   # esclera; íris fica para o shader do site
    ey.data.materials.clear(); ey.data.materials.append(me)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type == 'MESH': o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out + ".glb", use_selection=True, export_format='GLB', export_image_format='JPEG', export_apply=True)
print("FINISH", out, len(mp.data.vertices))
