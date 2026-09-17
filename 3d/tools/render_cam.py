"""blender -b --python tools/render_cam.py -- <in.blend> <pnp.json> <ds> <out.png>
Renderiza a malha 'Busto' (textura, luz uniforme) da câmera PnP da foto, reduzida por ds. Para testes de projeção."""
import bpy, sys, os, json, numpy as np
from mathutils import Matrix
a = sys.argv[sys.argv.index("--")+1:]; src, pf, ds, out = a[0], a[1], int(a[2]), a[3]
bpy.ops.wm.open_mainfile(filepath=src); sc = bpy.context.scene
for ob in list(sc.objects):
    if ob.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(ob)
p = json.load(open(pf)); W, H, f = p['w'], p['h'], p['f']
rv = np.array(p['rvec']); th = np.linalg.norm(rv); k = rv/th; Kx = np.array([[0,-k[2],k[1]],[k[2],0,-k[0]],[-k[1],k[0],0]])
R = np.eye(3) + np.sin(th)*Kx + (1-np.cos(th))*(Kx@Kx); t = np.array(p['tvec']); C = -R.T @ t
cam = bpy.data.objects.new("CamPnP", bpy.data.cameras.new("CamPnP")); sc.collection.objects.link(cam); sc.camera = cam
M = np.eye(4); M[:3,:3] = R.T @ np.diag([1,-1,-1]); M[:3,3] = C; cam.matrix_world = Matrix(M.tolist())
cam.data.sensor_fit = 'HORIZONTAL'; cam.data.sensor_width = 36.0; cam.data.lens = f*36.0/W; cam.data.clip_start = 0.05
sc.render.engine = 'BLENDER_EEVEE_NEXT'; sc.render.resolution_x = W//ds; sc.render.resolution_y = H//ds; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = 'Standard'; w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs[0].default_value = (1,1,1,1); bg.inputs[1].default_value = 1.0
sc.render.filepath = os.path.abspath(out); sc.render.image_settings.file_format = 'PNG'; bpy.ops.render.render(write_still=True); print("RENDER", out)
