"""blender -b --python tools/r_eyearea.py -- <foto> <out_prefix> <a.blend> [b.blend ...]
Área visível de cada globo ocular (render pela câmera da foto, globos em magenta emissivo, oclusão das pálpebras
preservada) comparada à área do contorno do olho na foto (landmarks), normalizada pela distância interocular."""
import bpy, sys, os, json, math, numpy as np
from mathutils import Matrix
a = sys.argv[sys.argv.index("--")+1:]; foto, out = a[0], a[1]; blends = a[2:]
p = json.load(open(f'analise/pnp/{foto}.json')); W, H = p['w'], p['h']
outs = []
for bf in blends:
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(bf)); sc = bpy.context.scene
    for o in list(sc.objects):
        if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        m = bpy.data.materials.new('flat')
        m.use_nodes = True; nt = m.node_tree
        for n in list(nt.nodes): nt.nodes.remove(n)
        em = nt.nodes.new('ShaderNodeEmission'); oo = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs[0], oo.inputs[0])
        o.color = (1, 0, 1, 1) if o.name.startswith('Olho') else (0.02, 0.02, 0.02, 1)
        o.data.materials.clear(); o.data.materials.append(m)
    sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'FLAT'; sh.color_type = 'OBJECT'
    sc.view_settings.view_transform = 'Standard'; sc.render.film_transparent = False
    cam = bpy.data.objects.new('C', bpy.data.cameras.new('C')); sc.collection.objects.link(cam); sc.camera = cam
    rv = np.array(p['rvec']); th = np.linalg.norm(rv); k = rv/th
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    R = np.eye(3) + math.sin(th)*K + (1-math.cos(th))*(K @ K); t = np.array(p['tvec'])
    M = np.eye(4); M[:3, :3] = R.T @ np.diag([1, -1, -1]); M[:3, 3] = -R.T @ t
    cam.matrix_world = Matrix(M.tolist()); sc.render.resolution_x, sc.render.resolution_y = W, H
    cam.data.sensor_fit = 'HORIZONTAL'; cam.data.sensor_width = 36.0; cam.data.lens = p['f']*36.0/W
    f = f"{out}_{os.path.basename(bf).replace('.blend','')}.png"; sc.render.filepath = f
    bpy.ops.render.render(write_still=True); outs.append(f)
json.dump(dict(foto=foto, renders=outs), open(out + '_ea.json', 'w'))
import subprocess
print(subprocess.run(['/data/venv-face/bin/python', '-c', '''
import sys, json, numpy as np, cv2
d = json.load(open(sys.argv[1])); L = json.load(open("analise/landmarks.json"))[d["foto"]+".jpg"]
W0, H0 = L["size"]; im0 = cv2.imread("referencias/upload-02/%s.jpg" % d["foto"]); h, w = im0.shape[:2]
P = np.array(L["pts"])[:468, :2]*[w/W0, h/H0]
RE = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246]; LE = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398]
iod = np.linalg.norm(P[33]-P[263])
def area(ids): return cv2.contourArea(P[ids].astype(np.float32))
print("AREA olho (x1000 da interocular^2)  foto: D %.1f  E %.1f" % (1000*area(RE)/iod**2, 1000*area(LE)/iod**2))
for f in d["renders"]:
    im = cv2.imread(f); mag = (im[...,2]>150)&(im[...,0]>150)&(im[...,1]<100)
    ys, xs = np.nonzero(mag)
    if not len(xs): print(f, "sem globo visivel"); continue
    lab = (xs > np.median(xs)); aD = (~lab).sum(); aE = lab.sum()
    if P[33][0] > P[263][0]: aD, aE = aE, aD
    print("%-28s D %.1f  E %.1f" % (f.split("/")[-1], 1000*aD/iod**2, 1000*aE/iod**2))
''', out + '_ea.json'], capture_output=True, text=True).stdout)
