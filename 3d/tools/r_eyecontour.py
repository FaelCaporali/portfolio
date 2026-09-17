"""Contorno 3D da abertura das pálpebras no SCAN, por medição (nenhum vértice muda).
  blender -b --python tools/r_eyecontour.py -- render <in.blend> <prefix>     -> <prefix>_front.png + <prefix>_cam.json
  /data/venv-face/bin/python tools/r_eyecontour.py detect <prefix>            -> <prefix>_lm2d.json (mesmo detector das fotos)
  blender -b --python tools/r_eyecontour.py -- cast <in.blend> <prefix>       -> <prefix>_eyes3d.json + overlay
Câmera ortográfica frontal: pixel -> raio é exato (sem distorção de perspectiva), então o contorno 2D volta para a
malha por raycast sem erro de modelo de câmera."""
import sys, json, os
RIGHT = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]      # olho D dele (esquerda da imagem)
LEFT = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]
IRIS_R, IRIS_L = [468, 469, 470, 471, 472], [473, 474, 475, 476, 477]
W, H, SCALE, CX, CZ = 2400, 2400, 0.26, 0.0, 0.165
if 'detect' in sys.argv:
    import numpy as np, cv2, mediapipe as mp
    from mediapipe.tasks import python as mpp
    from mediapipe.tasks.python import vision
    pre = sys.argv[sys.argv.index('detect')+1]
    det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path='analise/face_landmarker.task'), num_faces=1, running_mode=vision.RunningMode.IMAGE))
    im = cv2.imread(pre + '_front.png')[..., :3]
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(im, cv2.COLOR_BGR2RGB)))
    P = [[q.x*W, q.y*H] for q in r.face_landmarks[0]]; json.dump(P, open(pre + '_lm2d.json', 'w')); print("DETECT", len(P))
    for ids, col in ((RIGHT, (0, 255, 0)), (LEFT, (0, 255, 0)), (IRIS_R, (255, 0, 255)), (IRIS_L, (255, 0, 255))):
        for i in ids: cv2.circle(im, (int(P[i][0]), int(P[i][1])), 4, col, -1)
    y0, y1 = int(min(P[i][1] for i in RIGHT+LEFT))-120, int(max(P[i][1] for i in RIGHT+LEFT))+120
    x0, x1 = int(min(P[i][0] for i in RIGHT))-80, int(max(P[i][0] for i in LEFT))+80
    cv2.imwrite(pre + '_overlay.jpg', im[y0:y1, x0:x1]); sys.exit()
import bpy, math, numpy as np
from mathutils import Vector
a = sys.argv[sys.argv.index("--")+1:]; mode, src, pre = a[:3]
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(src)); sc = bpy.context.scene; o = bpy.data.objects['Busto']
if mode == 'render':
    for ob in list(sc.objects):
        if ob.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(ob)
    sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'FLAT'; sh.color_type = 'TEXTURE'
    sc.view_settings.view_transform = 'Standard'; sc.render.resolution_x, sc.render.resolution_y = W, H; sc.render.resolution_percentage = 100
    c = bpy.data.objects.new('C', bpy.data.cameras.new('C')); sc.collection.objects.link(c); sc.camera = c
    c.data.type = 'ORTHO'; c.data.ortho_scale = SCALE; c.location = (CX, -1.0, CZ); c.rotation_euler = (math.radians(90), 0, 0)
    sc.render.filepath = os.path.abspath(pre + '_front.png'); bpy.ops.render.render(write_still=True); print("RENDER ok")
else:
    P = json.load(open(pre + '_lm2d.json')); dg = bpy.context.evaluated_depsgraph_get(); ev = o.evaluated_get(dg)
    def cast(u, v):
        x = CX + (u/W - 0.5)*SCALE; z = CZ - (v/H - 0.5)*SCALE*H/W
        ok, loc, nrm, fi = ev.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
        return [loc.x, loc.y, loc.z] if ok else None
    out = {}
    for nm, ids in (('D', RIGHT), ('E', LEFT), ('iris_D', IRIS_R), ('iris_E', IRIS_L)):
        out[nm] = [cast(*P[i]) for i in ids]
    json.dump(out, open(pre + '_eyes3d.json', 'w'), indent=1)
    for s in 'DE':
        C = np.array(out[s])*1000; ir = np.array(out['iris_'+s])*1000
        wd = np.linalg.norm(C[0]-C[8]); up, lo = C[12], C[4]
        print("OLHO %s largura %.1f mm  abertura %.1f mm  canto ext %s  canto int %s  iris centro %s  iris diam %.1f mm  prof. contorno y %.1f..%.1f" % (
            s, wd, np.linalg.norm(up-lo), np.round(C[0], 1), np.round(C[8], 1), np.round(ir[0], 1), np.linalg.norm(ir[1]-ir[3]), C[:, 1].min(), C[:, 1].max()))
