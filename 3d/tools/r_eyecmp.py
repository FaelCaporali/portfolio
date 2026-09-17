"""blender -b --python tools/r_eyecmp.py -- <foto> <out.jpg> <a.blend> [b.blend ...]
Crítica dos olhos: recorte dos olhos na FOTO em resolução cheia e, embaixo, cada malha renderizada pela câmera PnP da
mesma foto, mesmo recorte, mesma escala. Textura sem luz (o scan já traz a luz assada)."""
import bpy, sys, os, json, math, numpy as np
from mathutils import Matrix
a = sys.argv[sys.argv.index("--")+1:]; foto, out, blends = a[0], a[1], a[2:]
p = json.load(open(f'analise/pnp/{foto}.json')); D = json.load(open(f'analise/gate/olhos_foto_{foto}.json')); P = np.array(D['P'])
W, H = D['w'], D['h']; k = W/p['w']
E = P[[33, 133, 362, 263, 159, 145, 386, 374]]; x0, y0 = E.min(0); x1, y1 = E.max(0); mx, my = 0.22*(x1-x0), 1.3*(y1-y0)
bx = [max(0, x0-mx)/W, min(W, x1+mx)/W, max(0, y0-my)/H, min(H, y1+my)/H]
tmp = []
for bf in blends:
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(bf)); sc = bpy.context.scene
    for o in list(sc.objects):
        if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
    # EEVEE com tudo em emissão (sem luz de cena: a luz do scan está assada na textura); mostra transparência da sombra do olho
    for e in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try: sc.render.engine = e; break
        except TypeError: pass
    for m in bpy.data.materials:
        if not m.use_nodes or any(n.type == 'EMISSION' for n in m.node_tree.nodes): continue
        t = next((n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE'), None); o_ = next((n for n in m.node_tree.nodes if n.type == 'OUTPUT_MATERIAL'), None)
        if t and o_:
            em = m.node_tree.nodes.new('ShaderNodeEmission'); m.node_tree.links.new(t.outputs['Color'], em.inputs['Color']); m.node_tree.links.new(em.outputs[0], o_.inputs['Surface'])
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.render.film_transparent = False
    if sc.world: sc.world.use_nodes = False; sc.world.color = (0, 0, 0)
    cam = bpy.data.objects.new('CamPnP', bpy.data.cameras.new('CamPnP')); sc.collection.objects.link(cam); sc.camera = cam
    rv = np.array(p['rvec']); th = np.linalg.norm(rv); kk = rv/th
    K = np.array([[0, -kk[2], kk[1]], [kk[2], 0, -kk[0]], [-kk[1], kk[0], 0]])
    R = np.eye(3) + math.sin(th)*K + (1-math.cos(th))*(K @ K); t = np.array(p['tvec'])
    M = np.eye(4); M[:3, :3] = R.T @ np.diag([1, -1, -1]); M[:3, 3] = -R.T @ t; cam.matrix_world = Matrix(M.tolist())
    sc.render.resolution_x, sc.render.resolution_y = W, H; sc.render.resolution_percentage = 100
    cam.data.sensor_fit = 'HORIZONTAL'; cam.data.sensor_width = 36.0; cam.data.lens = p['f']*k*36.0/W
    sc.render.use_border = True; sc.render.use_crop_to_border = True
    sc.render.border_min_x, sc.render.border_max_x = bx[0], bx[1]; sc.render.border_min_y, sc.render.border_max_y = 1-bx[3], 1-bx[2]
    f = os.path.abspath(out + '.' + os.path.basename(bf) + '.png'); sc.render.filepath = f; bpy.ops.render.render(write_still=True); tmp.append(f)
json.dump(dict(foto=f'referencias/upload-02/{foto}.jpg', box=[bx[0]*W, bx[1]*W, bx[2]*H, bx[3]*H], renders=tmp, out=out, names=[os.path.basename(b) for b in blends]), open(out + '.json', 'w'))
import subprocess
print(subprocess.run(['/data/venv-face/bin/python', '-c', '''
import json,cv2,numpy as np,sys
d=json.load(open(sys.argv[1])); x0,x1,y0,y1=[int(v) for v in d["box"]]
ph=cv2.imread(d["foto"])[y0:y1,x0:x1]; rows=[("FOTO "+d["foto"].split("/")[-1],ph)]
for n,f in zip(d["names"],d["renders"]):
    im=cv2.imread(f)[...,:3]; rows.append((n,cv2.resize(im,(ph.shape[1],ph.shape[0]))))
S=1100/ph.shape[1]; outs=[]
for n,im in rows:
    im=cv2.resize(im,None,fx=S,fy=S,interpolation=cv2.INTER_CUBIC); cv2.putText(im,n,(8,26),cv2.FONT_HERSHEY_SIMPLEX,.8,(0,255,255),2); outs.append(im)
cv2.imwrite(d["out"],np.vstack(outs),[cv2.IMWRITE_JPEG_QUALITY,92]); print("EYECMP",d["out"],ph.shape)
''', out + '.json'], capture_output=True, text=True))
