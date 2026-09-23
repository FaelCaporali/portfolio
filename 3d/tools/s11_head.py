"""S11: forma do crânio com o cabelo preso. Rodar no Blender vivo, ANTES da cirurgia dos olhos (não há shape keys ainda):
  import s11_head as H; H.dome()
Medido no S10 (unidades do scan; o scan é ~1,2x o tamanho real, então só valem PROPORÇÕES):
  - largura da cabeça 225 contra 170 de largura do rosto nas maçãs = 1,32; o normal é 1,10-1,15 (+ cabelo preso) -> alvo 198;
  - seção de frente quadrada: a 15 de distância do topo a largura é 65% da máxima; numa elipse seria 51%;
  - de perfil (ref-12 alinhada por ponta e raiz do nariz) o topo e a nuca estão certos (+-10): o perfil NÃO é mexido.
Método: em cada fatia coronal (y constante) a superfície do cabelo é levada, radialmente a partir de (x0, ZC), para uma elipse de
semieixos a(y) (meia-largura alvo) e c(y) (altura do topo, a atual). Só vértices de cabelo (cor da textura), com a máscara esfumada.
Deslocamento radial no plano xz: o vértice leva o UV junto, a textura não escorrega."""
import bpy, os, numpy as np
GATE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'analise', 'gate')
ZC = 0.205; X0 = 0.001                                   # nível da maior largura (logo acima das orelhas) e linha média
def _V():
    me = bpy.data.objects['Busto'].data; V = np.empty(len(me.vertices)*3, np.float32); me.vertices.foreach_get('co', V); return V.reshape(-1, 3).astype(np.float64)
def _ss(t): t = np.clip(t, 0, 1); return t*t*(3 - 2*t)

def _diffuse(F, it):
    """Difunde um campo por vértice no grafo da malha (F: n ou n x k)."""
    me = bpy.data.objects['Busto'].data; n = len(me.vertices); E = np.empty(len(me.edges)*2, np.int64); me.edges.foreach_get('vertices', E); E = E.reshape(-1, 2); deg = np.maximum(np.bincount(E.ravel(), minlength=n).astype(float), 1)
    F = np.array(F, float); sh = F.shape; F = F.reshape(n, -1)
    for _ in range(it):
        s_ = np.zeros_like(F); np.add.at(s_, E[:, 0], F[E[:, 1]]); np.add.at(s_, E[:, 1], F[E[:, 0]]); F = 0.5*F + 0.5*s_/deg[:, None]
    return F.reshape(sh)

def hair_mask(feather=260):
    """Peso de cabelo por vértice: escuro na textura (ou o remendo cinza do topo), fora do rosto e da barba; esfumado no grafo da malha."""
    ob = bpy.data.objects['Busto']; me = ob.data; V = _V(); n = len(V)
    im = next(nd.image for nd in me.materials[0].node_tree.nodes if nd.type == 'TEX_IMAGE'); S = im.size[0]; px = np.empty(S*S*4, np.float32); im.pixels.foreach_get(px); tex = px.reshape(S, S, 4)[..., :3]
    lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv); uv = np.empty(len(me.loops)*2, np.float32); me.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
    first = np.full(n, -1); first[lv[::-1]] = np.arange(len(lv))[::-1]; u = uv[first]; c = tex[np.clip((u[:, 1]*S).astype(int), 0, S-1), np.clip((u[:, 0]*S).astype(int), 0, S-1)]
    lum = c @ np.array([0.2126, 0.7152, 0.0722]); x, y, z = V[:, 0], V[:, 1], V[:, 2]
    hair = ((lum < 0.16) | (z > 0.285) | (y > 0.13)) & (z > 0.150) & ~((y < 0.085) & (z < 0.215))          # barba, costeleta e rosto ficam fora
    E = np.empty(len(me.edges)*2, np.int64); me.edges.foreach_get('vertices', E); E = E.reshape(-1, 2); w = hair.astype(float); deg = np.bincount(E.ravel(), minlength=n).astype(float)
    def diff(w, k):
        for _ in range(k):
            s_ = np.zeros(n); np.add.at(s_, E[:, 0], w[E[:, 1]]); np.add.at(s_, E[:, 1], w[E[:, 0]]); w = 0.5*w + 0.5*s_/np.maximum(deg, 1)
        return w
    w = (diff(w, 40) > 0.5).astype(float)                       # tira ilhas: fio claro no meio do cabelo, mancha escura na pele
    w = diff(w, feather)                                         # transição LARGA (~25 mm): com 5 mm a borda da máscara virou um degrau na linha do cabelo (visto em argila)
    w = _ss((w - 0.12)/0.76); print("HAIR_MASK: %d vertices com peso > 0,5 (%.0f%% da malha)" % ((w > 0.5).sum(), 100*(w > 0.5).mean())); return w

def dome(narrow=0.885, y_a=0.045, y_b=0.095, lift=0.007, nth=24, dy=0.006, smooth=0):
    V = _V(); w = hair_mask(); x, y, z = V[:, 0] - X0, V[:, 1], V[:, 2] - ZC
    ys = np.arange(0.012, 0.236, dy); th_e = np.linspace(0, np.pi/2, nth+1); th_c = (th_e[:-1] + th_e[1:])/2
    up = (z >= 0) & (w > 0.5); th = np.arctan2(z, np.abs(x)); r = np.hypot(x, z)
    RB = np.full((len(ys), 2, nth), np.nan); A = np.zeros((len(ys), 2)); C = np.zeros(len(ys))
    for i, yc in enumerate(ys):                                   # raio atual da superfície por fatia, lado e ângulo
        m = up & (np.abs(y - yc) < dy)
        for sd, sg in enumerate((1, -1)):
            ms = m & (x*sg >= 0); b = np.clip((th[ms]/(np.pi/2)*nth).astype(int), 0, nth-1)
            for k in range(nth):
                q = r[ms][b == k]
                if len(q) > 3: RB[i, sd, k] = np.percentile(q, 97)
    def fill(a):
        ok = ~np.isnan(a); return np.interp(np.arange(len(a)), np.nonzero(ok)[0], a[ok]) if ok.sum() > 1 else a
    for i in range(len(ys)):
        for sd in (0, 1): RB[i, sd] = fill(RB[i, sd])
    for sd in (0, 1):
        for k in range(nth): RB[:, sd, k] = fill(RB[:, sd, k])
    for _ in range(3): RB[1:-1] = (RB[:-2] + 2*RB[1:-1] + RB[2:])/4                                        # alisa ao longo de y
    C = RB[:, :, -1].mean(1) + lift*np.exp(-0.5*((ys - 0.13)/0.05)**2)                                    # topo: o atual + 7 mm no cocuruto (frente pede +8 a +12, perfil pede 0: meio-termo)
    s_y = 1 - (1 - narrow)*_ss((ys - y_a)/(y_b - y_a)); A = RB[:, :, 0]*s_y[:, None]                       # meia-largura alvo por lado (a assimetria dele fica)
    RT = np.empty_like(RB)
    for sd in (0, 1): RT[:, sd, :] = (A[:, sd, None]*C[:, None])/np.sqrt((C[:, None]*np.cos(th_c))**2 + (A[:, sd, None]*np.sin(th_c))**2)
    K = RT/RB                                                      # fator radial: leva a superfície atual para a elipse
    print("DOME: fator radial min %.3f max %.3f; meia-largura max %.1f -> %.1f mm; topo max %.1f -> %.1f mm" % (K.min(), K.max(), RB[:, :, 0].max()*1000, A.max()*1000, (RB[:, :, -1].max()+ZC)*1000, (C.max()+ZC)*1000))
    # aplica: interpola K em (y, lado, ângulo); abaixo de ZC vale o fator do ângulo 0 (só estreita); some nas pontas em y
    fi = np.clip((y - ys[0])/dy, 0, len(ys)-1.001); i0 = fi.astype(int); fa = fi - i0; sd = (x < 0).astype(int)
    tk = np.clip(np.where(z >= 0, th, 0.0)/(np.pi/2)*nth - 0.5, 0, nth-1.001); k0 = tk.astype(int); fk = tk - k0
    k_ = (K[i0, sd, k0]*(1-fk) + K[i0, sd, k0+1]*fk)*(1-fa) + (K[i0+1, sd, k0]*(1-fk) + K[i0+1, sd, k0+1]*fk)*fa
    wy = _ss((y - 0.012)/0.03)*(1 - _ss((y - 0.215)/0.03)); wz = np.where(z >= 0, 1.0, 1 - 0.5*_ss((-z)/0.06))   # para baixo das orelhas o efeito cai à metade
    ww = w*wy*wz; kk = 1 + (k_ - 1)*ww
    N = V.copy(); N[:, 0] = X0 + x*kk; N[:, 2] = ZC + np.where(z >= 0, z*kk, z)
    if smooth:                                                     # S12: o deslocamento é difundido (raio ~10 mm). Sem isso ficavam, em argila, uma quina horizontal em z=ZC, faixas verticais (fatias de 6 mm) e o contorno da orelha em relevo tosco
        N = V + _diffuse(N - V, smooth)*w[:, None]
    me = bpy.data.objects['Busto'].data; me.vertices.foreach_set('co', N.astype(np.float32).ravel()); me.update()
    d = np.linalg.norm(N - V, axis=1)*1000; print("DOME: %d vertices movidos, medio %.1f mm, max %.1f mm" % ((d > 0.05).sum(), d[d > 0.05].mean(), d.max()))


# ------------------------------------------------------------------ S12: laterais atrás das orelhas, medidas contra a foto de longe
def sides(y_a=0.100, y_b=0.135, ear_gap=0.003, smooth=200, json_path=os.path.join(GATE, 'ref22_largura.json')):
    """A conferência do S11 usou fotos de perto (0,36 m): em perspectiva a metade de trás da cabeça some atrás do rosto, então a largura do
    cabelo atrás das orelhas ficou sem medida. A ref-22 foi tirada de longe (quase ortográfica): largura total da silhueta por altura, em
    unidades de distância interpupilar (tools: medição gravada em analise/gate/ref22_largura.json). Aqui o cabelo atrás das orelhas
    (y > 100 mm) é estreitado, por altura e por lado, até a meia-largura da foto menos ear_gap (na foto quem faz a silhueta é a ORELHA).
    Só estreita, nunca alarga; rosto, orelhas e cúpula (acima de +0,9 IPD) não entram."""
    import json
    P = json.load(open(json_path))['prof']; IPD = 0.07915; EZ = 0.18005; ks = np.array(sorted(map(float, P))); tot = np.array([sum(P[str(k)]) for k in ks])
    tot = np.convolve(np.pad(tot, 1, mode='edge'), [0.25, 0.5, 0.25], mode='valid')                         # a foto tem 3 mm de ruído por linha
    V = _V(); w = hair_mask(); x, y, z = V[:, 0] - X0, V[:, 1], V[:, 2]; kz = (z - EZ)/IPD; T = np.interp(kz, ks, tot)*IPD/2 - ear_gap
    zs = np.arange(0.125, 0.262, 0.004); K = np.ones((len(zs), 2)); rep = []
    for i, zc in enumerate(zs):
        for sd, sg in enumerate((1, -1)):
            m = (np.abs(z - zc) < 0.004) & (x*sg > 0.05) & (y > y_b) & (w > 0.5)
            if m.sum() > 20:
                hw = np.percentile(np.abs(x[m]), 98); t_ = np.interp((zc - EZ)/IPD, ks, tot)*IPD/2 - ear_gap; K[i, sd] = min(1.0, t_/hw)
    for _ in range(2): K[1:-1] = (K[:-2] + 2*K[1:-1] + K[2:])/4
    fi = np.clip((z - zs[0])/0.004, 0, len(zs)-1.001); i0 = fi.astype(int); fa = fi - i0; sd = (x < 0).astype(int); k_ = K[i0, sd]*(1-fa) + K[i0+1, sd]*fa
    wz = _ss((z - 0.120)/0.02)*(1 - _ss((z - 0.245)/0.02)); wy = _ss((y - y_a)/(y_b - y_a)); ww = w*wy*wz
    dx = x*(k_ - 1)*ww
    # o CAMPO de deslocamento é difundido na malha (como um pincel Grab de raio ~13 mm): janelas retas em y e z deixaram um RETÂNGULO em relevo na lateral, visto em argila
    me = bpy.data.objects['Busto'].data; n = len(V); E = np.empty(len(me.edges)*2, np.int64); me.edges.foreach_get('vertices', E); E = E.reshape(-1, 2); deg = np.bincount(E.ravel(), minlength=n).astype(float)
    for _ in range(smooth):
        s_ = np.zeros(n); np.add.at(s_, E[:, 0], dx[E[:, 1]]); np.add.at(s_, E[:, 1], dx[E[:, 0]]); dx = 0.5*dx + 0.5*s_/np.maximum(deg, 1)
    dx *= w                                                                                   # rosto e orelhas (peso de cabelo ~0) não andam
    N = V.copy(); N[:, 0] = V[:, 0] + dx
    me.vertices.foreach_set('co', N.astype(np.float32).ravel()); me.update()
    d = np.abs(N[:, 0] - V[:, 0])*1000; print("SIDES: fator min %.3f (lado E) %.3f (lado D); %d vertices, medio %.1f mm, max %.1f mm" % (K[:, 0].min(), K[:, 1].min(), (d > 0.05).sum(), d[d > 0.05].mean(), d.max()))

def width_report(json_path=os.path.join(GATE, 'ref22_largura.json')):
    import json
    P = json.load(open(json_path)); IPD = 79.15; EZ = 180.05; V = _V()*1000; print("LARGURA malha x foto (ref-22), total em mm; topo malha %.2f IPD, foto %.2f" % ((V[:, 2].max() - EZ)/IPD, P['top']))
    for k in sorted(map(float, P['prof']), reverse=True):
        m = np.abs(V[:, 2] - (EZ + k*IPD)) < 1.5; ear = m & (V[:, 1] > 75) & (V[:, 1] < 135); print("  %+.1f IPD: malha %.0f | foto %.0f | dif %+.1f | orelhas/frente %.0f" % (k, np.ptp(V[m, 0]), sum(P['prof'][str(k)])*IPD, np.ptp(V[m, 0]) - sum(P['prof'][str(k)])*IPD, np.ptp(V[ear, 0]) if ear.any() else 0))


def relax(V0, it=150):
    """S12: acabamento do campo total (cúpula + laterais). Onde a máscara de cabelo cai para 0 (orelha, nuca, linha do cabelo) um deslocamento de
    10-20 mm morria em ~15 mm de distância: gradiente de 0,5 a 2 mm/mm = DOBRA visível em argila (a 'quina' atrás da orelha). Aqui o campo inteiro é
    difundido de novo, depois da máscara: a transição passa a ter ~25 mm e a orelha acompanha o cabelo vizinho em vez de ficar para trás."""
    V = _V(); D = _diffuse(V - V0, it); N = V0 + D; me = bpy.data.objects['Busto'].data
    E = np.empty(len(me.edges)*2, np.int64); me.edges.foreach_get('vertices', E); E = E.reshape(-1, 2); L = np.linalg.norm(V0[E[:, 0]] - V0[E[:, 1]], axis=1)
    g0 = np.linalg.norm((V - V0)[E[:, 0]] - (V - V0)[E[:, 1]], axis=1)/np.maximum(L, 1e-9); g1 = np.linalg.norm(D[E[:, 0]] - D[E[:, 1]], axis=1)/np.maximum(L, 1e-9)
    face = (np.abs(V0[:, 0]) < 0.070) & (V0[:, 1] < 0.060) & (V0[:, 2] > 0.09) & (V0[:, 2] < 0.24); ear = (np.abs(V0[:, 0]) > 0.075) & (V0[:, 1] > 0.08) & (V0[:, 1] < 0.13) & (V0[:, 2] > 0.15) & (V0[:, 2] < 0.215)
    me.vertices.foreach_set('co', N.astype(np.float32).ravel()); me.update()
    print("RELAX: gradiente do campo p99 %.2f -> %.2f, max %.2f -> %.2f mm/mm; vazamento no rosto max %.2f mm; orelhas andam em media %.1f mm" % (np.percentile(g0, 99), np.percentile(g1, 99), g0.max(), g1.max(), np.linalg.norm(D[face], axis=1).max()*1000, np.linalg.norm(D[ear], axis=1).mean()*1000))


def ears(A=0.0070, soften=14):
    """S12: o scan NÃO tem orelha em relevo (conferido em argila no S07/S10: só pintura). Na foto de longe (ref-22) a silhueta na altura dos olhos é a
    orelha e mede 189; na malha a região da orelha mede 180: faltam ~4,5 mm de cada lado. Aqui a região pintada de orelha (pele, na caixa da orelha)
    sai lateralmente em aba: 0 na frente (trago, onde a orelha nasce do rosto) até A na borda de trás (hélice), com a borda suavizada em ~3 mm."""
    me = bpy.data.objects['Busto'].data; V = _V(); n = len(V); im = next(nd.image for nd in me.materials[0].node_tree.nodes if nd.type == 'TEX_IMAGE'); S = im.size[0]
    px = np.empty(S*S*4, np.float32); im.pixels.foreach_get(px); tex = px.reshape(S, S, 4)[..., :3]
    lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv); uv = np.empty(len(me.loops)*2, np.float32); me.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
    first = np.full(n, -1); first[lv[::-1]] = np.arange(len(lv))[::-1]; u = uv[first]; c = tex[np.clip((u[:, 1]*S).astype(int), 0, S-1), np.clip((u[:, 0]*S).astype(int), 0, S-1)]
    lum = c @ np.array([0.2126, 0.7152, 0.0722]); skin = (lum > 0.21) & (c[:, 0] > 1.05*c[:, 2]); D = np.zeros(n)                # a orelha é pálida: a razão R/B de pele do rosto (1,25) deixava a metade de cima de fora
    for sg in (1, -1):
        box = (V[:, 0]*sg > 0.070) & (V[:, 1] > 0.094) & (V[:, 1] < 0.144) & (V[:, 2] > 0.144) & (V[:, 2] < 0.204)      # medido com régua no perfil texturizado: orelha em y 100..140, z 146..200
        m = _diffuse((box & skin).astype(float), 8) > 0.5; m &= box
        if m.sum() < 50: print("EARS: orelha nao encontrada, lado", sg); continue
        y0, y1 = np.percentile(V[m, 1], [4, 96]); z0, z1 = np.percentile(V[m, 2], [3, 97]); z1 += 0.004          # a ponta de cima da orelha é escura na textura (cabelo por cima)
        # a máscara de cor é esfarelada (a concha é escura): em argila a aba virou um caroço. A forma aplicada é a ELIPSE medida da orelha, lisa.
        m = box & ((((V[:, 1] - (y0 + y1)/2)/((y1 - y0)/2))**2 + ((V[:, 2] - (z0 + z1)/2)/((z1 - z0)/2))**2) < 1.0)
        t = np.clip((V[:, 1] - y0)/(y1 - y0), 0, 1); fz = 0.35 + 0.65*_ss((V[:, 2] - 0.150)/0.025)                      # a hélice (em cima) sai mais que o lóbulo: foto 189 na linha dos olhos, 184 no lóbulo
        D += np.where(m, sg*A*_ss(t/0.6)*fz, 0.0)
        print("EARS lado %s: %d vertices, y %.0f..%.0f mm, z %.0f..%.0f mm" % ('E' if sg > 0 else 'D', m.sum(), y0*1000, y1*1000, V[m, 2].min()*1000, V[m, 2].max()*1000))
    D = _diffuse(D, soften); V[:, 0] += D; me.vertices.foreach_set('co', V.astype(np.float32).ravel()); me.update()
    E = np.empty(len(me.edges)*2, np.int64); me.edges.foreach_get('vertices', E); E = E.reshape(-1, 2); V0 = V.copy(); V0[:, 0] -= D
    r = np.linalg.norm(V[E[:, 0]] - V[E[:, 1]], axis=1)/np.maximum(np.linalg.norm(V0[E[:, 0]] - V0[E[:, 1]], axis=1), 1e-9); print("EARS: aba max %.1f mm; aresta mais esticada %.2fx, >1,5x: %d" % (np.abs(D).max()*1000, r.max(), (r > 1.5).sum()))
