"""blender -b --python tools/dd_finalize.py -- <in.blend> <tex.jpg> <out_prefix>
Troca a textura do material 'Pele' pela imagem final (empacotada), exporta glb e salva blend."""
import bpy, sys, os
a = sys.argv[sys.argv.index("--")+1:]; src, texf, out = a[:3]
bpy.ops.wm.open_mainfile(filepath=src); mp = bpy.data.objects['Busto']
img = bpy.data.images.load(os.path.abspath(texf)); img.pack()
mat = mp.data.materials[0]; tex = next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'); tex.image = img
for o in list(bpy.data.objects):
    if o.name != 'Busto': bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT'); mp.select_set(True); bpy.context.view_layer.objects.active = mp
bpy.ops.export_scene.gltf(filepath=out + ".glb", export_format='GLB', use_selection=True, export_image_format='JPEG', export_jpeg_quality=88, export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=out + ".blend"); print("FINAL salvo", out)
