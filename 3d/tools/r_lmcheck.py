"""blender -b --python tools/r_lmcheck.py -- <foto> <out_prefix> <a.blend> [b.blend ...]
Teste objetivo de identidade: renderiza cada malha com textura pela câmera PnP da foto, roda o MESMO detector de
pontos faciais na foto e nos renders, alinha por Procrustes (olhos + base do nariz) e compara medidas normalizadas
pela distância interocular: largura da boca, espessura dos lábios, abertura dos olhos, largura do nariz, altura do
rosto, etc. Salva <out>_<blend>.png (renders) e imprime a tabela."""
import bpy, sys, os, json, math, numpy as np
from mathutils import Matrix
a = sys.argv[sys.argv.index("--")+1:]; foto, out = a[0], a[1]; blends = a[2:]
p = json.load(open(f'analise/pnp/{foto}.json')); W, H = p['w'], p['h']
outs = []
for bf in blends:
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(bf)); sc = bpy.context.scene
    for o in list(sc.objects):
        if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
    sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'FLAT'; sh.color_type = 'TEXTURE'
    sc.view_settings.view_transform = 'Standard'; sc.render.film_transparent = False
    sc.world = sc.world or bpy.data.worlds.new('W')
    cam = bpy.data.objects.new('CamPnP', bpy.data.cameras.new('CamPnP')); sc.collection.objects.link(cam); sc.camera = cam
    rv = np.array(p['rvec']); th = np.linalg.norm(rv); k = rv/th
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    R = np.eye(3) + math.sin(th)*K + (1-math.cos(th))*(K @ K); t = np.array(p['tvec'])
    M = np.eye(4); M[:3, :3] = R.T @ np.diag([1, -1, -1]); M[:3, 3] = -R.T @ t
    cam.matrix_world = Matrix(M.tolist())
    sc.render.resolution_x, sc.render.resolution_y = W, H
    cam.data.sensor_fit = 'HORIZONTAL'; cam.data.sensor_width = 36.0; cam.data.lens = p['f']*36.0/W
    f = f"{out}_{os.path.basename(bf).replace('.blend','')}.png"; sc.render.filepath = f
    bpy.ops.render.render(write_still=True); outs.append(f)
json.dump(dict(foto=foto, renders=outs), open(out + '_lm.json', 'w'))
import subprocess
print(subprocess.run(['/data/venv-face/bin/python', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'r_lmcompare.py'), out + '_lm.json'], capture_output=True, text=True).stdout)
