"""blender -b --python tools/mpfb_create.py -- <out.blend>
Cria humano MPFB2 (masculino, ~40 anos), corta o corpo abaixo do pescoço, base em z=0, nomeia 'Busto',
carrega os targets faciais como shape keys com peso 0 (prontos para o ajuste)."""
import bpy, sys, os, glob, addon_utils, bmesh
out = sys.argv[sys.argv.index("--")+1]
addon_utils.enable("bl_ext.blender_org.mpfb", default_set=True, persistent=True)
from bl_ext.blender_org.mpfb.services.humanservice import HumanService
from bl_ext.blender_org.mpfb.services.targetservice import TargetService
bpy.ops.wm.read_factory_settings(use_empty=True)
macro = {"gender": 0.95, "age": 0.55, "muscle": 0.5, "weight": 0.5, "height": 0.5, "proportions": 0.5, "cupsize": 0.5, "firmness": 0.5,
         "race": {"asian": 0.1, "african": 0.1, "caucasian": 0.8}}
try: o = HumanService.create_human(mask_helpers=True, detailed_helpers=False, extra_vertex_groups=False, feet_on_ground=True, scale=0.1, macro_detail_dict=macro)
except TypeError as e: print("macro err", e); o = HumanService.create_human(scale=0.1)
o.name = "Busto"; bpy.context.view_layer.objects.active = o; o.select_set(True)
base = os.path.join(os.path.dirname(HumanService.__module__ and __import__('bl_ext.blender_org.mpfb', fromlist=['x']).__file__), 'data', 'targets')
n = 0
for d in ('head','eyes','nose','mouth','cheek','chin','forehead','eyebrows','ears','neck'):
    for f in sorted(glob.glob(os.path.join(base, d, '*.target.gz'))):
        TargetService.load_target(o, f, weight=0.0, name=os.path.basename(f).replace('.target.gz','')); n += 1
# remover geometria de helpers (grupos 'helper*'/'joint*') e o corpo abaixo do pescoço
top = max(v.co.z for v in o.data.vertices); zcut = top - 0.33
body_idx = o.vertex_groups['body'].index
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT'); bpy.ops.object.mode_set(mode='OBJECT')
for v in o.data.vertices:
    v.select = (v.co.z < zcut) or v.index >= 13380   # basemesh MakeHuman: corpo = 0..13379, helpers depois
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.delete(type='VERT'); bpy.ops.object.mode_set(mode='OBJECT')
# manter só o maior componente conexo (remove tiras de sobrancelha/cílios)
bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
seen = set(); comps = []
for v in bm.verts:
    if v.index in seen: continue
    stack = [v]; comp = []
    while stack:
        x = stack.pop()
        if x.index in seen: continue
        seen.add(x.index); comp.append(x)
        for e in x.link_edges:
            y = e.other_vert(x)
            if y.index not in seen: stack.append(y)
    comps.append(comp)
comps.sort(key=len, reverse=True)
small = [v for c in comps[1:] for v in c]
print("MPFB componentes:", [len(c) for c in comps[:6]])
bmesh.ops.delete(bm, geom=small, context='VERTS'); bm.to_mesh(o.data); bm.free()
zmin = min(v.co.z for v in o.data.vertices); o.location.z = -zmin; bpy.ops.object.transform_apply(location=True)
m=bpy.data.materials.new("Pele"); m.use_nodes=True
b=next(n for n in m.node_tree.nodes if n.type=="BSDF_PRINCIPLED"); b.inputs["Base Color"].default_value=(0.62,0.45,0.35,1); b.inputs["Roughness"].default_value=0.7
o.data.materials.clear(); o.data.materials.append(m); bpy.ops.object.shade_smooth()
print("MPFB verts=%d faces=%d targets=%d altura=%.3f" % (len(o.data.vertices), len(o.data.polygons), n, max(v.co.z for v in o.data.vertices)))
bpy.ops.wm.save_as_mainfile(filepath=out)
