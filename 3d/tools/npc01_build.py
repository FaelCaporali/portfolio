"""blender -b --python tools/npc01_build.py -- <out.blend> [until=estilo|partes|rig|chaves|fim]
NPC01: personagem cartoon riggado do Fael. Etapas:
  base   humano MPFB2 completo com os parametros faciais medidos (blend/mpfb-02.json) assados
  estilo campo de deformacao numpy: cabeca 1:5,5 do corpo, olhos maiores, nariz e maos, aplicado tambem aos alvos de expressao
  rig    esqueleto 'default' do MPFB ajustado aos cubos de junta (ja estilizados) + pesos do MPFB
  partes olhos (esferas com iris por cor de vertice), dentes (helpers), barba, bigode, cabelo+coque, sobrancelhas, camiseta, calca, tenis
         (cascas fechadas geradas em numpy a partir de regioes da malha), cores toon por vertice, contorno por casca invertida
  chaves chaves de forma ARKit em corpo, barba, sobrancelhas, cabelo, dentes de baixo e contorno
Tudo sem modificadores (so Armature), para as chaves sobreviverem ao glb."""
import bpy, sys, os, glob, json, math, addon_utils, numpy as np
from mathutils import Vector, kdtree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from npc01_lib import *
a = sys.argv[sys.argv.index("--") + 1:]; out = a[0]; opts = dict(x.split('=') for x in a[1:]); until = opts.get('until', 'fim')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
addon_utils.enable("bl_ext.blender_org.mpfb", default_set=True, persistent=True)
from bl_ext.blender_org.mpfb.services.humanservice import HumanService
from bl_ext.blender_org.mpfb.services.targetservice import TargetService
import bl_ext.blender_org.mpfb as MP
bpy.ops.wm.read_factory_settings(use_empty=True)
S = json.load(open(os.path.join(ROOT, 'tools', 'npc01_style.json')))   # parametros de estilo

# ---------------- base ----------------
macro = {"gender": 0.95, "age": 0.55, "muscle": 0.55, "weight": 0.45, "height": 0.5, "proportions": 0.6, "cupsize": 0.5, "firmness": 0.5,
         "race": {"asian": 0.1, "african": 0.1, "caucasian": 0.8}}
o = HumanService.create_human(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True, feet_on_ground=True, scale=0.1, macro_detail_dict=macro)
o.name = "MPFB"; bpy.context.view_layer.objects.active = o; o.select_set(True)
TD = os.path.join(os.path.dirname(MP.__file__), 'data', 'targets')
for d in ('head', 'eyes', 'nose', 'mouth', 'cheek', 'chin', 'forehead', 'eyebrows', 'ears', 'neck'):
    for f in sorted(glob.glob(os.path.join(TD, d, '*.target.gz'))):
        TargetService.load_target(o, f, weight=0.0, name=os.path.basename(f).replace('.target.gz', ''))
kb = o.data.shape_keys.key_blocks; names = [k.name for k in kb]
P = json.load(open(os.path.join(ROOT, 'blend', 'mpfb-02.json')))['params']; P.update(S.get('mpfb_extra', {})); nset = 0
for base, val in P.items():
    for a_, b_ in (('-incr', '-decr'), ('-in', '-out'), ('-up', '-down'), ('-forward', '-backward'), ('-convex', '-concave'), ('-compress', '-uncompress'), ('-out', '-in')):
        if base + a_ in names and base + b_ in names:
            kb[base + a_].value = max(val, 0.0); kb[base + b_].value = max(-val, 0.0); nset += 1; break
    else:
        if base in names: kb[base].value = max(val, 0.0); nset += 1
        else: print("NPC01 parametro sem alvo:", base)
print("NPC01 parametros aplicados: %d de %d" % (nset, len(P)))
o.shape_key_add(name='Fit', from_mix=True)
V0 = np.array([k.co[:] for k in o.data.shape_keys.key_blocks[-1].data]); o.shape_key_clear()
o.data.vertices.foreach_set('co', V0.ravel()); o.data.update()
polys = [list(p.vertices) for p in o.data.polygons]; T = tri_list(polys); NV = len(V0)
G = {}
for g in o.vertex_groups:
    G[g.name] = np.zeros(NV, bool)
for v in o.data.vertices:
    for g in v.groups: G[o.vertex_groups[g.group].name][v.index] = True
body = np.arange(NV) < 13380
# alvos de expressao (deltas na malha ajustada)
ED = os.path.join(TD, 'expression', 'units', 'caucasian'); E = {}
for f in sorted(glob.glob(os.path.join(ED, '*.target.gz'))):
    nm = os.path.basename(f).replace('.target.gz', '')
    TargetService.load_target(o, f, weight=0.0, name=nm)
    E[nm] = np.array([p.co[:] for p in o.data.shape_keys.key_blocks[nm].data]) - V0
o.shape_key_clear()
def side(delta, sign, width=0.008):
    w = smoothstep(-width, width, sign * V0[:, 0]); return delta * w[:, None]
ARKIT = {
    'mouthSmileLeft': side(E['mouth-corner-puller'], +1), 'mouthSmileRight': side(E['mouth-corner-puller'], -1),
    'mouthFrownLeft': side(E['mouth-depression'], +1), 'mouthFrownRight': side(E['mouth-depression'], -1),
    'browInnerUp': E['eyebrows-left-inner-up'] + E['eyebrows-right-inner-up'],
    'browOuterUpLeft': E['eyebrows-left-extern-up'], 'browOuterUpRight': E['eyebrows-right-extern-up'],
    'browDownLeft': E['eyebrows-left-down'], 'browDownRight': E['eyebrows-right-down'],
    'eyeBlinkLeft': E['eye-left-closure'], 'eyeBlinkRight': E['eye-right-closure'],
    'eyeSquintLeft': E['eye-left-slit'], 'eyeSquintRight': E['eye-right-slit'],
    'eyeWideLeft': E['eye-left-opened-up'], 'eyeWideRight': E['eye-right-opened-up'],
    'jawOpen': E['mouth-open'], 'mouthPucker': E['mouth-pursing'], 'mouthFunnel': E['mouth-protusion'],
    'mouthPressLeft': side(E['mouth-compression'], +1), 'mouthPressRight': side(E['mouth-compression'], -1),
    'noseSneerLeft': E['nose-left-elevation'], 'noseSneerRight': E['nose-right-elevation'],
    'mouthShrugUpper': E['mouth-elevation'], 'mouthRollLower': E['mouth-eversion'],
}
for k in list(ARKIT): ARKIT[k] = ARKIT[k] * S.get('key_gain', {}).get(k, 1.0)
print("NPC01 chaves:", len(ARKIT))

# ---------------- estilo: campo de deformacao F ----------------
eyeL0, eyeR0 = V0[G['helper-l-eye']].mean(0), V0[G['helper-r-eye']].mean(0)
lips0 = V0[G['lips']]; mouth0 = lips0.mean(0)
nose_tip0 = V0[body][np.argmin(V0[body][:, 1] + 0 * V0[body][:, 2])] if False else None
HS = S['head_scale']; piv = np.array([0.0, -0.01, S['head_pivot_z']])
def F(X):
    X = np.asarray(X, float).copy()
    w = smoothstep(S['head_pivot_z'] - 0.04, S['head_pivot_z'] + 0.07, X[:, 2]); s = 1 + (HS - 1) * w
    Y = piv + (X - piv) * s[:, None]
    # cranio mais cheio (toon): infla x,y acima dos olhos; rosto um pouco mais largo em x
    ez = piv[2] + (eyeL0[2] - piv[2]) * HS; wc = smoothstep(ez - 0.02, ez + 0.10, Y[:, 2]) * (Y[:, 2] > piv[2])
    cc = np.array([0, piv[1] + (eyeL0[1] + 0.09 - piv[1]) * HS, ez])
    Y[:, :2] += (S['cranium_scale'] - 1) * wc[:, None] * (Y[:, :2] - cc[:2])
    wf_ = smoothstep(piv[2] + 0.02, piv[2] + 0.12, Y[:, 2]) * (1 - smoothstep(ez + 0.02, ez + 0.10, Y[:, 2]))
    Y[:, 0] *= 1 + (S['face_width'] - 1) * wf_
    # olhos maiores (no plano xz, ao redor de cada centro ja escalado)
    for c0 in (eyeL0, eyeR0):
        c = piv + (c0 - piv) * HS; r = np.linalg.norm(Y - c, axis=1)
        we = 1 - smoothstep(S['eye_r0'], S['eye_r1'], r)
        d = (Y - c) * np.array([1, 0, 1]); Y += (S['eye_scale'] - 1) * we[:, None] * d
    # nariz: ponta para frente e um pouco maior
    nc = piv + (np.array([0, mouth0[1] - 0.02, (mouth0[2] + eyeL0[2]) / 2]) - piv) * HS
    rn = np.linalg.norm((Y - nc) * np.array([1.6, 1, 1]), axis=1); wn = 1 - smoothstep(S['nose_r0'], S['nose_r1'], rn)
    Y[:, 1] -= S['nose_push'] * wn; Y += (S['nose_scale'] - 1) * wn[:, None] * (Y - nc)
    # maos e pes maiores
    for sgn in (1, -1):
        wc = np.array([sgn * 0.44, 0, 1.05]); rw = np.linalg.norm(Y - wc, axis=1); ww = 1 - smoothstep(0.04, 0.09, rw)
        Y[Y[:, 2] < 1.06] += 0   # (ponto de referencia; pulso em z~1.06)
        m = (np.abs(Y[:, 0]) > 0.40) & (Y[:, 2] < 1.08); wh = smoothstep(0.40, 0.445, np.abs(Y[:, 0]) * (Y[:, 2] < 1.1))
        Y += (S['hand_scale'] - 1) * wh[:, None] * (Y - wc) * (np.sign(Y[:, 0]) == sgn)[:, None]
    wf = 1 - smoothstep(0.06, 0.12, Y[:, 2]); fc = np.array([0, 0, 0]); Y[:, 0] += (S['foot_scale'] - 1) * wf * (Y[:, 0] - 0)
    Y[:, 1] += (S['foot_scale'] - 1) * wf * (Y[:, 1] - 0.0)
    return Y
NM = S.get('neutral_mix', {})                                   # ex.: eyeWide 0,3 no neutro (íris à mostra; a foto não é "sonolenta")
if NM:
    dmix = sum(ARKIT[k] * w for k, w in NM.items()); V0 = V0 + dmix
    for k in ARKIT: ARKIT[k] = ARKIT[k] - sum(ARKIT[j] * w for j, w in NM.items() if j == k)   # a própria chave só completa o resto
V = F(V0); o.data.vertices.foreach_set('co', V.ravel()); o.data.update()
eyeL, eyeR = V[G['helper-l-eye']].mean(0), V[G['helper-r-eye']].mean(0); eye_r = (V[G['helper-l-eye']][:, 0].max() - V[G['helper-l-eye']][:, 0].min()) / 2
head_top = V[body][:, 2].max(); chin = 0.0  # definido depois do rig (cauda do osso jaw)
print("NPC01 altura %.3f cabeca %.3f (1:%.2f) olho r=%.4f centros %s %s queixo %.3f" % (V[body][:, 2].max(), head_top - chin, V[body][:, 2].max() / (head_top - chin), eye_r, eyeL.round(3), eyeR.round(3), chin))
KEYS = {k: F(V0 + d) for k, d in ARKIT.items()}   # posicoes absolutas por chave, malha completa
N = vertex_normals(V, T)

# ---------------- rig ----------------
arm = HumanService.add_builtin_rig(o, 'default', import_weights=True); arm.name = arm.data.name = 'NPC01.rig'
chin = float(arm.data.bones['jaw'].tail_local[2]); print("NPC01 queixo (cauda do jaw) z=%.3f cabeca %.3f (1:%.2f)" % (chin, head_top - chin, V[body][:, 2].max() / (head_top - chin)))
W = get_weights(o); print("NPC01 rig ossos %d grupos com peso %d" % (len(arm.data.bones), len(W)))
Wbody = {k: w[body] for k, w in W.items() if w[body].max() > 0}
body_polys = [p for p in polys if all(i < 13380 for i in p)]
kd = kdtree.KDTree(13380)
for i in range(13380): kd.insert(V[i], i)
kd.balance()
def nearest_body(X): return np.array([kd.find(tuple(x))[1] for x in X])
def weights_from(src):
    return {k: w[src] for k, w in Wbody.items() if w[src].max() > 0}

# ---------------- partes ----------------
col = {k: srgb(v) for k, v in S['colors'].items()}
parts = {}   # nome -> dict(V, polys, keys{name:V}, W, color(n,3), outline bool)
# corpo
Cb = np.tile(col['skin'], (13380, 1))
lipm = G['lips'][body] & (V[body][:, 2] < (piv + (mouth0 - piv) * HS)[2] + 0.002); Cb[lipm] = col['lips']
zmouth = mouth0[2] * 1 ; mc = piv + (mouth0 - piv) * HS
teeth_y = V[G['helper-upper-teeth']][:, 1].mean()
inner = body & (np.abs(V[:, 0]) < 0.05) & (np.abs(V[:, 2] - mc[2]) < 0.022) & (V[:, 1] > teeth_y + 0.002) & (V[:, 1] < mc[1] + 0.10)
Cb[inner[body]] = col['mouth']
for c_ in (eyeL, eyeR):   # olheiras: tom um pouco mais escuro sob os olhos
    Vb_ = V[body]; e_ = np.sqrt(((Vb_[:, 0] - c_[0]) / 0.03) ** 2 + ((Vb_[:, 2] - (c_[2] - 0.021)) / 0.012) ** 2)
    w_ = (1 - smoothstep(0.6, 1.0, e_)) * (Vb_[:, 1] < c_[1] + 0.03); Cb = Cb * (1 - S['olheira'] * w_[:, None]) + (Cb * np.array([0.8, 0.7, 0.7])) * (S['olheira'] * w_[:, None])
parts['NPC01'] = dict(V=V[body], polys=body_polys, keys={k: KEYS[k][body] for k in KEYS}, W=Wbody, color=Cb, outline=True)
# olhos: esfera com polo em -Y e textura procedural (iris/pupila/brilho) em funcao de v
eye_img = bpy.data.images.new('npc01_eye', 512, 512); px = np.zeros((512, 512, 4)); px[..., 3] = 1
vv = (np.arange(512)[:, None] + 0.5) / 512; uu = (np.arange(512)[None, :] + 0.5) / 512
ang = (1 - vv) * 180 * np.ones_like(uu)
px[..., :3] = col['sclera']
px[ang < S['iris_deg'], :3] = col['iris'] * (0.7 + 0.6 * (ang[ang < S['iris_deg']] / S['iris_deg']) ** 2)[:, None] * np.array([1.0, 0.9, 0.8])
px[(ang < S['iris_deg']) & (ang > S['iris_deg'] - 2.5), :3] = col['iris'] * 0.35
px[ang < S['pupil_deg'], :3] = col['pupil']
hl = np.sqrt(((ang - 9) / 4.5) ** 2 + ((np.mod(uu - 0.62 + 0.5, 1) - 0.5) * 2 * np.pi * np.sin(np.radians(ang)) / 0.16) ** 2 * (180 / np.pi) ** 2 * 0 + ((np.mod(uu - 0.62 + 0.5, 1) - 0.5) / 0.10) ** 2)
px[hl < 1, :3] = 1.0
eye_img.pixels.foreach_set(px.ravel().astype(np.float32))
os.makedirs(os.path.join(ROOT, 'export', 'npc01'), exist_ok=True); eye_img.filepath_raw = os.path.join(ROOT, 'export', 'npc01', 'npc01_eye.png'); eye_img.file_format = 'PNG'; eye_img.save()
bpy.data.images.remove(eye_img); eye_img = bpy.data.images.load(os.path.join(ROOT, 'export', 'npc01', 'npc01_eye.png')); eye_img.name = 'npc01_eye'
for nm, c, bone in (('Eye.L', eyeL, 'eye.L'), ('Eye.R', eyeR, 'eye.R')):
    r = eye_r * S['eyeball_scale']; bm = bmesh.new(); bm.loops.layers.uv.verify(); bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=r, calc_uvs=True)
    me = bpy.data.meshes.new(nm); bm.to_mesh(me); bm.free()
    Vs = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('co', Vs); Vs = Vs.reshape(-1, 3)
    Vs = np.stack([Vs[:, 0], -Vs[:, 2], Vs[:, 1]], 1)   # polo +Z -> -Y (frente)
    me.vertices.foreach_set('co', (Vs + c + np.array([0, S['eyeball_back'], 0])).ravel())
    for p_ in me.polygons: p_.use_smooth = True
    ob = bpy.data.objects.new(nm, me); bpy.context.scene.collection.objects.link(ob)
    parts[nm] = dict(obj=ob, V=Vs, polys=[], keys={}, W={bone: np.ones(len(Vs))}, color=np.tile(col['sclera'], (len(Vs), 1)), outline=False, no_shade=True)
# dentes (helpers do MPFB)
for nm, grp, bone in (('Teeth.U', 'helper-upper-teeth', 'head'), ('Teeth.L', 'helper-lower-teeth', 'jaw')):
    src = np.nonzero(G[grp])[0]; loc = {int(s): i for i, s in enumerate(src)}
    Pp = [[loc[i] for i in p] for p in polys if all(G[grp][i] for i in p)]
    keys = {}
    if nm == 'Teeth.L':   # dentes de baixo seguem o queixo: transformacao rigida estimada (Procrustes) nas chaves da boca
        chinm = body & (np.abs(V[:, 0]) < 0.03) & (V[:, 2] < mc[2] - 0.02) & (V[:, 2] > mc[2] - 0.07) & (V[:, 1] < mc[1] + 0.03)
        A0 = V[chinm]; ca = A0.mean(0)
        for k in KEYS:
            B0 = KEYS[k][chinm]; cb = B0.mean(0)
            if np.linalg.norm(B0 - A0, axis=1).max() < 1e-4: continue
            U, s_, Vt = np.linalg.svd((B0 - cb).T @ (A0 - ca)); R = U @ Vt
            if np.linalg.det(R) < 0: U[:, -1] *= -1; R = U @ Vt
            keys[k] = (V[src] - ca) @ R.T + cb
    parts[nm] = dict(V=V[src], polys=Pp, keys=keys, W={bone: np.ones(len(src))}, color=np.tile(col['teeth'], (len(src), 1)), outline=False)

# regioes na cabeca (coordenadas ja estilizadas)
front = N[:, 1] < -0.15
zb = (eyeL[2] + eyeR[2]) / 2; xe = abs(eyeL[0]); ears = G['ears']
earc = V[ears & (V[:, 0] > 0)].mean(0)
# barba + bigode: abaixo de uma linha que vai da base do nariz (centro) ate o lobulo da orelha (lado)
nose_base_z = mc[2] + S['beard_line_center']; 
def beard_line(x): return nose_base_z + (earc[2] - 0.02 - nose_base_z) * smoothstep(0.02, xe * 2.2, np.abs(x))
MF = S.get('mouth_free', [0.034, 0.017, -0.006]); mouth_free = 1 - np.sqrt(((V[:, 0]) / MF[0]) ** 2 + ((V[:, 2] - (mc[2] + MF[2])) / MF[1]) ** 2)   # elipse da boca (>0 dentro)
nose_free = 1 - np.sqrt(((V[:, 0]) / 0.03) ** 2 + (np.clip(mc[2] + 0.03 - V[:, 2], 0, None) / 0.012) ** 2)
fbeard = np.minimum.reduce([beard_line(V[:, 0]) - V[:, 2], earc[1] + 0.005 - V[:, 1], -mouth_free, np.where(V[:, 1] < mc[1] + 0.02, -nose_free, 1.0)])
beardm = body & (fbeard > 0) & ((V[:, 2] > chin - 0.012) | ((N[:, 2] < -0.35) & (V[:, 2] > chin - 0.06))) & ~inner & ~G['lips'] & ~G['ears']
adj = adjacency(NV, polys)
def thick_field(mask, tmax, edge=0.002, iters=6):
    t = np.where(mask, tmax, 0.0); ring = mask & np.array([any(not mask[j] for j in adj[i]) for i in range(NV)])
    t[ring] = edge; return laplacian_smooth(t[:, None], adj, iters=iters, lam=0.6, mask=mask)[:, 0]
tb = thick_field(beardm, S['beard_thick'])
# volume extra sob o queixo (barba longa): mais espessura onde a normal aponta para baixo
under = np.clip(-N[:, 2], 0, 1) * beardm; tb += S['beard_chin_extra'] * laplacian_smooth((under * smoothstep(-0.03, 0.02, mc[1] - V[:, 1]))[:, None], adj, 4, 0.6)[:, 0]
tb += S['mustache_extra'] * beardm * (V[:, 2] > mc[2] - 0.004) * (1 - smoothstep(0.035, 0.06, np.abs(V[:, 0])))   # bigode mais cheio
tb = laplacian_smooth(tb[:, None], adj, 3, 0.5, beardm)[:, 0]
# barba longa: puxa para baixo/frente a parte sob o queixo, afunilando (ponta) — deslocamento extra na camada externa
gb = beardm * smoothstep(chin + 0.05, chin - 0.01, V[:, 2]) * (1 - smoothstep(0.03, 0.075, np.abs(V[:, 0]))) * (V[:, 1] < mc[1] + 0.09)
gb = laplacian_smooth(gb[:, None], adj, 4, 0.6)[:, 0]
beard_disp = np.zeros_like(V); beard_disp[:, 2] = -S['beard_len'] * gb; beard_disp[:, 1] = -S['beard_len'] * 0.25 * gb
def clip_polys(mask, f, allowed):
    """poligonos com algum vertice na regiao (mask) e todos os vertices permitidos; vertices de fora sao puxados ate a isolinha f=0
    (ao longo do segmento para o co-vertice de dentro com maior f). Retorna (polys, deslocamento por vertice, mascara estendida)."""
    ps = [p for p in polys if any(mask[i] for i in p) and all(allowed[i] for i in p)]
    D = np.zeros_like(V); ext = np.zeros(NV, bool); best = {}
    for p in ps:
        ins = [i for i in p if mask[i]]
        for i in p:
            ext[i] = True
            if mask[i]: continue
            u = max(ins, key=lambda u: f[u])
            if f[u] <= f[i]: continue
            t = -f[i] / (f[u] - f[i]) if f[i] < 0 else 0.0
            if i not in best or t < best[i][0]: best[i] = (t, u)
    for i, (t, u) in best.items(): D[i] = (V[u] - V[i]) * min(t, 0.98)
    return ps, D, ext
def make_part(nm, mask, tmax, color, field, allowed=None, keys=True, smooth=3, disp=None, edge=0.002, inner=0.0015, weights_nearest=False, outline=True):
    allowed = body if allowed is None else allowed
    ps, D, ext = clip_polys(mask, field, allowed); src = sorted(set(i for p in ps for i in p))
    thick = np.where(mask, tmax, edge) if np.isscalar(tmax) else np.where(mask, tmax, edge)
    thick = laplacian_smooth(thick[:, None], adj, iters=2, lam=0.5, mask=mask)[:, 0]
    Vs, Pp, sov = shell(V + D, N, ps, src, thick, smooth=smooth, disp=disp, inner=inner)
    K = {}
    if keys:
        for k in KEYS:
            Nk = vertex_normals(KEYS[k], T); Vk, _, _ = shell(KEYS[k] + D, Nk, ps, src, thick, smooth=smooth, disp=disp, inner=inner)
            if np.linalg.norm(Vk - Vs, axis=1).max() > 1e-4: K[k] = Vk
    Wp = weights_from(nearest_body(Vs)) if weights_nearest else weights_from(sov)
    parts[nm] = dict(V=Vs, polys=Pp, keys=K, W=Wp, color=np.tile(color, (len(Vs), 1)), outline=outline)
    print("NPC01 parte %-10s verts %5d faces %5d chaves %d" % (nm, len(Vs), len(Pp), len(K)))
beard_allowed = body & ((V[:, 2] > chin - 0.012) | ((N[:, 2] < -0.2) & (V[:, 2] > chin - 0.09))) & ~inner & ~G['lips']
make_part('Beard', beardm, tb, col['hair'], fbeard, allowed=beard_allowed, disp=beard_disp, edge=0.003)
# sobrancelhas: barra sobre a arcada
browz = zb + S['brow_dz']; bz = browz + S['brow_slope'] * (np.abs(V[:, 0]) - xe)
tap = 1 - S.get('brow_taper', 0.45) * smoothstep(0.7 * xe, xe + S['brow_x1'], np.abs(V[:, 0]))   # ponta externa mais fina
bz = bz + S.get('brow_arch', 0.006) * np.exp(-((np.abs(V[:, 0]) - 0.75 * xe) / (0.35 * xe)) ** 2)     # arco sobre o terço externo
fbrow = np.minimum.reduce([S['brow_h'] * tap - np.abs(V[:, 2] - bz), np.abs(V[:, 0]) - S['brow_x0'] * xe, xe + S['brow_x1'] - np.abs(V[:, 0])])
brow = body & front & (fbrow > 0)
print("NPC01 brow verts", brow.sum(), "beard verts", beardm.sum(), "chin", chin); make_part('Brows', brow, S['brow_thick'], col['hair'], fbrow, allowed=body & front, edge=0.0015)
# cabelo: couro cabeludo do MPFB, linha frontal alta com entradas
scalp = G['scalp'] & body
z_hl = browz + S['forehead_h'] + S['hairline_recess'] * smoothstep(0.045, 0.085, np.abs(V[:, 0]))   # linha do cabelo: testa alta, entradas em M
hcy = (eyeL[1] + eyeR[1]) / 2 + 0.07
f_front = np.where(V[:, 1] < earc[1] - 0.01, V[:, 2] - z_hl, 1.0)   # testa: abaixo da linha do cabelo nao ha cabelo
y_b = (earc[1] - S['temple_y']) - (V[:, 2] - (earc[2] + 0.02)) * S['temple_slope']   # fronteira diagonal: sobe para a frente ate a linha do cabelo
f_temple = np.where(V[:, 2] < earc[2] + 0.02, V[:, 1] - (earc[1] + 0.012), V[:, 1] - y_b)   # lateral: sem cabelo a frente da orelha
f_temple = np.where(np.abs(V[:, 0]) < S['temple_x'], 1.0, f_temple)
f_front = np.where((np.abs(V[:, 0]) > S['temple_x']) & (V[:, 2] < z_hl), f_temple, f_front)   # lateral acima da orelha: manda a fronteira em y
fhair = np.minimum(f_front, f_temple)
hairm = body & (V[:, 2] > head_top - S['hair_side_z']) & (V[:, 2] > earc[2] - 0.01) & (fhair > 0) & ~ears
make_part('Hair', hairm, S['hair_thick'], col['hair'], fhair, allowed=body & (V[:, 2] > earc[2] - 0.01) & ~ears, edge=0.003)
# coque atras
bun_c = np.array([0, V[body & (np.abs(V[:, 0]) < 0.02) & (np.abs(V[:, 2] - (earc[2] + S['bun_dz'])) < 0.02)][:, 1].max() + S['bun_r'] * 0.85, earc[2] + S['bun_dz']])
bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=S['bun_r'])
Vb = np.array([v.co[:] for v in bm.verts]) * np.array([1.0, 0.85, 0.9]); Pb = [[v.index for v in f.verts] for f in bm.faces]; bm.free()
parts['Bun'] = dict(V=Vb + bun_c, polys=Pb, keys={}, W={'head': np.ones(len(Vb))}, color=np.tile(col['hair'], (len(Vb), 1)), outline=True)
# roupa: helper-tights do MPFB
tg = G['helper-tights']; zt = V[:, 2]; rr = np.sqrt(V[:, 0] ** 2 + (V[:, 1] + 0.02) ** 2)
f_shirt = np.minimum.reduce([zt - S['shirt_hem_z'], np.maximum(rr - 0.075, S['collar_z'] - zt), np.maximum(S['sleeve_x'] - np.abs(V[:, 0]), zt - 1.30)])
f_pants = np.minimum(S['shirt_hem_z'] + 0.03 - zt, zt - S['shoe_z']); f_shoes = S['shoe_z'] + 0.015 - zt
for nm, f, t, c in (('Shirt', f_shirt, S['shirt_thick'], col['shirt']), ('Pants', f_pants, S['pants_thick'], col['pants']), ('Shoes', f_shoes, S['shoe_thick'], col['shoes'])):
    make_part(nm, tg & (f > 0), t, c, f, allowed=tg, keys=False, smooth=2, edge=t * 0.7, inner=0.004, weights_nearest=True)
# contorno: casca invertida de todas as partes com outline
def outline_of(Vp, Pp, t):
    Tn = tri_list(Pp); Nn = vertex_normals(Vp, Tn); return Vp + Nn * t
OV, OP, OW, OK_, off = [], [], {}, {}, 0
allkeys = sorted(set(k for p in parts.values() for k in p['keys']))
for nm, p in parts.items():
    if not p['outline']: continue
    t = S['outline_head'] if nm in ('NPC01', 'Beard', 'Brows', 'Hair', 'Bun') else S['outline_body']
    if nm == 'NPC01':
        Vp = p['V']; bare = (Vp[:, 2] > S['head_pivot_z'] - 0.02) | ((np.abs(Vp[:, 0]) > S['sleeve_x'] + 0.01) & (Vp[:, 2] < 1.32))
        t = np.where(Vp[:, 2] > S['head_pivot_z'], S['outline_head'], S['outline_body'])[:, None] * bare[:, None]
    OV.append(outline_of(p['V'], p['polys'], t)); OP += [[i + off for i in q[::-1]] for q in p['polys']]
    for k, w in p['W'].items(): OW.setdefault(k, []).append((off, w))
    for k in allkeys: OK_.setdefault(k, []).append(outline_of(p['keys'][k], p['polys'], t) if k in p['keys'] else OV[-1])
    off += len(p['V'])
OVc = np.concatenate(OV); Wo = {}
for k, lst in OW.items():
    w = np.zeros(off)
    for o_, ww in lst: w[o_:o_ + len(ww)] = ww
    Wo[k] = w
parts['Outline'] = dict(V=OVc, polys=OP, keys={k: np.concatenate(v) for k, v in OK_.items()}, W=Wo, color=np.zeros((off, 3)), outline=False, is_outline=True)

# ---------------- objetos Blender ----------------
mat_toon = toon_material('NPC01_toon'); mat_flat = toon_material('NPC01_flat', ramp=((0.0, 0.85), (0.3, 1.0), (0.9, 1.0))); mat_out = toon_material('NPC01_outline', outline=True)
for m in (mat_toon, mat_flat, mat_out): m.use_backface_culling = True
objs = {}
mat_eye = toon_material('NPC01_eye', ramp=((0.0, 0.85), (0.3, 1.0), (0.9, 1.0)), use_vcol=False, image=eye_img)
for nm, p in parts.items():
    ob = p.get('obj') or new_mesh_object(nm, p['V'], p['polys']); set_vcolor(ob, p['color'])
    ob.data.materials.append(mat_out if p.get('is_outline') else (mat_eye if p.get('no_shade') else mat_toon))
    set_weights(ob, p['W']); ob.parent = arm; md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = arm
    if p['keys']: add_shape_keys(ob, {k: p['keys'][k] for k in allkeys if k in p['keys']})
    objs[nm] = ob
# apagar o objeto MPFB de trabalho (helpers, cubos de junta): tudo ja foi extraido
bpy.data.objects.remove(o, do_unlink=True)
for ob in list(bpy.data.objects):
    if ob.type == 'MESH' and ob.name not in objs: bpy.data.objects.remove(ob, do_unlink=True)
npc = objs['NPC01']; npc['head_center'] = [0.0, float((eyeL[1] + eyeR[1]) / 2 + 0.06), float((chin + head_top) / 2)]; npc['head_radius'] = float((head_top - chin) * 0.62)
# olhos e dentes: pais nos ossos ja via pesos; rig nao mostra em frente
arm.show_in_front = False; arm.data.display_type = 'OCTAHEDRAL'
bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=out); print("NPC01 salvo", out)
# etapas finais (opcionais): glb=<caminho> exporta; sheets=<tmpdir> gera as folhas em analise/clay
import subprocess
if 'glb' in opts: subprocess.run(['blender', '-b', out, '--python', os.path.join(ROOT, 'tools', 'npc01_export.py'), '--', opts['glb']], check=True, stdout=subprocess.DEVNULL)
if 'sheets' in opts: subprocess.run(['bash', os.path.join(ROOT, 'tools', 'npc01_sheets.sh'), out, opts['sheets']], check=True, cwd=ROOT)
