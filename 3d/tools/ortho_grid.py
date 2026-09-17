"""blender -b --python tools/ortho_grid.py -- <out.png> <lado E|D> <y0,y1,z0,z1 mm> <tex 0|1> <a.blend> [b.blend ...]
Vista lateral ORTOGRÁFICA (eixo x) de cada blend, com grade de 10 mm (linhas a cada 50 mm mais fortes) para ler
posições (y, z) diretamente na imagem. Workbench; textura opcional."""
import bpy, sys, os, math
a = sys.argv[sys.argv.index("--")+1:]; out, side = a[0], a[1]; y0, y1, z0, z1 = [float(v)/1000 for v in a[2].split(',')]; tex = a[3] == '1'; blends = a[4:]
import numpy as np
tiles = []
for bi, bf in enumerate(blends):
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(bf)); sc = bpy.context.scene
    for o in list(sc.objects):
        if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
    sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'FLAT' if tex else 'STUDIO'; sh.color_type = 'TEXTURE' if tex else 'SINGLE'
    sc.view_settings.view_transform = 'Standard'
    W = 700; sc.render.resolution_x = W; sc.render.resolution_y = int(W*(z1-z0)/(y1-y0))
    cam = bpy.data.objects.new('C', bpy.data.cameras.new('C')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = (y1-y0)
    sx = 1 if side == 'E' else -1
    cam.location = (sx*0.6, (y0+y1)/2, (z0+z1)/2)
    cam.rotation_euler = (math.pi/2, 0, math.pi/2 if sx > 0 else -math.pi/2)
    f = os.path.join(os.path.dirname(os.path.abspath(out)), f'_og_{bi}.png'); sc.render.filepath = f; bpy.ops.render.render(write_still=True)
    tiles.append((f, os.path.basename(bf)))
import json
marks = [[float(v) for v in m.split(',')[:2]] + [m.split(',')[2]] for m in os.environ.get('OG_MARKS', '').split(';') if m]
json.dump(dict(out=out, tiles=tiles, side=side, box=[y0, y1, z0, z1], marks=marks), open(out + '.json', 'w'))
import subprocess; subprocess.run(['/data/venv-face/bin/python', '-c', '''
import json,sys,cv2,numpy as np
d=json.load(open(sys.argv[1])); y0,y1,z0,z1=d["box"]; rows=[]
for f,lab in d["tiles"]:
    im=cv2.imread(f); h,w=im.shape[:2]
    for mm in range(int(np.ceil(y0*1000)), int(y1*1000)+1, 10):
        x=int((mm/1000-y0)/(y1-y0)*w); x = w-1-x if d["side"]=="D" else x
        cv2.line(im,(x,0),(x,h),(0,200,255) if mm%50==0 else (90,90,90),1)
        if mm%50==0: cv2.putText(im,"y%d"%mm,(x+2,12),0,0.4,(0,200,255),1)
    for mm in range(int(np.ceil(z0*1000)), int(z1*1000)+1, 10):
        yy=int((z1-mm/1000)/(z1-z0)*h); cv2.line(im,(0,yy),(w,yy),(0,200,255) if mm%50==0 else (90,90,90),1)
        if mm%50==0: cv2.putText(im,"z%d"%mm,(2,yy-2),0,0.4,(0,200,255),1)
    
    for mk in d.get("marks", []):
        mx=int((mk[0]/1000-y0)/(y1-y0)*w); mx = w-1-mx if d["side"]=="D" else mx; my=int((z1-mk[1]/1000)/(z1-z0)*h)
        cv2.drawMarker(im,(mx,my),(0,0,255),cv2.MARKER_CROSS,18,2); cv2.putText(im,mk[2],(mx+6,my-6),0,0.45,(0,0,255),2)
    cv2.putText(im,lab,(5,h-8),0,0.5,(255,255,0),1); rows.append(im)
cv2.imwrite(d["out"], np.concatenate(rows,1))
''', out + '.json'])
