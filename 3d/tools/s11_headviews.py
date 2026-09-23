"""blender -b <in.blend> --python tools/s11_headviews.py -- <out.jpg>
Cabeça inteira em ortográfica, mesma escala: frente, 3/4, perfil E, costas, topo; linha de cima com textura, de baixo em argila."""
import bpy, sys, os, math, json, tempfile
from mathutils import Vector, Matrix
out = os.path.abspath(sys.argv[sys.argv.index("--")+1]); sc = bpy.context.scene
for o in list(sc.objects):
    if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
cam = bpy.data.objects.new('C', bpy.data.cameras.new('C')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'; cam.data.ortho_scale = 0.40
sc.render.resolution_x = sc.render.resolution_y = 640; sc.view_settings.view_transform = 'Standard'; sc.render.film_transparent = False
sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; tmp = os.path.join(tempfile.gettempdir(), 'hv_'); files = []
VIEWS = [('frente', 0, 0), ('3/4', 40, 0), ('perfil E', 90, 0), ('perfil D', -90, 0), ('costas', 180, 0), ('topo', 0, -89.9), ('orelha E 3/4 tras', 130, 0), ('orelha D 3/4 tras', -130, 0)]
for mode in ('tex', 'clay'):
    if mode == 'tex': sh.light = 'FLAT'; sh.color_type = 'TEXTURE'
    else: sh.light = 'STUDIO'; sh.color_type = 'SINGLE'; sh.single_color = (0.75, 0.72, 0.70); sh.show_cavity = True
    for nm, yaw, pitch in VIEWS:
        d = Matrix.Rotation(math.radians(yaw), 3, 'Z') @ Matrix.Rotation(math.radians(pitch), 3, 'X') @ Vector((0, -1, 0)); t = Vector((0, 0.06, 0.16))
        cam.location = t + d*1.0; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); f = tmp + mode + nm.replace('/', '').replace(' ', '') + '.png'
        sc.render.filepath = f; bpy.ops.render.render(write_still=True); files.append((nm, f))
json.dump(dict(out=out, files=files), open(tmp + 's.json', 'w'))
import subprocess
subprocess.run([os.environ.get('FACE_PYTHON', 'python3'), '-c', '''
import json,cv2,numpy as np,sys
d=json.load(open(sys.argv[1])); ims=[]
for nm,f in d["files"]:
    im=cv2.imread(f); cv2.putText(im,nm,(8,24),0,0.7,(0,0,255),2); ims.append(im)
n=len(ims)//2; cv2.imwrite(d["out"],np.vstack([np.hstack(ims[:n]),np.hstack(ims[n:])]),[cv2.IMWRITE_JPEG_QUALITY,90]); print("HEAD",d["out"])
''', tmp + 's.json'])
