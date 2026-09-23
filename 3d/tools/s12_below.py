"""blender -b <in.blend> --python tools/s12_below.py -- <out.jpg>
Vistas de BAIXO para cima (o ângulo em que o Fael pegou os defeitos): rosto inteiro a 35 e 55 graus, nariz a 60 e 80 graus, olhos a 45 graus;
linha de cima com textura (EEVEE, sem luz de cena), de baixo em argila."""
import bpy, sys, os, math, json, tempfile
from mathutils import Vector, Matrix
out = os.path.abspath(sys.argv[sys.argv.index("--")+1]); sc = bpy.context.scene
for o in list(sc.objects):
    if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
cam = bpy.data.objects.new('C', bpy.data.cameras.new('C')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'
sc.render.resolution_x, sc.render.resolution_y = 640, 480; sc.view_settings.view_transform = 'Standard'; sc.render.film_transparent = False
sc.world = sc.world or bpy.data.worlds.new('W'); sc.world.use_nodes = False; sc.world.color = (0.05, 0.05, 0.05)
VIEWS = [('rosto 35', (0, -0.02, 0.15), 35, 0.30), ('rosto 55', (0, -0.02, 0.15), 55, 0.30), ('nariz 60', (0, -0.03, 0.128), 60, 0.075), ('nariz 80', (0, -0.03, 0.128), 80, 0.075), ('olhos 45', (0, 0.01, 0.18), 45, 0.13)]
tmp = os.path.join(tempfile.gettempdir(), 'bl_'); files = []
for mode in ('tex', 'clay'):
    if mode == 'tex':
        for e_ in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
            try: sc.render.engine = e_; break
            except TypeError: pass
    else:
        sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'SINGLE'; sh.single_color = (0.75, 0.72, 0.70); sh.show_cavity = True
        for nm in ('Sombra_D', 'Sombra_E'):
            if nm in bpy.data.objects: bpy.data.objects[nm].hide_render = True
    for nm, tgt, pitch, scale in VIEWS:
        d = Matrix.Rotation(math.radians(pitch), 3, 'X') @ Vector((0, -1, 0)); cam.data.ortho_scale = scale
        cam.location = Vector(tgt) + d*0.6; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); f = tmp + mode + nm.replace(' ', '') + '.png'
        sc.render.filepath = f; bpy.ops.render.render(write_still=True); files.append((nm, f))
json.dump(dict(out=out, files=files), open(tmp + 's.json', 'w'))
import subprocess
subprocess.run([os.environ.get('FACE_PYTHON', 'python3'), '-c', '''
import json,cv2,numpy as np,sys
d=json.load(open(sys.argv[1])); ims=[]
for nm,f in d["files"]:
    im=cv2.imread(f); cv2.putText(im,nm,(8,24),0,0.7,(0,255,255),2); ims.append(im)
n=len(ims)//2; cv2.imwrite(d["out"],np.vstack([np.hstack(ims[:n]),np.hstack(ims[n:])]),[cv2.IMWRITE_JPEG_QUALITY,92]); print("BELOW",d["out"])
''', tmp + 's.json'])
