"""blender -b --python tools/r_human.py -- <params.json> <cut_ref.blend> <lm_ids_cut.json> <out_prefix>
Humano MPFB COMPLETO (topologia intacta: corpo, helpers de olhos/dentes/língua, cubos de junta) com os parâmetros
ajustados (mpfb-02.json) aplicados na base. Salva <out>.blend e <out>_base.npz com:
  V (posições base), groups (nome -> índices), lm (id MediaPipe -> índice na malha completa, remapeado da malha cortada),
  expr (nome -> deltas por vértice dos 34 alvos de expressão, em coordenadas da malha).
A topologia intacta é o que permite reaproveitar alvos de expressão, pesos e esqueleto do MPFB no rig."""
import bpy, sys, os, glob, json, gzip, addon_utils, numpy as np
a = sys.argv[sys.argv.index("--")+1:]; parf, cutb, lmf, out = a[:4]
addon_utils.enable("bl_ext.blender_org.mpfb", default_set=True, persistent=True)
from bl_ext.blender_org.mpfb.services.humanservice import HumanService
from bl_ext.blender_org.mpfb.services.targetservice import TargetService
import bl_ext.blender_org.mpfb as MP
bpy.ops.wm.read_factory_settings(use_empty=True)
macro = {"gender": 0.95, "age": 0.55, "muscle": 0.5, "weight": 0.5, "height": 0.5, "proportions": 0.5, "cupsize": 0.5, "firmness": 0.5,
         "race": {"asian": 0.1, "african": 0.1, "caucasian": 0.8}}
o = HumanService.create_human(mask_helpers=True, detailed_helpers=False, extra_vertex_groups=True, feet_on_ground=True, scale=0.1, macro_detail_dict=macro)
o.name = "Humano"; bpy.context.view_layer.objects.active = o; o.select_set(True)
TD = os.path.join(os.path.dirname(MP.__file__), 'data', 'targets')
for d in ('head','eyes','nose','mouth','cheek','chin','forehead','eyebrows','ears','neck'):
    for f in sorted(glob.glob(os.path.join(TD, d, '*.target.gz'))):
        TargetService.load_target(o, f, weight=0.0, name=os.path.basename(f).replace('.target.gz',''))
kb = o.data.shape_keys.key_blocks; names = [k.name for k in kb]
P = json.load(open(parf))['params']; nset = 0
for base, val in P.items():
    for a_, b_ in (('-incr','-decr'),('-in','-out'),('-up','-down'),('-forward','-backward'),('-convex','-concave'),('-compress','-uncompress'),('-out','-in')):
        if base + a_ in names and base + b_ in names:
            kb[base + a_].value = max(val, 0.0); kb[base + b_].value = max(-val, 0.0); nset += 1; break
    else:
        if base in names: kb[base].value = max(val, 0.0); nset += 1
        else: print("R_HUMAN parametro sem alvo:", base)
print("R_HUMAN parametros aplicados: %d de %d" % (nset, len(P)))
V0 = np.array([v.co[:] for v in o.data.vertices]); EDG = np.array([e.vertices[:] for e in o.data.edges])
o.shape_key_add(name='Fit', from_mix=True)
keys = list(o.data.shape_keys.key_blocks); V = np.array([k.co[:] for k in keys[-1].data])
o.shape_key_clear()
o.data.vertices.foreach_set('co', V.ravel()); o.data.update()
# alvos de expressão (deltas na escala da malha): carregar e ler
ED = os.path.join(TD, 'expression', 'units', 'caucasian'); expr = {}
for f in sorted(glob.glob(os.path.join(ED, '*.target.gz'))):
    nm = os.path.basename(f).replace('.target.gz', '')
    TargetService.load_target(o, f, weight=0.0, name=nm)
    k = o.data.shape_keys.key_blocks[nm]; expr[nm] = (np.array([p.co[:] for p in k.data]) - V).astype(np.float32)
o.shape_key_clear()
print("R_HUMAN expressoes:", len(expr), "max desloc (m):", {k: round(float(np.linalg.norm(v, axis=1).max()), 4) for k, v in list(expr.items())[:4]})
groups = {g.name: [] for g in o.vertex_groups}; gi = {g.index: g.name for g in o.vertex_groups}
for v in o.data.vertices:
    for g in v.groups:
        if g.weight > 0.5: groups[gi[g.group]].append(v.index)
# remapear landmarks da malha cortada (mpfb_create: apaga z < topo-0,33 e helpers, depois componentes pequenos; a ordem se mantém)
keep = (V0[:, 2] >= V0[:, 2].max() - 0.33) & (np.arange(len(V0)) < 13380)
import collections
adj = collections.defaultdict(list)
for x, y in EDG:
    if keep[x] and keep[y]: adj[x].append(y); adj[y].append(x)
comp = -np.ones(len(V0), int); cid = 0
for s0 in np.nonzero(keep)[0]:
    if comp[s0] >= 0: continue
    st = [s0]; comp[s0] = cid
    while st:
        x = st.pop()
        for y in adj[x]:
            if comp[y] < 0: comp[y] = cid; st.append(y)
    cid += 1
big = np.bincount(comp[keep]).argmax(); kept = np.nonzero(keep & (comp == big))[0]
print("R_HUMAN malha cortada reconstruida: %d vertices" % len(kept))
L = json.load(open(lmf))['vid']; lm = {k: int(kept[int(v)]) for k, v in L.items()}
np.savez(out + "_base.npz", V=V, lm_keys=np.array([int(k) for k in lm]), lm_vals=np.array(list(lm.values())),
         g_names=np.array(list(groups.keys())), g_idx=np.array([np.array(v, np.int32) for v in groups.values()], dtype=object),
         e_names=np.array(list(expr.keys())), e_d=np.stack(list(expr.values())))
bpy.ops.wm.save_as_mainfile(filepath=out + ".blend"); print("R_HUMAN salvo", len(V), "vertices,", len(groups), "grupos")
