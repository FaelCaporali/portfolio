"""blender -b <in.blend> --python tools/s10_view.py -- <out.jpg> [clay]
Folha de conferência dos olhos e da boca em close, vários ângulos, com a mesma régua para D e E (o E é a referência aprovada).
Linhas: olho D, olho E (espelhado na coluna para comparar lado a lado), boca. Colunas: frente, 35 medial, 35 lateral, 75 lateral, de cima 30, de baixo 30."""
import bpy, sys, os, math, json, numpy as np
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index("--")+1:]; out = os.path.abspath(a[0]); clay = 'clay' in a
ROOT = '/home/fael/projects/portfolio/3d/'
CEN = json.load(open(ROOT + 'analise/gate/olhos_centro_%s.json' % ('s09' if 's09' in bpy.data.filepath else 's10')))
sc = bpy.context.scene
_K = [x for x in os.environ.get('KEYS', '').split(',') if x]
if 'mouthSmileLeft' in _K and 'mouthSmileRight' in _K: _K.append('mouthSmileFix')
for k_ in _K:                # KEYS=eyeBlinkLeft,eyeBlinkRight: confere a pose de perto
    for o_ in bpy.data.objects:
        if o_.type == 'MESH' and o_.data.shape_keys and k_ in o_.data.shape_keys.key_blocks: o_.data.shape_keys.key_blocks[k_].value = 1.0
for o in list(sc.objects):
    if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
if clay:
    sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'SINGLE'; sh.single_color = (0.75, 0.72, 0.70); sh.show_cavity = True; sh.show_shadows = False
    for nm in ('Sombra_D', 'Sombra_E'):
        if nm in bpy.data.objects: bpy.data.objects[nm].hide_render = True
else:
    for e_ in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try: sc.render.engine = e_; break
        except TypeError: pass
for m_ in bpy.data.materials:                                       # pele sem luz de cena: a luz do scan está assada na textura
    if clay or not m_.use_nodes or any(n_.type == 'EMISSION' for n_ in m_.node_tree.nodes): continue
    t_ = next((n_ for n_ in m_.node_tree.nodes if n_.type == 'TEX_IMAGE'), None); o_ = next((n_ for n_ in m_.node_tree.nodes if n_.type == 'OUTPUT_MATERIAL'), None)
    if t_ and o_:
        em_ = m_.node_tree.nodes.new('ShaderNodeEmission'); m_.node_tree.links.new(t_.outputs['Color'], em_.inputs['Color']); m_.node_tree.links.new(em_.outputs[0], o_.inputs['Surface'])
sc.view_settings.view_transform = 'Standard'; sc.render.film_transparent = False
sc.world = sc.world or bpy.data.worlds.new('W'); sc.world.use_nodes = True
bg = next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs[0].default_value = (0.05, 0.05, 0.05, 1)
cam = bpy.data.objects.new('C', bpy.data.cameras.new('C')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'
W = 560; sc.render.resolution_x = W; sc.render.resolution_y = int(W*0.7); sc.render.resolution_percentage = 100
def shot(target, yaw, pitch, scale, f, clip=0.01):
    cam.data.ortho_scale = scale; t = Vector(target)
    d = Matrix.Rotation(math.radians(yaw), 3, 'Z') @ Matrix.Rotation(math.radians(pitch), 3, 'X') @ Vector((0, -1, 0))
    cam.location = t + d*0.5; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); cam.data.clip_start = clip; cam.data.clip_end = 2
    sc.render.filepath = f; sc.render.image_settings.file_format = 'PNG'; bpy.ops.render.render(write_still=True)
for s_ in 'DE':                                                     # GAZE=graus: gira os globos (olhar para o lado), como a animação faz
    if os.environ.get('GAZE') and 'Olho_'+s_ in bpy.data.objects: bpy.data.objects['Olho_'+s_].rotation_euler[2] += math.radians(float(os.environ['GAZE']))
tmp = os.environ.get('CLAUDE_JOB_DIR', '/tmp') + '/tmp/s10v_'
rows = []
for s, sg in (('D', -1), ('E', 1)):
    c = CEN[s]; tgt = (c[0], c[1] - 0.0136, c[2]); r = []
    for i, (yw, pt) in enumerate([(0, 0), (-35*sg, 0), (35*sg, 0), (75*sg, 0), (0, -30), (0, 30)]):
        f = tmp + '%s%d.png' % (s, i); shot(tgt, yw, pt, 0.052, f); r.append(f)
    rows.append((s, r))
r = []
for i, (yw, pt) in enumerate([(0, 0), (-35, 0), (35, 0), (88, 0), (-88, 0), (0, 25)]):
    f = tmp + 'M%d.png' % i; shot((0, -0.019, 0.094), yw, pt, 0.085, f, clip=(0.497 if abs(yw) > 80 else 0.01)); r.append(f)
rows.append(('M', r))
json.dump(dict(out=out, rows=rows), open(tmp + 'sheet.json', 'w'))
import subprocess
subprocess.run(['/data/venv-face/bin/python', '-c', '''
import json,cv2,numpy as np,sys
d=json.load(open(sys.argv[1])); R=[]
for s,fs in d["rows"]:
    ims=[cv2.imread(f) for f in fs]
    if s=="E": ims=[np.ascontiguousarray(im[:, ::-1]) for im in ims]
    for im,l in zip(ims,["frente","35 medial","35 lateral","75 lateral","de cima","de baixo"] if s!="M" else ["frente","35 D","35 E","perfil E","perfil D","de baixo"]): cv2.putText(im,s+" "+l+(" (espelhado)" if s=="E" else ""),(8,22),cv2.FONT_HERSHEY_SIMPLEX,0.6,(255,255,255),1,cv2.LINE_AA)
    R.append(np.hstack(ims))
cv2.imwrite(d["out"],np.vstack(R),[cv2.IMWRITE_JPEG_QUALITY,93]); print("FOLHA",d["out"])
''', tmp + 'sheet.json'])
