"""S11: forma do crânio com o cabelo preso. Rodar no Blender vivo, ANTES da cirurgia dos olhos (não há shape keys ainda):
  import s11_head as H; H.dome()
Medido no S10 (unidades do scan; o scan é ~1,2x o tamanho real, então só valem PROPORÇÕES):
  - largura da cabeça 225 contra 170 de largura do rosto nas maçãs = 1,32; o normal é 1,10-1,15 (+ cabelo preso) -> alvo 198;
  - seção de frente quadrada: a 15 de distância do topo a largura é 65% da máxima; numa elipse seria 51%;
  - de perfil (ref-12 alinhada por ponta e raiz do nariz) o topo e a nuca estão certos (+-10): o perfil NÃO é mexido.
Método: em cada fatia coronal (y constante) a superfície do cabelo é levada, radialmente a partir de (x0, ZC), para uma elipse de
semieixos a(y) (meia-largura alvo) e c(y) (altura do topo, a atual). Só vértices de cabelo (cor da textura), com a máscara esfumada.
Deslocamento radial no plano xz: o vértice leva o UV junto, a textura não escorrega."""
import bpy, numpy as np
ZC = 0.205; X0 = 0.001                                   # nível da maior largura (logo acima das orelhas) e linha média
def _V():
    me = bpy.data.objects['Busto'].data; V = np.empty(len(me.vertices)*3, np.float32); me.vertices.foreach_get('co', V); return V.reshape(-1, 3).astype(np.float64)
def _ss(t): t = np.clip(t, 0, 1); return t*t*(3 - 2*t)

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

def dome(narrow=0.885, y_a=0.045, y_b=0.095, lift=0.007, nth=24, dy=0.006):
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
    me = bpy.data.objects['Busto'].data; me.vertices.foreach_set('co', N.astype(np.float32).ravel()); me.update()
    d = np.linalg.norm(N - V, axis=1)*1000; print("DOME: %d vertices movidos, medio %.1f mm, max %.1f mm" % ((d > 0.05).sum(), d[d > 0.05].mean(), d.max()))
