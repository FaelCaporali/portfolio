"""Função do robô da vida `ai`, medida ANTES do acabamento (FICHA §1, "Função"):
- guinada do corpo e ângulos dos servos para a tela olhar a CÂMERA do site e os OLHOS do Fael (glb (0; 0,18; −0,02)),
  conferidos na cena (normal da malha `ai_tela` × direção ao alvo);
- centro de massa sobre a base (massa por peça fechada: volume × densidade) no repouso e nos extremos dos servos;
- folgas dos servos: cabeça × pescoço/corpo em toda a faixa (giro ±60°, inclinação −15°/+30°) e suporte × corpo no giro;
- `explodido_m` por peça (fora do quadro nas 3 telas, caminho reto sem passar a < 10 mm da pele).
As folgas × pele nas poses do busto e as medidas em px estão em prop_ai_medidas.py.
"""
import json
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import comum
import prop_ai_cabeca as H
import prop_ai_corpo as K
import prop_ai_geo as G
from prop_ai_geo import R

CAMERA_SITE = None
OLHOS = np.array((0.0, 0.18, -0.02))
GIRO, INCL = (-60.0, 60.0), (-15.0, 30.0)


def camera_glb(tela='1440x900'):
    """Posição da câmera do site no espaço do glb (inversa do frame)."""
    c = comum.ler_camera_site(tela)
    mw = comum._matriz(c['matrixWorld'])
    fr = comum._matriz(c['frameMatrixWorld']) if c.get('frameMatrixWorld') else None
    p = (fr.inverted() @ mw) if fr is not None else mw
    return np.array(p.to_translation())


def _Ry(a):
    c, s = math.cos(a), math.sin(a)
    return np.array(((c, 0, s), (0, 1, 0), (-s, 0, c)))


def _Rx(a):
    c, s = math.cos(a), math.sin(a)
    return np.array(((1, 0, 0), (0, c, -s), (0, s, c)))


def _mira(p0, psi, alvo, giro=0.0):
    """(giro, incl) em graus para a normal da tela apontar do centro da tela para `alvo` (modelo analítico)."""
    cant = math.radians(H.INCL_MONTAGEM)
    y_c = H.Y_CABECA0 + H.CABECA[1] / 2
    c_h = np.array((0.0, R(y_c), R(H.CABECA[2] / 2 + H.VIDRO[3] + 0.05)))
    c_h = _Rx(-cant) @ c_h
    eixo = p0 + np.array((0, R(H.Y_EIXO_INCL), 0))
    g, i = math.radians(giro), 0.0
    for _ in range(12):
        sc = eixo + _Ry(math.radians(psi) + g) @ _Rx(-i) @ c_h
        d = alvo - sc
        yaw, pit = math.atan2(d[0], d[2]), math.asin(d[1] / np.linalg.norm(d))
        g, i = yaw - math.radians(psi), pit - cant
    return math.degrees(g), math.degrees(i), math.degrees(yaw)


def resolver(pos_xz, mesa):
    """Guinada do corpo que centra o giro entre olhar a câmera e olhar o Fael; os dois pares de ângulos."""
    p0 = np.array((pos_xz[0], mesa, pos_xz[1]))
    cam = camera_glb()
    psi = 0.0
    for _ in range(8):
        _, _, yc = _mira(p0, psi, cam)
        _, _, yf = _mira(p0, psi, OLHOS)
        psi = (yc + yf) / 2
    gc, ic, _ = _mira(p0, psi, cam)
    gf, i_f, _ = _mira(p0, psi, OLHOS)
    return {'guinada': psi, 'camera': (gc, ic), 'fael': (gf, i_f), 'camera_glb': [float(v) for v in cam]}


def pose(ctx, giro, incl):
    ctx['pescoco'].rotation_euler = (0, 0, math.radians(giro))
    ctx['cabeca'].rotation_euler = (math.radians(-incl), 0, 0)
    bpy.context.view_layer.update()


def conferir_olhar(ctx, alvo, giro, incl):
    """Ângulo (graus) entre a normal da `ai_tela` na cena e a direção do centro da tela ao alvo."""
    pose(ctx, giro, incl)
    ob = ctx['obs']['ai_tela']
    mw = ob.matrix_world
    n = G.gl(mw.to_3x3() @ ob.data.polygons[0].normal)      # normal da malha (a montagem inclinada está nos vértices)
    c = G.gl(mw.to_translation())
    d = np.asarray(alvo) - c
    return math.degrees(math.acos(np.clip(np.dot(n, d) / np.linalg.norm(n) / np.linalg.norm(d), -1, 1)))


# ----------------------------------------------------------------------------------------------- centro de massa
def centro_massa(ctx):
    """Massa (g reais) e centro de massa (glb) na pose atual; margem (mm reais) até a borda do polígono dos pés."""
    P = ctx['P']
    tot, soma = 0.0, np.zeros(3)
    o_pesc = np.array((0, R(K.Y_EIXO_GIRO), 0))
    for nome, pp in P.items():
        for g, c, _ in pp.massas:
            if nome == 'ai_moldura':          # quadro da cabeça (origem no eixo de inclinação)
                w = G.gl(ctx['cabeca'].matrix_world @ G.bl(c))
            elif nome == 'ai_suporte':        # quadro do robô, gira com o pescoço
                w = G.gl(ctx['pescoco'].matrix_world @ G.bl(np.subtract(c, o_pesc)))
            else:
                w = G.gl(ctx['robo'].matrix_world @ G.bl(c))
            tot += g
            soma += g * w
    com = soma / tot
    robo = ctx['robo'].matrix_world
    pes = [G.gl(robo @ G.bl((R(sx * 29), 0, R(sz * 23)))) for sx in (-1, 1) for sz in (-1, 1)]
    xz = np.array([(p[0], p[2]) for p in pes])
    cen = xz.mean(0)
    ang = np.arctan2(xz[:, 1] - cen[1], xz[:, 0] - cen[0])
    poly = xz[np.argsort(ang)]
    q = np.array((com[0], com[2]))
    dmin = min(abs(np.cross(b - a, q - a)) / np.linalg.norm(b - a) for a, b in zip(poly, np.roll(poly, -1, 0)))
    return tot, com, dmin / G.ESC * 1000 + K.PE_D / 2


# ------------------------------------------------------------------------------------------------ folgas servos
def _bvh(obs, sel=None):
    bm = bmesh.new()
    for o in obs:
        me = o.data
        t = bmesh.new()
        t.from_mesh(me)
        if sel is not None and o.name in sel:
            lay = t.faces.layers.int.get('grupo')
            bmesh.ops.delete(t, geom=[f for f in t.faces if f[lay] != sel[o.name]], context='FACES')
        t.transform(o.matrix_world)
        me2 = bpy.data.meshes.new('_t')
        t.to_mesh(me2)
        t.free()
        bm.from_mesh(me2)
        bpy.data.meshes.remove(me2)
    return BVHTree.FromBMesh(bm), bm


def _dist(bm_a, arv_b, amostra=1):
    vs = bm_a.verts
    vs.ensure_lookup_table()
    return min(arv_b.find_nearest(vs[i].co)[3] for i in range(0, len(vs), amostra))


def folgas_servos(ctx):
    """mm reais: cabeça (casca, vidro, parafusos de trás: grupo 1 da moldura) × suporte + corpo + base + tampa + placa
    na grade da faixa; suporte × corpo no giro (sem o chifre, que abraça a estria). Interseção = −1."""
    obs = ctx['obs']
    fixos = [obs[n] for n in ('ai_base', 'ai_corpo', 'ai_tampa', 'ai_placa')]
    out = {'cabeca_x_pescoco_corpo': {}, 'suporte_x_corpo': {}}
    for g in (-60, -30, 0, 30, 60):
        for i in (-15, 0, 15, 30):
            pose(ctx, g, i)
            a, bma = _bvh([obs['ai_moldura']], {'ai_moldura': 1})
            b, bmb = _bvh(fixos + [obs['ai_suporte']])
            d = -1.0 if a.overlap(b) else min(_dist(bma, b), _dist(bmb, a, 2))
            out['cabeca_x_pescoco_corpo']['%+d/%+d' % (g, i)] = round(d / G.ESC * 1000, 2)
            bma.free()
            bmb.free()
    for g in (-60, -30, 0, 30, 60):
        pose(ctx, g, 0)
        a, bma = _bvh([obs['ai_suporte']], {'ai_suporte': 0})         # sem o chifre (abraça a estria)
        b, bmb = _bvh([obs['ai_corpo']], {'ai_corpo': 0})             # sem o servo de giro (onde o chifre encaixa)
        d = -1.0 if a.overlap(b) else min(_dist(bma, b), _dist(bmb, a))
        out['suporte_x_corpo']['%+d' % g] = round(d / G.ESC * 1000, 2)
        bma.free()
        bmb.free()
    v = out['cabeca_x_pescoco_corpo']
    out['min_cabeca_mm'] = min(v.values())
    out['extremos'] = {k: v[k] for k in ('-60/-15', '-60/+30', '+60/-15', '+60/+30', '+0/-15', '+0/+30')}
    return out


def dumps(o):
    return json.dumps(o, ensure_ascii=False)
