"""Mãos no aro (U2/U3/U5): leva a mão do MPFB (prop_uber_mao) à pegada das 10 e 2 h no aro de prop_uber_volante.

Pegada de motorista: palma no lado de FORA e de TRÁS do aro (para o motorista), dedos passando por fora e pela frente
(lado do painel, o que a câmera vê) com as pontas voltando por dentro; polegar do lado do motorista. O contato dos
dedos é medido contra o TORO do aro (não um cilindro reto: a curvatura do aro afasta 8 mm nas pontas da mão).

Escala: comprimento da mão (prega do punho → ponta do médio) = altura do rosto do S13 (queixo 0,040 → raiz do cabelo
0,2755 no glb, medida no perfil x = 0 pela textura) = 0,236.
"""
import math

import bpy
import numpy as np
from mathutils import Matrix

import prop_uber_mao as M
import prop_uber_mao_relevo as RL
from prop_uber_pega_dedos import agarrar
import prop_uber_volante as VO

ROSTO = 0.2755 - 0.040                     # altura do rosto no glb (queixo → raiz do cabelo)
LADO = {'esq': 'L', 'dir': 'R'}           # esquerda do Fael = .L do MPFB (x > 0)
DESEJO_FORA = 0.45
DESEJO_BAIXO = 1.0
POLEGAR = (0.0, 0.0, 0.0)                  # pré-pose do polegar (graus): oposição, flexão, abdução
BETA = (20, 60)                            # graus da palma: de fora (0) para trás (90); fecha ≈ 270°
COMPRIMENTO = 0.97                         # ADENDO 4: comprimento da mão / altura do rosto (0,95–1,0)
FOLGA = 0.0011                             # alvo do contato (m); aceite 0,5–2 mm


def transformar(mao, P, a, n, nome, beta=None):
    """Matriz 4×4 (numpy) repouso → mundo, pegada "10 e 2" real (ADENDO 2 da ficha):
    - eixo da pegada (lado do indicador/polegar) → tangente do aro apontando para as 12 h (polegar para cima/centro);
    - palma do lado de FORA e de TRÁS do tubo (beta: graus de fora para o motorista), dedos saindo para o painel (o
      lado da câmera) para fechar por cima com as pontas para o centro;
    - beta escolhido para o antebraço sair para fora, para baixo e para trás (motorista).
    Sem solução com os dedos indo para o painel = mão espelhada (erro)."""
    Q, tan, rad, painel = (np.array(v) for v in VO.pega(nome))
    c, ex, _, topo = (np.array(v) for v in VO.quadro())
    sg = 1.0 if tan @ topo > 0 else -1.0                      # indicador/polegar para as 12 h
    desejo = rad * DESEJO_FORA + np.array((0, 0, -1.0)) * DESEJO_BAIXO - painel * 1.0
    desejo /= np.linalg.norm(desejo)
    nc = -(n - a * (n @ a))
    nc /= np.linalg.norm(nc)
    _, df, _, _ = mao.quadro()
    A = np.c_[a, nc, np.cross(a, nc)]
    melhor = (-9, None, None)
    for bg in (range(BETA[0], BETA[1] + 1, 2) if beta is None else (beta,)):   # palma por fora e por trás
        b = math.radians(bg)
        e = rad * math.cos(b) - painel * math.sin(b)
        Bm = np.c_[sg * tan, e, np.cross(sg * tan, e)]
        R = Bm @ A.T
        if (R @ df) @ painel < 0.1:
            continue
        nota = (R @ -df) @ desejo
        if nota > melhor[0]:
            melhor = (nota, R, bg)
    if melhor[1] is None:
        raise RuntimeError('mão %s espelhada: os dedos não vão para o painel com a palma por fora' % nome)
    _, R, bg = melhor
    mao.beta = bg
    T = np.eye(4)
    T[:3, :3] = R
    T[:3, 3] = Q - R @ P
    print('PEGA', nome, 'beta', bg, 'antebraco·desejo %.2f' % melhor[0], 'antebraco', np.round(R @ -df, 2))
    return T


def aplicar(T, X):
    return X @ T[:3, :3].T + T[:3, 3]


def construir(nome, phi=36.0, recuo=0.85, busto=None, polegar=POLEGAR):
    """Mão posada no aro, no mundo (Blender). Devolve (objeto, dados) — dados: mao, T, V (mundo), folga por dedo."""
    mao = M.Mao(LADO[nome], antebraco=0.035)
    mao.proporcionar()                                    # ADENDO 4: médio, cascata e falanges
    mao.escalar(COMPRIMENTO * ROSTO / mao.comprimento())  # comprimento = 0,97 × altura do rosto
    mao.afinar(0.9, 0.94)
    escala = proporcoes(mao)
    print('PROPORCOES', nome, escala)
    Nr, unhas = RL.aplicar(mao)                            # relevo no repouso (nós, tendões, unhas)
    guarda = {}

    def onde(P, a, n):
        guarda['T'] = transformar(mao, P, a, n, nome)
        return lambda X: VO.dist_aro(aplicar(guarda['T'], X))
    agarrar(mao, VO.R_TUBO, folga=FOLGA, phi=phi, recuo=recuo, onde=onde, polegar=polegar)
    dedo = sum(mao.W[:, mao.idx['finger%d-%d.%s' % (d, k, mao.lado)]] for d in range(1, 6) for k in (1, 2, 3))
    dp = VO.dist_aro(aplicar(guarda['T'], mao.posada()[dedo < 0.3])).min()
    if dp < FOLGA * 0.7:                                  # o toro fecha mais que o cilindro reto: 2ª passada
        mao.rot = {}
        agarrar(mao, VO.R_TUBO, folga=FOLGA, phi=phi, recuo=recuo, onde=onde, extra=FOLGA - dp, polegar=polegar)
    T = guarda['T']
    dobrar_punho(mao, T, nome)
    if busto is not None:
        _polegar_longe(mao, T, busto)
    V = aplicar(T, mao.posada())
    me = mao.malha.copy()
    me.name = 'uber_mao_%s_malha' % nome
    me.vertices.foreach_set('co', V.ravel())
    me.update()
    ob = bpy.data.objects.new(me.name, me)
    bpy.context.scene.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    d = VO.dist_aro(V)
    folgas = {}
    for dd in range(1, 6):
        seg = sum(mao.W[:, mao.idx['finger%d-%d.%s' % (dd, k, mao.lado)]] for k in (1, 2, 3)) > 0.5
        folgas['dedo%d' % dd] = round(float(d[seg].min()) * 1000, 2)
    folgas['mao_inteira'] = round(float(d.min()) * 1000, 2)
    return ob, {'mao': mao, 'T': T, 'V': V, 'folga_mm': folgas, 'matriz': Matrix(T.tolist()), 'ob': ob,
                'Vr': mao.V.copy(), 'Nr': Nr, 'unhas': unhas, 'escala': escala}


def reduzir(d, fracao=0.3):
    """Menos triângulos onde a câmera quase não vê (palma e lado palmar dos dedos, contra o aro; punho e antebraço, que
    somem no degradê): colapso de arestas só nessas faces; os atributos do repouso (posição, normal, pesos, unha,
    t) passam ao vértice novo pelo vizinho mais próximo na pose."""
    from mathutils.kdtree import KDTree
    ob, mao = d['ob'], d['mao']
    dedo = sum(mao.W[:, mao.idx['finger%d-%d.%s' % (dd, k, mao.lado)]] for dd in range(1, 6) for k in (1, 2, 3))
    V0 = d['V']
    for o in bpy.context.view_layer.objects:
        o.select_set(o == ob)
    bpy.context.view_layer.objects.active = ob
    _, _, _, n = mao.quadro()
    escondido = (dedo < 0.35) | ((d['Nr'] @ n) > 0.25) | (mao.t < 0.0)
    for p in ob.data.polygons:
        p.select = all(escondido[v] for v in p.vertices)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.decimate(ratio=fracao)
    bpy.ops.object.mode_set(mode='OBJECT')
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


def proporcoes(mao):
    """Medidas de aceite do ADENDO 4 na malha de repouso (antes da pose)."""
    L = mao.comprimento()
    out = {'mao_sobre_rosto': round(L / ROSTO, 3), 'largura_nos_sobre_mao': round(largura_nos(mao) / L, 3)}
    comp = {d: mao.dedo(d)[2] for d in (2, 3, 4, 5)}
    med = sum(comp[3])
    out['medio_sobre_mao'] = round(med / L, 3)
    out.update({'%s_sobre_medio' % n: round(sum(comp[d]) / med, 3) for d, n in ((2, 'indicador'), (4, 'anelar'),
                                                                               (5, 'minimo'))})
    out['falanges_medio'] = [round(c / comp[3][0], 2) for c in comp[3]]
    return out


def largura_rosto(busto):
    """Largura máxima do rosto (zigomas) no glb, por raios de fora para dentro em y 0,12–0,16."""
    from mathutils import Vector
    melhor = 0.0
    for y in (0.12, 0.13, 0.14, 0.15, 0.16):
        r = busto.raio(Vector((0, 0.06, y)), Vector((1, 0, 0)))
        e = busto.raio(Vector((0, 0.06, y)), Vector((-1, 0, 0)))
        if r and e:
            melhor = max(melhor, r[0].x - e[0].x)
    return float(melhor)


def largura_nos(mao):
    """Largura da mão na linha dos nós (MCP), de fora a fora, ao longo do eixo lateral da palma."""
    s = '.' + mao.lado
    _, df, lat, _ = mao.quadro()
    mcp = np.mean([mao.cab['finger%d-1' % d + s][0] for d in (2, 3, 4, 5)], 0)
    dedos = sum(mao.W[:, mao.idx[b + s]] for b in ('metacarpal1', 'metacarpal2', 'metacarpal3', 'metacarpal4',
                                                    'finger2-1', 'finger3-1', 'finger4-1', 'finger5-1'))
    perto = (np.abs((mao.V - mcp) @ df) < 0.004) & (dedos > 0.6)        # sem o polegar
    q = mao.V[perto] @ lat
    return float(q.max() - q.min())


def dobrar_punho(mao, T, nome, limite=55.0):
    """ADENDO 3: o antebraço vai para TRÁS (para o corpo) e para BAIXO, encurtado em perspectiva; dobra no punho até
    `limite` graus, sem tocar o aro."""
    from mathutils import Matrix, Vector
    Q, tan, rad, painel = (np.array(v) for v in VO.pega(nome))
    c = mao.cab['wrist.' + mao.lado][0]
    cur = mao.V[mao.t < -0.02].mean(0) - c
    cur /= np.linalg.norm(cur)
    des = T[:3, :3].T @ (-painel * 1.0 + np.array((0, 0, -1.0)) * 0.8 + rad * 0.5)
    des /= np.linalg.norm(des)
    eixo = np.cross(cur, des)
    ang = min(math.degrees(math.acos(np.clip(cur @ des, -1, 1))), limite)
    fore = mao.t < -0.004
    while ang > 0:
        mao.ante_R = np.array(Matrix.Rotation(math.radians(ang), 3, Vector(eixo)))
        if VO.dist_aro(aplicar(T, mao.posada(fore)[fore])).min() > FOLGA:
            break
        ang -= 5.0
    print('PUNHO', nome, round(ang, 1), 'graus')


def _polegar_longe(mao, T, busto, minimo=0.006):
    """O polegar (lado do motorista) não chega a `minimo` da barba: gira a base para longe do ponto mais próximo."""
    b1 = 'finger1-1.' + mao.lado
    pol = sum(mao.W[:, mao.idx['finger1-%d.%s' % (k, mao.lado)]] for k in (1, 2, 3)) > 0.3
    for _ in range(45):
        Vw = aplicar(T, mao.posada(pol)[pol])
        ds = [busto.perto(p) for p in Vw[::2]]
        i = int(np.argmin([d[2] for d in ds]))
        if ds[i][2] >= minimo:
            return
        tip = aplicar(T, mao.ponto(b1, 1)[None])[0]
        h = aplicar(T, mao.ponto(b1, 0)[None])[0]
        u = np.cross(tip - h, np.array(ds[i][0]) - tip)
        mao.girar_mundo(b1, T[:3, :3].T @ u, -math.radians(2))
        if VO.dist_aro(aplicar(T, mao.posada(pol)[pol])).min() < FOLGA * 0.5:    # não entra no aro
            mao.girar_mundo(b1, T[:3, :3].T @ u, math.radians(2))
            return
