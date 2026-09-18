"""blender -b <toon-npc-01.blend> --python tools/npc01_export.py -- <out.glb>
Exporta o NPC01 para glTF binario (Three.js): armature + pesos, chaves de forma (morph targets com nomes ARKit),
cores toon por vertice (COLOR_0), textura do olho, contorno como malha separada 'Outline' (normais invertidas, single-sided)."""
import bpy, sys, os
out = sys.argv[sys.argv.index('--') + 1]
for o in bpy.data.objects:
    if o.type == 'MESH' and o.data.shape_keys:
        for k in o.data.shape_keys.key_blocks: k.value = 0.0
arm = bpy.data.objects['NPC01.rig']
for pb in arm.pose.bones: pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)
# materiais de exportacao: Principled puro (cor de vertice / textura do olho); o viewer Three.js troca por MeshToonMaterial
def pbr(name, image=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    pr = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'); pr.inputs['Roughness'].default_value = 1.0; pr.inputs['Metallic'].default_value = 0.0
    if image is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = image; nt.links.new(t.outputs[0], pr.inputs['Base Color'])
    else:
        va = nt.nodes.new('ShaderNodeVertexColor'); va.layer_name = 'Col'; nt.links.new(va.outputs[0], pr.inputs['Base Color'])
    m.use_backface_culling = True; return m
m_toon = pbr('toon_vcol'); m_eye = pbr('eye_tex', next(i for i in bpy.data.images if i.name.startswith('npc01_eye')))
for o in bpy.data.objects:
    if o.type != 'MESH' or not o.data.materials: continue
    nm = o.data.materials[0].name
    if nm == 'NPC01_toon': o.data.materials[0] = m_toon
    elif nm == 'NPC01_eye': o.data.materials[0] = m_eye
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type in ('MESH', 'ARMATURE'): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=False, export_skins=True, export_morph=True,
                          export_morph_normal=False, export_animations=False, export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                          export_image_format='AUTO', export_yup=True, export_texcoords=True, export_normals=True, export_materials='EXPORT',
                          export_def_bones=False, export_rest_position_armature=True)
print('NPC01 glb', out, os.path.getsize(out) / 1e6, 'MB')
