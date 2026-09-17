"""blender -b --python tools/clay_views.py -- <out.jpg> <alvo_mm x,y,z> <dist_m> <label> <a.blend> [b.blend ...]
Folha de clay (sem textura, luz fixa) em 6 vistas em torno de um alvo (método dos perfis): linhas = blends,
colunas = frente, 3/4 D, perfil D, 3/4 E, perfil E, de baixo. Para comparar antes/depois de cada edição."""
import bpy, sys, os, math, numpy as np
from mathutils import Vector
a = sys.argv[sys.argv.index("--")+1:]; out, tgt, dist, label, blends = a[0], Vector([float(v)/1000 for v in a[1].split(',')]), float(a[2]), a[3], a[4:]
VIEWS = [('frente', 0, 0), ('3/4 D', -40, 0), ('perfil D', -90, 0), ('3/4 E', 40, 0), ('perfil E', 90, 0), ('baixo', 0, -45)]
tmp = os.path.join(os.path.dirname(os.path.abspath(out)), '_cv'); os.makedirs(tmp, exist_ok=True); files = []
for bi, bf in enumerate(blends):
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(bf)); sc = bpy.context.scene; ob = bpy.data.objects['Busto']
    for o in list(sc.objects):
        if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
    sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'SINGLE'
    sh.single_color = (0.78, 0.76, 0.74); sh.show_cavity = False; sc.render.resolution_x = sc.render.resolution_y = 420
    sc.view_settings.view_transform = 'Standard'; sc.render.film_transparent = False
    sc.world = sc.world or bpy.data.worlds.new('W')
    cam = bpy.data.objects.new('C', bpy.data.cameras.new('C')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 85
    for vi, (nm, yaw, pitch) in enumerate(VIEWS):
        y, p = math.radians(yaw), math.radians(pitch)
        d = Vector((math.sin(y)*math.cos(p), -math.cos(y)*math.cos(p), math.sin(p)))
        cam.location = tgt + d*dist; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        f = os.path.join(tmp, f'{bi}_{vi}.png'); sc.render.filepath = f; bpy.ops.render.render(write_still=True); files.append((bi, vi, f))
import json
json.dump(dict(out=out, label=label, blends=blends, views=[v[0] for v in VIEWS], files=files), open(os.path.join(tmp, 'sheet.json'), 'w'))
import subprocess; subprocess.run(['python3', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'clay_sheet.py'), os.path.join(tmp, 'sheet.json')])
