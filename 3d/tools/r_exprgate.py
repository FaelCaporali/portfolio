"""blender -b --python tools/r_exprgate.py -- <in.blend> <out_prefix> [limite_n3=20]
PORTÃO DE EXPRESSÕES. Nenhuma shape key vai para entrega sem passar aqui.
Para cada chave: (1) mede o esticamento de aresta em relação ao neutro (textura borra quando a aresta estica);
(2) renderiza a chave em 1.0 COM TEXTURA, de frente e 3/4, ao lado do neutro.
Reprova quando mais de <limite_n3> arestas esticam mais de 3x (rasgo: lábios que se separam, pálpebra com olho pintado).
Grava <out>_gate.json e os quadros <out>_<chave>.png; a folha é montada por tools/r_exprsheet.py."""
import bpy, sys, os, json, math, numpy as np
from mathutils import Vector
a = sys.argv[sys.argv.index("--")+1:]; src, out = a[0], a[1]; lim = int(a[2]) if len(a) > 2 else 20
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(src)); sc = bpy.context.scene
o = bpy.data.objects['Busto']; me = o.data; sk = me.shape_keys; kb = sk.key_blocks
if sk.animation_data: sk.animation_data_clear()
for k in kb: k.value = 0
for x_ in bpy.data.objects:
    if x_.type == 'MESH' and x_.data.shape_keys:
        for k_ in x_.data.shape_keys.key_blocks: k_.value = 0
n = len(me.vertices)
def co(k):
    v = np.empty(n*3, np.float32); k.data.foreach_get('co', v); return v.reshape(-1, 3)
B = co(kb[0]); E = np.empty(len(me.edges)*2, np.int32); me.edges.foreach_get('vertices', E); E = E.reshape(-1, 2)
L0 = np.linalg.norm(B[E[:, 0]]-B[E[:, 1]], axis=1); ok = L0 > 1e-6
wall = np.zeros(n, bool)                                            # paredes internas das pálpebras não têm textura: fora da medida
for g_ in o.vertex_groups:
    if g_.name.startswith('borda_'):
        for v_ in me.vertices:
            if any(x.group == g_.index for x in v_.groups): wall[v_.index] = True
ok &= ~wall[E[:, 0]] & ~wall[E[:, 1]]
for ob in list(sc.objects):
    if ob.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(ob)
for e_ in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):                 # EEVEE: mostra a transparência da sombra dos olhos
    try: sc.render.engine = e_; break
    except TypeError: pass
for m_ in bpy.data.materials:                                       # pele sem luz de cena: a luz do scan está assada na textura
    if not m_.use_nodes or any(n_.type == 'EMISSION' for n_ in m_.node_tree.nodes): continue
    t_ = next((n_ for n_ in m_.node_tree.nodes if n_.type == 'TEX_IMAGE'), None); o_ = next((n_ for n_ in m_.node_tree.nodes if n_.type == 'OUTPUT_MATERIAL'), None)
    if t_ and o_:
        em_ = m_.node_tree.nodes.new('ShaderNodeEmission'); m_.node_tree.links.new(t_.outputs['Color'], em_.inputs['Color']); m_.node_tree.links.new(em_.outputs[0], o_.inputs['Surface'])
for mv_ in bpy.data.materials:                                       # material de exportação com cor por vértice (conjuntiva) vira emissão para a conferência
    if mv_.use_nodes and mv_.name == 'Conjuntiva' and not any(n_.type == 'EMISSION' for n_ in mv_.node_tree.nodes):
        vc_ = next(n_ for n_ in mv_.node_tree.nodes if n_.type == 'VERTEX_COLOR'); oo_ = next(n_ for n_ in mv_.node_tree.nodes if n_.type == 'OUTPUT_MATERIAL')
        ee_ = mv_.node_tree.nodes.new('ShaderNodeEmission'); at_ = mv_.node_tree.nodes.new('ShaderNodeAttribute'); at_.attribute_type = 'GEOMETRY'; at_.attribute_name = vc_.layer_name; mv_.node_tree.links.new(at_.outputs['Color'], ee_.inputs['Color'])   # nó Attribute: com o nó Color Attribute o EEVEE não aplica a sombra transparente por cima (S11); mv_.node_tree.links.new(ee_.outputs[0], oo_.inputs['Surface'])
sc.view_settings.view_transform = 'Standard'; sc.render.film_transparent = False
if sc.world: sc.world.use_nodes = False; sc.world.color = (1, 1, 1)
OTHERS = [x for x in bpy.data.objects if x.type == 'MESH' and x is not o and x.data.shape_keys]
def setkey(name, v):
    for x in [o] + OTHERS:
        kb_ = x.data.shape_keys.key_blocks
        if name in kb_: kb_[name].value = v
sc.render.resolution_x, sc.render.resolution_y = 520, 640
zc = float(np.percentile(B[:, 2], 50))
cams = []
for nm, ang in (('f', 0), ('q', 35)):
    c = bpy.data.objects.new('C'+nm, bpy.data.cameras.new('C'+nm)); sc.collection.objects.link(c)
    c.data.type = 'ORTHO'; c.data.ortho_scale = 0.235
    r = math.radians(ang); c.location = Vector((math.sin(r)*1.0, -math.cos(r)*1.0 + 0.10, 0.168))
    c.rotation_euler = (math.radians(90), 0, r); cams.append((nm, c))
def shot(tag):
    for nm, c in cams:
        sc.camera = c; sc.render.filepath = f"{out}_{tag}_{nm}.png"; bpy.ops.render.render(write_still=True)
shot('neutro'); res = {}
for k in kb[1:]:
    D = co(k); r = np.linalg.norm(D[E[:, 0]]-D[E[:, 1]], axis=1)[ok]/L0[ok]
    n3 = int((r > 3).sum()); n15 = int((r > 1.5).sum())
    res[k.name] = dict(dmax_mm=float(np.linalg.norm(D-B, axis=1).max()*1000), rmax=float(r.max()), n15=n15, n3=n3, passa=bool(n3 <= lim))
    setkey(k.name, 1.0); shot(k.name); setkey(k.name, 0.0)
json.dump(res, open(out + '_gate.json', 'w'), indent=1)
for k, v in res.items(): print("GATE %-30s %s  >3x %5d  >1.5x %5d  rmax %5.1f  desloc %4.1f mm" % (k, 'PASSA   ' if v['passa'] else 'REPROVA ', v['n3'], v['n15'], v['rmax'], v['dmax_mm']))
