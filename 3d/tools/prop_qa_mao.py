"""E6 `qa_mao`: mão DIREITA do Fael (lado −X, MPFB .R) segurando o cabo da lupa, com o ofício da mão do Uber
(prop_uber_mao: malha do MPFB, FK em numpy; prop_uber_mao_relevo: nós, tendões, unha; prop_uber_pega_dedos: pegada
fechada por contato; prop_uber_pele/unha: pele da fonte do S13 e placas das unhas).

Pegada de força no cabo (cilindro de raio RG): palma a 1,1 mm do cabo, dedos fechando em volta até encostar (juntas
acopladas, travam no contato), polegar fechando por cima; o lado do indicador fica para a lente. O giro em volta do
cabo é o que leva o antebraço para BAIXO, para trás e para fora (entra por baixo do quadro e some no degradê).
A altura da mão no cabo sai da própria pegada: o indicador (ou o polegar) fica 3 mm abaixo da virola; o nó do cabo
começa abaixo do ponto mais baixo da mão junto do cabo.
Espaço: mundo do Blender (Z para cima); o eixo do cabo vem do quadro da lupa.
"""
import math

import bpy
import numpy as np
from mathutils import Matrix, Vector

import prop_uber_mao as M
import prop_uber_mao_relevo as RL
import prop_uber_pega as PG
from prop_uber_pega_dedos import agarrar

FOLGA = 0.0011
PHI, RECUO = 36.0, 0.85


def _dist_cil(X, P, a, r):
    d = X - P
    return np.linalg.norm(d - np.outer(d @ a, a), axis=1) - r


def _aplicar(T, X):
    return X @ T[:3, :3].T + T[:3, 3]


def construir(centro, cima, r, h_virola, desejo, dorso_pref):
    """centro: centro da lente (Blender); cima: eixo do cabo para a lente (unitário); r: raio da empunhadura;
    h_virola: do centro da lente ao fim da virola; desejo: direção desejada do antebraço (mundo); dorso_pref:
    direção preferida do dorso da mão. Devolve (objeto, dados)."""
    mao = M.Mao('R', antebraco=0.035)
    mao.proporcionar()
    mao.escalar(PG.COMPRIMENTO * PG.ROSTO / mao.comprimento())
    mao.afinar(0.9, 0.94)
    escala = PG.proporcoes(mao)
    Nr, unhas = RL.aplicar(mao)
    P, a = agarrar(mao, r, folga=FOLGA, phi=PHI, recuo=RECUO, polegar=PG.POLEGAR)
    _, df, _, n = mao.quadro()
    nc = -(n - a * (n @ a))
    nc /= np.linalg.norm(nc)
    A = np.c_[a, nc, np.cross(a, nc)]
    cima = np.asarray(cima, float)
    ref = np.cross(cima, (0.0, 0.0, 1.0))
    ref /= np.linalg.norm(ref)
    melhor = (-9, None, None)
    for g in range(0, 360, 3):                          # giro do dorso em volta do cabo
        gr = math.radians(g)
        e = ref * math.cos(gr) + np.cross(cima, ref) * math.sin(gr)
        R = np.c_[cima, e, np.cross(cima, e)] @ A.T
        nota = (R @ -df) @ desejo + 0.25 * (e @ dorso_pref)
        if nota > melhor[0]:
            melhor = (nota, R, g)
    _, R, giro = melhor
    V = mao.posada()
    radial = np.linalg.norm((V - P) - np.outer((V - P) @ a, a), axis=1)
    junto = (radial < 0.0175) & (mao.t > -0.004)         # o que encosta no cabo (dedos, palma, polegar)
    s = (V - P) @ a
    s_max = float(s[junto].max())
    h_q = h_virola + 0.003 + s_max                      # do centro da lente ao ponto P da pegada, ao longo do cabo
    Q = np.asarray(centro) - cima * h_q
    T = np.eye(4)
    T[:3, :3] = R
    T[:3, 3] = Q - R @ P
    _dobrar_punho(mao, T, P, a, r, desejo)
    V = mao.posada()
    Vw = _aplicar(T, V)
    me = mao.malha.copy()
    me.name = 'qa_mao_malha'
    me.vertices.foreach_set('co', Vw.ravel())
    me.update()
    ob = bpy.data.objects.new(me.name, me)
    bpy.context.scene.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    d = _dist_cil(V, P, a, r)
    h = h_q - (V - P) @ a                               # altura de cada vértice ao longo do cabo (do centro da lente)
    radial = np.linalg.norm((V - P) - np.outer((V - P) @ a, a), axis=1)
    perto = (radial < 0.0175) & (mao.t > -0.004)
    h_no = float(h[perto].max()) + 0.002
    acima = h < h_virola + 0.001                        # o que sobe acima do fim da virola tem de ficar longe dela
    folgas_extra = {'h_min_mao_m': round(float(h.min()), 4),
                    'radial_min_acima_da_virola_m': round(float(radial[acima].min()), 4) if acima.any() else None}
    folgas = {}
    for dd in range(1, 6):
        seg = sum(mao.W[:, mao.idx['finger%d-%d.R' % (dd, k)]] for k in (1, 2, 3)) > 0.5
        folgas['dedo%d' % dd] = round(float(d[seg].min()) * 1000, 2)
    folgas['mao_inteira'] = round(float(d.min()) * 1000, 2)
    folgas['vertices_dentro_do_cabo'] = int((d < 0).sum())
    folgas.update(folgas_extra)
    print('PEGA_QA giro', giro, 'antebraco', np.round(R @ -df, 2), 'h_q', round(h_q, 4), 'h_no', round(h_no, 4),
          'folgas_mm', folgas)
    return ob, {'mao': mao, 'T': T, 'V': Vw, 'ob': ob, 'Vr': mao.V.copy(), 'Nr': Nr, 'unhas': unhas,
                'escala': escala, 'folga_mm': folgas, 'h_no': h_no, 'h_q': h_q, 'P': P, 'a': a, 'giro': giro,
                'Q': Q, 'antebraco': (R @ -df).tolist(), 'matriz': Matrix(T.tolist())}


def _dobrar_punho(mao, T, P, a, r, desejo, limite=45.0):
    """O antebraço dobra no punho na direção desejada (até `limite` graus) sem tocar o cabo."""
    c = mao.cab['wrist.R'][0]
    cur = mao.V[mao.t < -0.02].mean(0) - c
    cur /= np.linalg.norm(cur)
    des = T[:3, :3].T @ np.asarray(desejo, float)
    des /= np.linalg.norm(des)
    eixo = np.cross(cur, des)
    if np.linalg.norm(eixo) < 1e-6:
        return
    ang = min(math.degrees(math.acos(np.clip(cur @ des, -1, 1))), limite)
    fore = mao.t < -0.004
    while ang > 0:
        mao.ante_R = np.array(Matrix.Rotation(math.radians(ang), 3, Vector(eixo)))
        if _dist_cil(mao.posada(fore)[fore], P, a, r).min() > FOLGA:
            break
        ang -= 5.0
    print('PUNHO_QA', round(ang, 1), 'graus')


def reduzir(d):
    """Orçamento web (≤ 300 kB e 25 k tri na peça): antebraço (some no degradê) a 25 %, palma colada no cabo a 35 %,
    o resto a 36 %, fora o leito das unhas (intacto: a placa da unha assenta nele)."""
    mao = d['mao']
    _, _, _, n = mao.quadro()
    for mascara, fracao in (
            (lambda: mao.t < -0.004, 0.25),
            (lambda: ((d['Nr'] @ n) > 0.35) & (_dedo(mao) < 0.35), 0.35),
            (lambda: mao.unha < 0.1, 0.36)):
        _reduzir(d, mascara(), fracao)


def _dedo(mao):
    return sum(mao.W[:, mao.idx['finger%d-%d.R' % (dd, k)]] for dd in range(1, 6) for k in (1, 2, 3))


def _distal(mao):
    return sum(mao.W[:, mao.idx['finger%d-3.R' % dd]] for dd in range(1, 6))


def _reduzir(d, escondido, fracao):
    from mathutils.kdtree import KDTree
    ob, mao = d['ob'], d['mao']
    for o in bpy.context.view_layer.objects:
        o.select_set(o == ob)
    bpy.context.view_layer.objects.active = ob
    me = ob.data
    for v in me.vertices:
        v.select = bool(escondido[v.index])
    for e in me.edges:
        e.select = all(escondido[v] for v in e.vertices)
    for p in me.polygons:
        p.select = all(escondido[v] for v in p.vertices)
    n0 = len(me.polygons)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_mode(type='FACE')
    bpy.ops.mesh.decimate(ratio=fracao)
    bpy.ops.object.mode_set(mode='OBJECT')
    print('REDUZIR_PASSO', int(escondido.sum()), 'vértices marcados', n0, '→', len(me.polygons), 'faces')
    V0 = d['V']
    kd = KDTree(len(V0))
    for i, p in enumerate(V0):
        kd.insert(p, i)
    kd.balance()
    idx = np.array([kd.find(ob.matrix_world @ v.co)[1] for v in ob.data.vertices])
    for k in ('Vr', 'Nr'):
        d[k] = d[k][idx]
    mao.W, mao.unha, mao.t = mao.W[idx], mao.unha[idx], mao.t[idx]
    mao.V = d['Vr'].copy()
    d['V'] = np.array([(ob.matrix_world @ v.co)[:] for v in ob.data.vertices])
