"""Expressões do S08 por CAMPOS MUSCULARES aplicados direto no scan (mesmo método do piscar). Rodar dentro do Blender:
  import s08_expr; s08_expr.build_all()
Cada expressão é uma soma de 'puxões': centro num ponto facial medido no próprio scan (detector + raio ortográfico),
vetor de deslocamento em mm na direção do músculo, raio de influência com queda suave. Nada de alvo genérico.
Nomes ARKit. As sombras dos olhos recebem a mesma chave para seguir as pálpebras."""
import bpy, json, math, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import os, importlib
E = importlib.import_module(os.environ.get('S_EYE', 's08_eye'))          # S09: S_EYE=s09_eye
ROOT = E.ROOT; W, S, CZ = 2400, 0.26, 0.165
LM = dict(cornerR=61, cornerL=291, cheekR=205, cheekL=425, browInR=107, browInL=336, browMidR=105, browMidL=334, browOutR=70, browOutL=300,
          glabella=9, alaR=129, alaL=358, lipUp=0, lipLo=17, chin=152, foreheadR=67, foreheadL=297, malarR=117, malarL=346)

def landmarks():
    P = json.load(open(ROOT + 'analise/gate/olhos_lm2d.json')); ob = bpy.data.objects['Busto']; ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()); out = {}
    for k, i in LM.items():
        x = (P[i][0]/W - 0.5)*S; z = CZ - (P[i][1]/W - 0.5)*S; ok, loc, n, fi = ev.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
        out[k] = np.array(loc) if ok else None
    return out

def bump(P, c, r):
    d = np.linalg.norm(P - c, axis=1)/r; return np.where(d < 1, (1 - d*d)**2, 0.0)

def lid_mask(P, rise=0.005):
    """0 na margem das pálpebras e dentro da fenda, 1 a partir de 5 mm de distância: sobrancelha não mexe na margem."""
    m = np.ones(len(P))
    for s in 'DE':
        xs, zu, zl = E._margins(s); cx, yc, cz = E.CEN[s]; near = (np.abs(P[:, 0]-cx) < 0.03) & (np.abs(P[:, 2]-cz) < 0.03)
        xe = np.clip(P[near, 0], xs[0], xs[-1]); ZU = np.interp(xe, xs, zu); ZL = np.interp(xe, xs, zl)
        dist = np.maximum(np.maximum(P[near, 2]-ZU, ZL-P[near, 2]), 0) + np.abs(P[near, 0]-xe); t = np.clip(dist/rise, 0, 1); m[near] = t*t*(3-2*t)
    return m

def lower_lid_rise(s, P, k, H_lo=0.007, taper=0.004):
    """Subida da pálpebra inferior (fração k da subida do piscar), contínua através da margem: abaixo dela decai em H_lo,
    dentro da fenda decai linearmente até a margem superior, acima dela é zero."""
    xs, zu, zl = E._margins(s); xe = np.clip(P[:, 0], xs[0], xs[-1]); out = np.abs(P[:, 0]-xe); t = np.clip(out/taper, 0, 1); g = 1 - t*t*(3-2*t)
    ZU = np.interp(xe, xs, zu); ZL = np.interp(xe, xs, zl); rise = 0.22*(ZU - ZL)*k*g; Z = P[:, 2]
    u = np.clip((ZL - Z)/H_lo, 0, 1); below = 1 - u*u*(3-2*u); inside = 1 - np.clip((Z - ZL)/np.maximum(ZU - ZL, 1e-9), 0, 1)
    return rise*np.where(Z <= ZL, below, inside)

def pulls(name, L):
    mm = 0.001; out = []
    def side(tag): return (1, 'L') if tag.endswith('Left') else (-1, 'R')          # x positivo = lado esquerdo dele
    if name.startswith('mouthSmile'):
        sx, t = side(name)
        out += [(L['corner'+t], np.array([sx*4.4, 2.2, 5.2])*mm, 0.029, False),     # zigomático maior: canto sobe, abre e recua
                (L['cheek'+t], np.array([sx*1.3, -2.8, 3.6])*mm, 0.026, False),      # bochecha: sobe e avança
                (L['malar'+t], np.array([sx*0.5, -1.4, 2.6])*mm, 0.019, False)]      # orbicular (AU6): bolsa malar sobe contra o olho
    elif name == 'browInnerUp':
        out += [(L['browInR'], np.array([0.6, 0, 5.0])*mm, 0.017, True), (L['browInL'], np.array([-0.6, 0, 5.0])*mm, 0.017, True), (L['glabella'], np.array([0, 0, 3.0])*mm, 0.016, True)]
    elif name.startswith('browOuterUp'):
        sx, t = side(name); out += [(L['browMid'+t], np.array([0, 0.3, 4.6])*mm, 0.019, True), (L['browOut'+t], np.array([sx*0.5, 0.6, 5.2])*mm, 0.019, True)]
    elif name.startswith('browDown'):
        sx, t = side(name); out += [(L['browMid'+t], np.array([-sx*1.2, -0.7, -3.2])*mm, 0.018, True), (L['browIn'+t], np.array([-sx*1.6, -0.9, -3.4])*mm, 0.015, True)]
    return out

NAMES = ['mouthSmileLeft', 'mouthSmileRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'browDownLeft', 'browDownRight']
LID = {'mouthSmileLeft': ('E', 1.00), 'mouthSmileRight': ('D', 1.00)}              # pálpebra inferior sobe 60% do que sobe no piscar (~1,3 mm)

def displacement(name, P, L, lm=None):
    D = np.zeros_like(P); lm = lid_mask(P) if lm is None else lm
    for c, d, r, masked in pulls(name, L):
        w = bump(P, c, r); D += (w*(lm if masked else 1.0))[:, None]*d[None]
    if name in LID:
        s, k = LID[name]; cx, yc, cz = E.CEN[s]; near = (np.abs(P[:, 0]-cx) < 0.03) & (np.abs(P[:, 2]-cz) < 0.025)
        dz = lower_lid_rise(s, P[near], k); idx = np.nonzero(near)[0]
        # junto da fenda vale o campo da pálpebra (coerente com a sombra), fora dele vale o puxão da bochecha
        lmk = lm[idx]; D[idx, 2] = D[idx, 2]*lmk + dz*(1 - lmk); D[idx, 0] *= lmk; D[idx, 1] *= lmk
    return D

def build_all():
    ob = bpy.data.objects['Busto']; me = ob.data; L = landmarks(); n = len(me.vertices)
    miss = [k for k, v in L.items() if v is None]; assert not miss, miss
    B = np.empty(n*3, np.float32); me.shape_keys.key_blocks[0].data.foreach_get('co', B); B = B.reshape(-1, 3).astype(np.float64); lm = lid_mask(B)
    N = np.empty(n*3, np.float32); me.vertices.foreach_get('normal', N); front = B[:, 1] < 0.11                       # só a frente da cabeça
    for name in NAMES:
        if name in me.shape_keys.key_blocks: ob.shape_key_remove(me.shape_keys.key_blocks[name])
        D = displacement(name, B, L, lm)*front[:, None]; kb = ob.shape_key_add(name=name, from_mix=False); kb.data.foreach_set('co', (B + D).astype(np.float32).ravel())
        m = np.linalg.norm(D, axis=1); print("EXPR %-18s move %6d vertices, max %.1f mm" % (name, (m > 1e-5).sum(), m.max()*1000))
        if name in LID:
            s, k = LID[name]; so = bpy.data.objects['Sombra_'+s]; sm = so.data
            if name in sm.shape_keys.key_blocks: so.shape_key_remove(sm.shape_keys.key_blocks[name])
            P = np.array([v.co[:] for v in sm.vertices]); P2 = P.copy(); P2[:, 2] += lower_lid_rise(s, P, k); P2[:, 1] = E._ysph(s, P2[:, 0], P2[:, 2], E.R_EYE + 0.0003)
            kb2 = so.shape_key_add(name=name, from_mix=False); kb2.data.foreach_set('co', P2.astype(np.float32).ravel())
