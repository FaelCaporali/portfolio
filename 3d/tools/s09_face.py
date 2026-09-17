"""S09: correções medidas sobre o S07, ANTES da cirurgia dos olhos. Rodar no Blender interativo, um passo por vez:
  import s09_face as F; F.restore_xz(); F.moustache(); F.lower_lip(); F.eye_open('D')
Regra aprendida: suavização ARRASTA A TEXTURA (vértice desliza na superfície levando o UV). Tudo aqui ou devolve o vértice
ao lugar do texel no scan cru, ou desloca por campo explícito e medido. Nenhum smooth.
Frame: x+ = lado esquerdo dele, -y = frente, z = altura; metros no arquivo, mm nas tabelas."""
import bpy, json, numpy as np
ROOT = '/home/fael/projects/portfolio/3d/'
def _ob(): return bpy.data.objects['Busto']
def _V():
    me = _ob().data; V = np.empty(len(me.vertices)*3, np.float32); me.vertices.foreach_get('co', V); return V.reshape(-1, 3).astype(np.float64)
def _set(V):
    me = _ob().data; me.vertices.foreach_set('co', V.astype(np.float32).ravel()); me.update()
def _ss(t): t = np.clip(t, 0, 1); return t*t*(3 - 2*t)
def _interp(tab, x): tab = np.array(tab, float); return np.interp(x, tab[:, 0], tab[:, 1])

# ------------------------------------------------------------------ 1. textura de volta ao lugar
def restore_xz(nose_c=(0, -25, 138), nose_r=24, feather=8):
    """x e z de cada vértice da frente voltam para onde o texel dele estava no scan cru (analise/gate/uvdrift_s07.npz).
    A profundidade (y) esculpida fica. O nariz fica fora: tem escultura aprovada com componente vertical."""
    d = np.load(ROOT + 'analise/gate/uvdrift_s07.npz'); V = _V(); T, ok = d['T'], d['ok']; assert len(T) == len(V)
    fr = np.hypot(*(V - T)[:, [0, 2]].T); w = (ok & (V[:, 1] < 0.06) & (fr < 0.004)).astype(float)
    w *= _ss((0.06 - V[:, 1])/0.02)                                                           # some para trás das orelhas
    me_ = _ob().data; Nn = np.empty(len(V)*3, np.float32); me_.vertices.foreach_get('normal', Nn); Nn = Nn.reshape(-1, 3)
    w *= _ss((-Nn[:, 1] - 0.45)/0.25)                                                         # só superfície voltada para a frente: de lado o raio frontal é mal condicionado
    w *= _ss((V[:, 2] - 0.055)/0.015)*_ss((0.245 - V[:, 2])/0.015)*_ss((0.080 - np.abs(V[:, 0]))/0.015)   # rosto: nem base, nem topo, nem orelhas
    dn = np.linalg.norm(V*1000 - np.array(nose_c), axis=1); w *= _ss((dn - nose_r)/feather)
    # CAMPO de deslocamento: confia só em vértice interior de ilha UV; em costura o UV do 1o loop pode ser da ilha vizinha.
    # O arrasto foi produzido por suavização, logo é um campo suave: difunde dos confiáveis para os demais e alisa o CAMPO.
    me = _ob().data; E = np.empty(len(me.edges)*2, np.int64); me.edges.foreach_get('vertices', E); E = E.reshape(-1, 2)
    lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv); uv = np.empty(len(me.loops)*2, np.float32); me.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
    o_ = np.argsort(lv, kind='stable'); ls, us = lv[o_], uv[o_]; st = np.maximum.accumulate(np.where(np.r_[True, ls[1:] != ls[:-1]], np.arange(len(ls)), 0))
    seam = np.zeros(len(V), bool); seam[ls[np.abs(us - us[st]).max(1) > 1e-5]] = True; ring = seam.copy(); ring[E[seam[E[:, 0]] | seam[E[:, 1]]].ravel()] = True
    D = np.c_[T[:, 0] - V[:, 0], T[:, 2] - V[:, 2]]; trust = ok & ~ring & (fr < 0.0030); D[~trust] = 0
    def navg(X, W):
        acc = np.zeros_like(X); cnt = np.zeros(len(X)); np.add.at(acc, E[:, 0], X[E[:, 1]]*W[E[:, 1], None]); np.add.at(acc, E[:, 1], X[E[:, 0]]*W[E[:, 0], None]); np.add.at(cnt, E[:, 0], W[E[:, 1]]); np.add.at(cnt, E[:, 1], W[E[:, 0]]); return acc/np.maximum(cnt, 1e-9)[:, None], cnt
    known = trust.astype(float)
    for _ in range(12):                                                                       # preenche os não confiáveis a partir dos vizinhos conhecidos
        a_, c_ = navg(D, known); fill = (known == 0) & (c_ > 0); D[fill] = a_[fill]; known[fill] = 1.0
    for _ in range(6):                                                                        # alisa o campo (não as posições)
        a_, c_ = navg(D, np.ones(len(V))); D = 0.5*D + 0.5*a_
    print("   campo: %d confiaveis, %d de costura/anel preenchidos por difusao" % (trust.sum(), (ring & (w > 0)).sum()))
    N = V.copy(); N[:, 0] += w*D[:, 0]; N[:, 2] += w*D[:, 1]
    # a profundidade é reavaliada NA SUPERFÍCIE ESCULPIDA no novo (x, z): sem isso sobra micro-ruga (inclinação x deslize)
    import bmesh; from mathutils import Vector; from mathutils.bvhtree import BVHTree
    bm = bmesh.new(); bm.from_mesh(_ob().data); bvh = BVHTree.FromBMesh(bm); bm.free(); nfix = 0; nrev_ = 0
    for i in np.nonzero(np.hypot(*(N - V)[:, [0, 2]].T) > 2e-5)[0]:
        h = bvh.ray_cast(Vector((N[i, 0], -1.0, N[i, 2])), Vector((0, 1, 0)))
        lim = 0.0008 + 1.5*float(np.hypot(N[i, 0] - V[i, 0], N[i, 2] - V[i, 2]))                  # tolerância proporcional ao deslize: em flanco inclinado a profundidade muda de verdade
        if h[0] is not None and abs(h[0].y - V[i, 1]) < lim: N[i, 1] = h[0].y; nfix += 1
        else: N[i] = V[i]; nrev_ += 1                                                         # o raio pegou outra camada (borda de barba): o vértice não se move; NUNCA deixar vértice fora da superfície
    mv = np.nonzero(np.linalg.norm(N - V, axis=1) > 2e-5)[0]; off = np.array([bvh.find_nearest(Vector(N[i]))[3] for i in mv]) if len(mv) else np.zeros(1)
    _set(N); print("   profundidade reavaliada na superficie: %d vertices; nao movidos (outra camada): %d; distancia a superficie esculpida: max %.3f mm, >0,1 mm: %d" % (nfix, nrev_, off.max()*1000, (off > 1e-4).sum()))
    m = np.hypot(*(N - V)[:, [0, 2]].T)*1000; print("RESTORE_XZ: %d vertices voltaram, media %.2f mm, max %.2f mm" % ((m > 0.01).sum(), m[m > 0.01].mean(), m.max()))

# ------------------------------------------------------------------ 2. bigode cobre o lábio superior
LIPLINE = [(-27, 93.4), (-22, 94.6), (-16, 96.0), (-10, 96.8), (-4, 96.4), (0, 96.0), (4, 96.5), (9, 96.9), (15, 96.3), (21, 95.0), (27, 93.4)]   # traçada em boca_regua_busto-base.jpg
UPPER_T = [(-28, 0.0), (-25, 1.2), (-18, 2.6), (-10, 3.6), (0, 5.0), (10, 3.6), (18, 2.6), (25, 1.2), (28, 0.0)]                                  # espessura pintada do lábio superior no scan
LOWER_B = [(-27, 93.0), (-24, 91.0), (-18, 88.5), (-10, 86.8), (0, 86.3), (10, 86.8), (18, 88.5), (24, 91.0), (27, 93.0)]                         # borda inferior do lábio inferior
def moustache(keep=0.60, H=12.0):
    """Na foto (ref-15) o lábio superior é 0,30 do inferior; no scan, 0,45: os fios do bigode que cobrem o lábio não foram
    capturados. Campo vertical: a borda do bigode desce (1-keep) da espessura do lábio; o lábio comprime linearmente até a
    linha dos lábios (que não se move); acima da borda o deslocamento some em H mm (as narinas não se movem)."""
    V = _V(); x, y, z = V[:, 0]*1000, V[:, 1]*1000, V[:, 2]*1000
    zl = _interp(LIPLINE, x); t = _interp(UPPER_T, x); u = z - zl; dlt = (1 - keep)*t
    f = np.where(u <= t, np.clip(u, 0, None)/np.maximum(t, 1e-6), 1 - _ss((u - t)/H))
    reg = (np.abs(x) < 28) & (u > 0) & (u < t + H) & (y < 5) & (t > 0)
    dz = np.where(reg, -dlt*f, 0.0); V[:, 2] += dz/1000; _set(V)
    print("MOUSTACHE: %d vertices, borda desce ate %.2f mm; labio superior no centro %.1f -> %.1f mm" % ((np.abs(dz) > 1e-4).sum(), -dz.min(), _interp(UPPER_T, 0.0), keep*_interp(UPPER_T, 0.0)))

# ------------------------------------------------------------------ 3. volume do lábio inferior (só profundidade)
def lower_lip(A=2.4, groove=1.0, sulcus=0.9):
    """Nas fotos de 3/4 (ref-11, ref-14) o lábio inferior é cheio e saliente, com sombra embaixo; no S07 é uma parede plana.
    Desloca SÓ em y (direção do olhar de frente): de frente a textura não muda 1 pixel. Volume máximo a 45% da altura do lábio,
    afinando para os cantos; vinco na linha dos lábios; sulco mentolabial logo abaixo da borda inferior."""
    V = _V(); x, y, z = V[:, 0]*1000, V[:, 1]*1000, V[:, 2]*1000; zl = _interp(LIPLINE, x); zb = _interp(LOWER_B, x)
    front = (np.abs(x) < 30) & (y < 5); hgt = np.maximum(zl - zb, 1e-6); s_ = (zl - z)/hgt; tap = np.cos(np.clip(np.abs(x)/27.5, 0, 1)*np.pi/2)**1.5
    body = np.where((s_ > 0) & (s_ < 1), np.sin(np.pi*np.clip(s_, 0, 1)**0.8)**1.2, 0.0)
    dy = -A*body*tap                                                                  # para a frente
    dy += groove*np.exp(-0.5*((z - zl)/0.8)**2)*tap                                   # vinco da linha dos lábios
    dy += sulcus*np.exp(-0.5*((z - (zb - 2.5))/2.2)**2)*tap                            # sulco mentolabial
    dy = np.where(front, dy, 0.0); V[:, 1] += dy/1000; _set(V)
    print("LOWER_LIP: %d vertices; para a frente ate %.2f mm, para tras ate %.2f mm" % ((np.abs(dy) > 1e-3).sum(), -dy.min(), dy.max()))

# ------------------------------------------------------------------ 4. abertura do olho (F1: olho D deformado no scan)
def eye_open(s='D', up=0.6, lo=0.5, H_up=9.0, H_lo=6.0):
    """Na foto (ref-15, ref-21) as duas aberturas são iguais; no scan a do olho D é 15% mais baixa que a do E.
    Campo vertical: a margem superior sobe `up` mm e a inferior desce `lo` mm no meio da fenda, zero nos cantos; a pele da
    pálpebra acompanha com queda suave. O contorno traçado recebe o MESMO campo e vai para olhos_contorno_s09.json."""
    C = json.load(open(ROOT + 'analise/gate/olhos_contorno_mao.json')); Q = np.array(C[s], float); i0, i1 = Q[:, 0].argmin(), Q[:, 0].argmax(); a, b = sorted((i0, i1))
    c1 = Q[a:b+1]; c2 = np.r_[Q[b:], Q[:a+1]]; upc, loc = (c1, c2) if c1[:, 1].mean() > c2[:, 1].mean() else (c2, c1)
    upc = upc[np.argsort(upc[:, 0])]; loc = loc[np.argsort(loc[:, 0])]; xa, xb = Q[:, 0].min(), Q[:, 0].max()
    def field(x, z):
        fr = np.clip((x - xa)/(xb - xa), 0, 1); bx = np.sin(np.pi*fr)**0.8; zu = np.interp(x, upc[:, 0], upc[:, 1]); zl = np.interp(x, loc[:, 0], loc[:, 1])
        above = up*bx*(1 - _ss((z - zu)/H_up)); below = -lo*bx*(1 - _ss((zl - z)/H_lo)); sp = np.clip((z - zl)/np.maximum(zu - zl, 1e-6), 0, 1)
        return np.where(z >= zu, above, np.where(z <= zl, below, -lo*bx + sp*(up + lo)*bx))
    V = _V(); x, y, z = V[:, 0]*1000, V[:, 1]*1000, V[:, 2]*1000; reg = (x > xa - 1) & (x < xb + 1) & (y < 30) & (z > Q[:, 1].min() - H_lo) & (z < Q[:, 1].max() + H_up)
    dz = np.where(reg, field(x, z), 0.0); V[:, 2] += dz/1000; _set(V)
    Q2 = Q.copy(); Q2[:, 1] += field(Q[:, 0], Q[:, 1] + np.where(Q[:, 1] >= np.interp(Q[:, 0], upc[:, 0], upc[:, 1]) - 1e-6, 1e-6, -1e-6)); C[s] = Q2.round(2).tolist()
    if 'olhos_contorno_s09' not in C.get('_doc', ''): C['_doc'] = C.get('_doc', '') + ' | olhos_contorno_s09: olho D com a abertura igualada a do E (s09_face.eye_open)'
    json.dump(C, open(ROOT + 'analise/gate/olhos_contorno_s09.json', 'w'), indent=1)
    h0 = (upc[:, 1].max() - loc[:, 1].min()); print("EYE_OPEN %s: %d vertices; abertura %.1f -> %.1f mm (olho E: 10.9 mm em 34.0 de largura; D tem %.1f de largura)" % (s, (np.abs(dz) > 1e-4).sum(), h0, h0 + up + lo, xb - xa))
