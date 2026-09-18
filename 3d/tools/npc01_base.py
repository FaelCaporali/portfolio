"""blender -b --python tools/npc01_base.py -- <out.blend>
NPC01 etapa 1: humano MPFB2 completo (corpo + helpers + cubos de junta, topologia intacta), com os parametros faciais
medidos do Fael (blend/mpfb-02.json) assados na base, e os alvos de expressao do MPFB carregados como shape keys com
nomes ARKit (chaves bilaterais divididas em esquerda/direita por mascara suave no eixo X). Tudo com peso 0."""
import bpy, sys, os, glob, json, addon_utils, numpy as np
out = sys.argv[sys.argv.index("--") + 1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
addon_utils.enable("bl_ext.blender_org.mpfb", default_set=True, persistent=True)
from bl_ext.blender_org.mpfb.services.humanservice import HumanService
from bl_ext.blender_org.mpfb.services.targetservice import TargetService
import bl_ext.blender_org.mpfb as MP
bpy.ops.wm.read_factory_settings(use_empty=True)
macro = {"gender": 0.95, "age": 0.55, "muscle": 0.55, "weight": 0.45, "height": 0.5, "proportions": 0.6, "cupsize": 0.5, "firmness": 0.5,
         "race": {"asian": 0.1, "african": 0.1, "caucasian": 0.8}}
o = HumanService.create_human(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True, feet_on_ground=True, scale=0.1, macro_detail_dict=macro)
o.name = "NPC01"; bpy.context.view_layer.objects.active = o; o.select_set(True)
TD = os.path.join(os.path.dirname(MP.__file__), 'data', 'targets')
for d in ('head', 'eyes', 'nose', 'mouth', 'cheek', 'chin', 'forehead', 'eyebrows', 'ears', 'neck'):
    for f in sorted(glob.glob(os.path.join(TD, d, '*.target.gz'))):
        TargetService.load_target(o, f, weight=0.0, name=os.path.basename(f).replace('.target.gz', ''))
kb = o.data.shape_keys.key_blocks; names = [k.name for k in kb]
P = json.load(open(os.path.join(ROOT, 'blend', 'mpfb-02.json')))['params']; nset = 0
for base, val in P.items():
    for a_, b_ in (('-incr', '-decr'), ('-in', '-out'), ('-up', '-down'), ('-forward', '-backward'), ('-convex', '-concave'), ('-compress', '-uncompress'), ('-out', '-in')):
        if base + a_ in names and base + b_ in names:
            kb[base + a_].value = max(val, 0.0); kb[base + b_].value = max(-val, 0.0); nset += 1; break
    else:
        if base in names: kb[base].value = max(val, 0.0); nset += 1
        else: print("NPC01 parametro sem alvo:", base)
print("NPC01 parametros aplicados: %d de %d" % (nset, len(P)))
o.shape_key_add(name='Fit', from_mix=True)
V = np.array([k.co[:] for k in o.data.shape_keys.key_blocks[-1].data])
o.shape_key_clear()
o.data.vertices.foreach_set('co', V.ravel()); o.data.update()
# --- expressoes: ler deltas dos alvos MPFB
ED = os.path.join(TD, 'expression', 'units', 'caucasian'); E = {}
for f in sorted(glob.glob(os.path.join(ED, '*.target.gz'))):
    nm = os.path.basename(f).replace('.target.gz', '')
    TargetService.load_target(o, f, weight=0.0, name=nm)
    E[nm] = np.array([p.co[:] for p in o.data.shape_keys.key_blocks[nm].data]) - V
o.shape_key_clear()
# lado: a "left" do MakeHuman e a esquerda do personagem (+X no Blender)? conferir pelo centroide do delta
d = E['eye-left-closure']; m = np.linalg.norm(d, axis=1) > 1e-6
print("NPC01 eye-left-closure centroide x = %.4f (esperado > 0 = esquerda do personagem)" % V[m, 0].mean())
def side(delta, sign, width=0.008):
    w = np.clip(0.5 + sign * V[:, 0] / (2 * width), 0, 1); w = w * w * (3 - 2 * w)   # smoothstep no eixo X
    return delta * w[:, None]
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
ARKIT['surprise'] = 0.8 * ARKIT['browInnerUp'] + 0.6 * (ARKIT['browOuterUpLeft'] + ARKIT['browOuterUpRight']) \
    + 0.7 * (ARKIT['eyeWideLeft'] + ARKIT['eyeWideRight']) + 0.5 * ARKIT['jawOpen']
o.shape_key_add(name='Basis', from_mix=False)
for nm, dl in ARKIT.items():
    k = o.shape_key_add(name=nm, from_mix=False); k.data.foreach_set('co', (V + dl).ravel()); k.value = 0.0
    print("NPC01 chave %-18s max %.1f mm" % (nm, 1000 * np.linalg.norm(dl, axis=1).max()))
bpy.ops.wm.save_as_mainfile(filepath=out)
print("NPC01 base salva:", out, len(V), "vertices,", len(ARKIT), "chaves")
