"""Pescoço (dois servos) e cabeça do robô da vida `ai` (quadro local do robô, convenção glb, mm reais → `R`).

- `ai_suporte` (gira com `ai_pescoco`, eixo vertical no centro do corpo): chifre branco do servo de giro, suporte de
  alumínio natural (chapa de base, dois postes que prendem as abas, montante do pino livre) e o servo de inclinação
  DEITADO (eixo de saída para +x), corpo e chifre à vista.
- `ai_moldura` (gira com `ai_cabeca`, eixo horizontal = eixo do servo de inclinação): casca de alumínio anodizado da
  cabeça (46 × 30 × 30 mm, cantos de raio 7, chanfro de 2,2 mm), vidro preto da frente, parafusos de trás, as duas
  orelhas do garfo (alumínio) — a de +x no chifre do servo, a de −x no pino livre — e o chifre de inclinação.
- `ai_tela`: a área útil da tela (37 × 21 mm, cantos de raio 2,5) 0,05 mm à frente do vidro; UV 0–1 = área útil,
  u da esquerda NA TELA (−x do robô) para a direita, v de baixo para cima.
A cabeça é montada no garfo com a frente INCLINADA `INCL_MONTAGEM` graus para cima (servo no zero): a tela olha a câmera
e os olhos do Fael (acima e atrás do robô) dentro da faixa do servo (−15° / +30°). Ver prop_ai_funcao.olhar.
"""
import math

import bmesh
import bpy
from mathutils import Matrix

import prop_ai_corpo as K
import prop_ai_geo as G
from prop_ai_geo import R, T, rot

INCL_MONTAGEM = 15.0                         # graus: frente da cabeça para cima com o servo no zero
Y_EIXO_INCL = K.Y_EIXO_GIRO + 0.6 + 1.5 + K.SERVO['l'] / 2    # topo do chifre, chapa de 1,5 mm, servo deitado nela
CABECA = (46.0, 30.0, 30.0)                  # largura, altura, profundidade
Y_CABECA0 = 14.5                             # fundo da cabeça acima do eixo de inclinação
TELA = (37.0, 21.0, 2.5)
VIDRO = (40.0, 24.0, 4.0, 0.6)
X_GARFO = 18.5                               # face de dentro das orelhas do garfo
C = K.C
# servo deitado: comprimento → +z, eixo de saída → +x, largura → +y (rotação própria: det +1)
DEITADO = Matrix(((0, 1, 0, 0), (0, 0, 1, 0), (1, 0, 0, 0), (0, 0, 0, 1)))


def _p(x, y, z):
    return T(R(x), R(y), R(z))


def suporte(P):
    """No quadro do robô; origem do nó no eixo de giro (topo da estria)."""
    y0 = K.Y_EIXO_GIRO
    P.add(G.cilindro(R(3.5), R(1.5 + 0.2), R(0.3)), _p(0, y0 - 2.7, 0), 'nylon', C['nylon'], dens=1.1)
    P.add(G.cilindro(R(10.0), R(1.8), R(0.4), 32), _p(0, y0 - 1.2, 0), 'nylon', C['nylon'], dens=1.1,
          rotulo='chifre de giro')
    P.marcar(0, 2)                            # chifre: fora da medida suporte × corpo (abraça a estria)
    yc = y0 + 0.6                             # topo do chifre
    P.add(G.caixa(R(26.5), R(1.5), R(35.0), R(2.0), R(0.3)), _p(-4.25, yc, 5.5), 'aluminio', C['aluminio'],
          dens=2.7, rotulo='chapa do suporte')
    ys = yc + 1.5                             # fundo do servo de inclinação
    ye = Y_EIXO_INCL
    b = -11.2                                 # fundo do servo (quadro do servo) em x
    K.servo(P, _p(b, ye, 0) @ DEITADO, C['servo'])
    alt = K.SERVO['l']
    for z0, z1 in ((-10.0, -6.4), (17.4, 21.0)):                         # postes das abas
        P.add(G.caixa(R(1.5), R(alt), R(z1 - z0), 0, R(0.25)), _p(3.95, ys, (z0 + z1) / 2), 'aluminio',
              C['aluminio'], dens=2.7)
    P.add(G.caixa(R(1.5), R(ye - ys), R(12.0), 0, R(0.25)), _p(-16.75, ys, 0), 'aluminio', C['aluminio'], dens=2.7)
    lado = rot('z', -90)                      # eixo +y → +x
    P.add(G.cilindro(R(6.0), R(1.5), R(0.3), 28), _p(-17.5, ye, 0) @ lado, 'aluminio', C['aluminio'])
    P.add(G.cilindro(R(3.0), R(1.0), R(0.2), 20), _p(-18.5, ye, 0) @ lado, 'aco', C['aco'])
    P.pontos['eixo_incl'] = (0.0, R(ye), 0.0)


def _orelha(P, x0, M):
    """Orelha do garfo: chapa de 1,5 mm no plano yz, redonda em volta do eixo (r 5,5) e subindo até dentro da cabeça."""
    r = 5.5
    pts = [(r * math.cos(a), r * math.sin(a)) for a in [math.radians(180 + 15 * k) for k in range(13)]]
    pts = [(y, z) for z, y in pts] + [(Y_CABECA0 + 1.2, r), (Y_CABECA0 + 1.2, -r)]
    cont = [(R(-y), R(z)) for y, z in pts]                # 1º eixo do contorno → −y (rot z −90)
    bm = G.prisma(cont, R(1.5), R(0.3), 2)
    P.add(bm, M @ _p(x0, 0, 0) @ rot('z', -90), 'aluminio', C['aluminio'], dens=2.7, rotulo='orelha do garfo')


def moldura(P):
    """No quadro da CABEÇA (origem no eixo de inclinação); prop_ai.py leva ao quadro do robô com a montagem."""
    M = rot('x', -INCL_MONTAGEM)
    w, h, d = CABECA
    yc = Y_CABECA0 + h / 2
    frente = rot('x', -90)                    # prisma em +y → −z; o 2º eixo do contorno vira +y
    casco = G.prisma(G.sec_ret(R(w), R(h), R(7.0), 5), R(d), R(2.2), 3)
    P.add(casco, M @ _p(0, yc, d / 2) @ frente, 'anodizado', C['grafite'], dens=0.6, grupo=1, rotulo='cabeça')
    vw, vh, vr, ve = VIDRO
    P.add(G.prisma(G.sec_ret(R(vw), R(vh), R(vr)), R(ve), R(0.25), 2), M @ _p(0, yc, d / 2 + ve) @ frente, 'vidro',
          C['moldura_vidro'], dens=2.5, grupo=1)
    for sx in (-1, 1):
        for sy in (-1, 1):
            G_ = _p(sx * (w / 2 - 6), yc + sy * (h / 2 - 6), -d / 2) @ rot('x', -90)
            P.add(G.parafuso(3.4, 1.0), M @ G_, 'aco', C['aco'], grupo=1)
            P.add(G.sextavado(1.4, 0.25), M @ G_ @ T(0, R(0.8), 0), 'plastico', C['sextavado'], grupo=1)
    _orelha(P, X_GARFO, M)
    _orelha(P, -X_GARFO - 1.5, M)
    lado = rot('z', -90)
    P.add(G.cilindro(R(3.2), R(1.0), R(0.2), 20), M @ _p(15.7, 0, 0) @ lado, 'nylon', C['nylon'])
    P.add(G.cilindro(R(7.0), R(1.8), R(0.4), 32), M @ _p(16.7, 0, 0) @ lado, 'nylon', C['nylon'],
          rotulo='chifre de inclinação')
    for dz in (0.0, -4.0, 4.0):
        P.add(G.parafuso(2.8 if dz else 3.6, 0.9), M @ _p(X_GARFO + 1.5, 0, dz) @ lado, 'aco', C['aco'])
    P.add(G.parafuso(3.6, 0.9), M @ _p(-X_GARFO - 1.5, 0, 0) @ rot('z', 90), 'aco', C['aco'])
    P.pontos['centro_tela'] = tuple(M @ _p(0, yc, d / 2 + ve + 0.05).to_translation())
    P.pontos['normal_tela'] = tuple((M.to_3x3() @ G.Vector((0, 0, 1))).normalized())


def tela(material):
    """Malha da tela no quadro da CABEÇA (com a montagem), UV 0–1 na área útil; devolve o objeto (vértices relativos
    ao centro da tela, convertidos para o Blender) e o centro (quadro da cabeça, glb)."""
    M = rot('x', -INCL_MONTAGEM)
    w, h, r = TELA
    yc = Y_CABECA0 + CABECA[1] / 2
    z = CABECA[2] / 2 + VIDRO[3] + 0.05
    cont = G.sec_ret(R(w), R(h), R(r), 5)
    centro = M @ G.Vector((0, R(yc), R(z)))
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    vs = [bm.verts.new(M @ G.Vector((x, R(yc) + y, R(z))) - centro) for x, y in cont]
    vc = bm.verts.new(G.Vector((0, 0, 0)))
    for k in range(len(vs)):
        f = bm.faces.new((vc, vs[k], vs[(k + 1) % len(vs)]))
        for lp in f.loops:
            q = M.inverted() @ (lp.vert.co + centro)
            lp[uv].uv = ((q.x + R(w) / 2) / R(w), (q.y - R(yc) + R(h) / 2) / R(h))
    for v in bm.verts:                        # (x, y, z) glb → (x, −z, y): rotação própria, a normal fica em +z glb
        v.co = G.Vector((v.co.x, -v.co.z, v.co.y))
    me = bpy.data.meshes.new('ai_tela')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    ob = bpy.data.objects.new('ai_tela', me)
    bpy.context.scene.collection.objects.link(ob)
    return ob, tuple(centro)
