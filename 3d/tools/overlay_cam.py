"""blender -b --python tools/overlay_cam.py -- <in.blend> <out_prefix> <ds> <pnp1.json> [...]
Render clay (Workbench, fundo transparente) da malha 'Busto' pela câmera PnP de cada foto: <out>_<foto>.png.
Base do método de referência casada com câmera (sobrepor malha e foto e esculpir até coincidir)."""
import bpy, sys, os, json, numpy as np
from mathutils import Matrix
a = sys.argv[sys.argv.index("--")+1:]; src, out, ds = a[0], a[1], int(a[2])
bpy.ops.wm.open_mainfile(filepath=src); sc = bpy.context.scene
for ob in list(sc.objects):
    if ob.type in ('LIGHT', 'CAMERA') or (ob.type == 'MESH' and ob.name != 'Busto'): ob.hide_render = True
sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading
sh.light = 'STUDIO'; sh.color_type = 'SINGLE'; sh.single_color = (0.8, 0.72, 0.66); sh.show_cavity = True; sh.cavity_type = 'BOTH'
sc.render.film_transparent = True; sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'; sc.render.resolution_percentage = 100
cam = bpy.data.objects.new("CamPnP", bpy.data.cameras.new("CamPnP")); sc.collection.objects.link(cam); sc.camera = cam
for pf in a[3:]:
    p = json.load(open(pf)); W, H, f = p['w'], p['h'], p['f']
    rv = np.array(p['rvec']); th = np.linalg.norm(rv); k = rv/th; Kx = np.array([[0,-k[2],k[1]],[k[2],0,-k[0]],[-k[1],k[0],0]])
    R = np.eye(3) + np.sin(th)*Kx + (1-np.cos(th))*(Kx@Kx); t = np.array(p['tvec']); C = -R.T @ t
    M = np.eye(4); M[:3,:3] = R.T @ np.diag([1,-1,-1]); M[:3,3] = C; cam.matrix_world = Matrix(M.tolist())
    cam.data.sensor_fit = 'HORIZONTAL'; cam.data.sensor_width = 36.0; cam.data.lens = f*36.0/W; cam.data.clip_start = 0.05
    sc.render.resolution_x = W//ds; sc.render.resolution_y = H//ds
    sc.render.filepath = os.path.abspath(out + "_" + os.path.basename(pf)[:-5] + ".png"); bpy.ops.render.render(write_still=True)
    print("OVR", sc.render.filepath)
