"""blender -b --python tools/s08_poses.py -- <in.blend> <folha.jpg>
Folha de poses combinadas do S08 (como serão usadas na página): frente e 3/4, EEVEE sem luz de cena."""
import bpy, sys, os, math, json, subprocess
a = sys.argv[sys.argv.index("--")+1:]; src, out = a[0], a[1]
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(src)); sc = bpy.context.scene
for e in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
    try: sc.render.engine = e; break
    except TypeError: pass
for mv_ in bpy.data.materials:                                       # material de exportação com cor por vértice (conjuntiva) vira emissão para a conferência
    if mv_.use_nodes and mv_.name == 'Conjuntiva' and not any(n_.type == 'EMISSION' for n_ in mv_.node_tree.nodes):
        vc_ = next(n_ for n_ in mv_.node_tree.nodes if n_.type == 'VERTEX_COLOR'); oo_ = next(n_ for n_ in mv_.node_tree.nodes if n_.type == 'OUTPUT_MATERIAL')
        ee_ = mv_.node_tree.nodes.new('ShaderNodeEmission'); at_ = mv_.node_tree.nodes.new('ShaderNodeAttribute'); at_.attribute_type = 'GEOMETRY'; at_.attribute_name = vc_.layer_name; mv_.node_tree.links.new(at_.outputs['Color'], ee_.inputs['Color'])   # nó Attribute: com o nó Color Attribute o EEVEE não aplica a sombra transparente por cima (S11); mv_.node_tree.links.new(ee_.outputs[0], oo_.inputs['Surface'])
sc.view_settings.view_transform = 'Standard'; sc.render.resolution_x, sc.render.resolution_y = 560, 700
if sc.world: sc.world.use_nodes = False; sc.world.color = (0.05, 0.05, 0.06)
for m_ in bpy.data.materials:                                       # materiais de exportação (Principled) viram emissão só para esta conferência
    if not m_.use_nodes or any(n_.type == 'EMISSION' for n_ in m_.node_tree.nodes): continue
    t_ = next((n_ for n_ in m_.node_tree.nodes if n_.type == 'TEX_IMAGE'), None); o_ = next((n_ for n_ in m_.node_tree.nodes if n_.type == 'OUTPUT_MATERIAL'), None)
    if t_ and o_:
        em_ = m_.node_tree.nodes.new('ShaderNodeEmission'); m_.node_tree.links.new(t_.outputs['Color'], em_.inputs['Color']); m_.node_tree.links.new(em_.outputs[0], o_.inputs['Surface'])
for o in list(sc.objects):
    if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
cams = []
for nm, ang in (('f', 0), ('q', -32)):
    c = bpy.data.objects.new('C'+nm, bpy.data.cameras.new('C'+nm)); sc.collection.objects.link(c); c.data.lens = 85; r = math.radians(ang)
    c.location = (math.sin(r)*1.35, -math.cos(r)*1.35 + 0.10, 0.17); c.rotation_euler = (math.radians(90), 0, r); cams.append((nm, c))
MESH = [o for o in bpy.data.objects if o.type == 'MESH' and o.data.shape_keys]
GAZE0 = {s: tuple(bpy.data.objects['Olho_'+s].rotation_euler) for s in 'DE'}
def pose(keys, gaze=(0, 0)):
    for o in MESH:
        for k in o.data.shape_keys.key_blocks: k.value = min(keys.get('mouthSmileLeft', 0), keys.get('mouthSmileRight', 0)) if k.name == 'mouthSmileFix' else keys.get(k.name, 0.0)   # corretiva do sorriso bilateral
    for s in 'DE':
        g = GAZE0[s]; bpy.data.objects['Olho_'+s].rotation_euler = (g[0] + math.radians(gaze[1]), 0, g[2] + math.radians(gaze[0]))
POSES = [('neutro', {}, (0, 0)),
         ('sorriso', {'mouthSmileLeft': 1, 'mouthSmileRight': 1}, (0, 0)),
         ('sorriso de canto', {'mouthSmileLeft': 1, 'mouthSmileRight': 0.35, 'browOuterUpLeft': 0.5}, (0, 0)),
         ('surpresa', {'browInnerUp': 0.8, 'browOuterUpLeft': 1, 'browOuterUpRight': 1}, (0, 0)),
         ('concentrado', {'browDownLeft': 1, 'browDownRight': 1, 'eyeBlinkLeft': 0.18, 'eyeBlinkRight': 0.18}, (0, 4)),
         ('preocupado', {'browInnerUp': 1}, (0, 0)),
         ('olhar p/ esquerda dele', {}, (18, 0)),
         ('piscadela', {'eyeBlinkRight': 1, 'mouthSmileRight': 0.8, 'mouthSmileLeft': 0.4}, (0, 0))]
files = []
for i, (nm, keys, gz) in enumerate(POSES):
    pose(keys, gz)
    for cn, c in cams:
        sc.camera = c; f = os.path.abspath(f"{out}.{i}{cn}.png"); sc.render.filepath = f; bpy.ops.render.render(write_still=True); files.append((nm, f))
json.dump(files, open(out + '.json', 'w'))
print(subprocess.run([os.environ.get('FACE_PYTHON', 'python3'), '-c', '''
import json,sys,cv2,numpy as np
F=json.load(open(sys.argv[1]+".json")); cells=[]
for i in range(0,len(F),2):
    im=np.hstack([cv2.imread(F[i][1])[...,:3],cv2.imread(F[i+1][1])[...,:3]]); cv2.putText(im,F[i][0],(10,30),cv2.FONT_HERSHEY_SIMPLEX,.9,(0,255,255),2); cells.append(im)
rows=[np.hstack(cells[j:j+2]) for j in range(0,len(cells),2)]; sh=np.vstack(rows); sh=cv2.resize(sh,None,fx=.75,fy=.75,interpolation=cv2.INTER_AREA)
cv2.imwrite(sys.argv[1],sh,[cv2.IMWRITE_JPEG_QUALITY,90]); print("POSES",sys.argv[1],sh.shape)
''', out], capture_output=True, text=True).stdout)
