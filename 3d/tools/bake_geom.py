"""blender -b --python tools/bake_geom.py -- <in.blend> <out_prefix> <ds> <pnp1.json> [pnp2.json ...]
Bake de posição e normal (mundo) da malha 'Busto' para EXR 32 bits no atlas UV (<out>_pos.exr, <out>_nrm.exr) e
mapa de profundidade (Z) renderizado da câmera PnP de cada foto, reduzido por <ds> (<out>_depth_<foto>.exr)."""
import bpy, sys, os, json, numpy as np
from mathutils import Matrix, Vector
a = sys.argv[sys.argv.index("--")+1:]; src, out, ds = a[0], a[1], int(a[2]); pnps = a[3:]
bpy.ops.wm.open_mainfile(filepath=src); mp = bpy.data.objects['Busto']; sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 1; sc.cycles.device = 'GPU'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'CUDA'; prefs.get_devices()
    for dv in prefs.devices: dv.use = True
except Exception as e: print("GPU pref", e)
S = 4096; mat0 = mp.data.materials[0]
def bake_attr(kind, path):
    img = bpy.data.images.new(kind, S, S, float_buffer=True, alpha=False); img.colorspace_settings.name = 'Non-Color'
    m = bpy.data.materials.new("Geo" + kind); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    g = nt.nodes.new('ShaderNodeNewGeometry'); em = nt.nodes.new('ShaderNodeEmission'); o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(g.outputs['Position' if kind == 'pos' else 'Normal'], em.inputs[0]); nt.links.new(em.outputs[0], o.inputs[0])
    ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = img; nt.nodes.active = ti; mp.data.materials[0] = m
    bk = sc.render.bake; bk.use_selected_to_active = False; bk.margin = 16
    bpy.ops.object.select_all(action='DESELECT'); mp.select_set(True); bpy.context.view_layer.objects.active = mp
    bpy.ops.object.bake(type='EMIT')
    px = np.zeros(S*S*4, np.float32); img.pixels.foreach_get(px); np.save(path, px.reshape(S, S, 4)[::-1, :, :3]); print("GEO", kind, "ok")   # linha 0 = topo (como imagem)
bake_attr('pos', out + "_pos.npy"); bake_attr('nrm', out + "_nrm.npy"); mp.data.materials[0] = mat0
# profundidade por câmera PnP: ray cast da câmera por pixel (distância euclidiana), salvo em npy
for pf in pnps:
    p = json.load(open(pf)); name = os.path.basename(pf).replace('.json', ''); W, H, f = p['w'], p['h'], p['f']
    rv = np.array(p['rvec']); th = np.linalg.norm(rv); k = rv / th; Kx = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    R = np.eye(3) + np.sin(th)*Kx + (1-np.cos(th))*(Kx @ Kx); t = np.array(p['tvec']); C = -R.T @ t
    w, h = W // ds, H // ds; D = np.full((h, w), np.inf, np.float32); Cv = Vector(C)
    for j in range(h):
        for i in range(w):
            d = np.array([((i+0.5)*ds - W/2)/f, ((j+0.5)*ds - H/2)/f, 1.0]); dw = R.T @ d
            hit, loc, _, _ = mp.ray_cast(Cv, Vector(dw), distance=5.0)
            if hit: D[j, i] = (loc - Cv).length
    np.save(out + "_depth_" + name + ".npy", D); print("DEPTH", name, w, h, "hits", int(np.isfinite(D).sum()))
