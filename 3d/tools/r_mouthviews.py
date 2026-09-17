"""blender -b --python tools/r_mouthviews.py -- <folha.jpg> <a.blend> [b.blend ...]
Boca de cada malha: frente com textura, frente em argila (luz rasante) e perfil em argila. Ortográfica, mesma escala."""
import bpy, sys, os, math, json, subprocess
a = sys.argv[sys.argv.index("--")+1:]; out, blends = os.path.abspath(a[0]), a[1:]; files = []
for bf in blends:
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(bf)); sc = bpy.context.scene
    for o in list(sc.objects):
        if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
    sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sc.view_settings.view_transform = 'Standard'; sc.render.resolution_x, sc.render.resolution_y = 700, 560
    c = bpy.data.objects.new('C', bpy.data.cameras.new('C')); sc.collection.objects.link(c); sc.camera = c; c.data.type = 'ORTHO'; c.data.ortho_scale = 0.085
    for tag, loc, rot, mode in (('tex', (0, -1, 0.105), (90, 0, 0), 'T'), ('clay', (0, -1, 0.105), (90, 0, 0), 'C'), ('perfil', (-1, -0.02, 0.105), (90, 0, -90), 'C')):
        c.location = loc; c.rotation_euler = tuple(math.radians(v) for v in rot)
        if mode == 'T': sh.light = 'FLAT'; sh.color_type = 'TEXTURE'
        else: sh.light = 'STUDIO'; sh.color_type = 'SINGLE'; sh.single_color = (0.75, 0.72, 0.68); sh.show_cavity = True; sh.cavity_type = 'BOTH'; sh.show_shadows = False
        f = out + '.%s.%s.png' % (os.path.basename(bf).replace('.blend', ''), tag); sc.render.filepath = f; bpy.ops.render.render(write_still=True); files.append((os.path.basename(bf), f))
json.dump(files, open(out + '.json', 'w'))
print(subprocess.run(['/data/venv-face/bin/python', '-c', '''
import json,sys,cv2,numpy as np
F=json.load(open(sys.argv[1]+".json")); rows=[]
for i in range(0,len(F),3):
    r=np.hstack([cv2.imread(F[j][1])[...,:3] for j in range(i,i+3)]); cv2.putText(r,F[i][0],(10,28),cv2.FONT_HERSHEY_SIMPLEX,.8,(0,255,255),2); rows.append(r)
cv2.imwrite(sys.argv[1],cv2.resize(np.vstack(rows),None,fx=.62,fy=.62,interpolation=cv2.INTER_AREA)); print("MOUTH",sys.argv[1])
''', out], capture_output=True, text=True).stdout)
