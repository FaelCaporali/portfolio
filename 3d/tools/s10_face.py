"""S10: correções sobre o S07 ANTES da cirurgia dos olhos. Rodar no Blender interativo, um passo por vez:
  import s10_face as F; F.F9.restore_xz(); F.F9.moustache(); F.lower_lip(); F.mirror_eye()
Mudanças em relação ao S09:
  lower_lip  -> o Fael tem a arcada inferior retraída: de perfil (ref-12, ref-13) o lábio inferior fica ATRÁS do superior.
                O volume de 2,4 mm do S09 virou "biquinho". Aqui só o vinco da linha dos lábios e 0,5 mm de corpo.
  mirror_eye -> F1 ("corrigir o olho direito usando o esquerdo como referência"): a região periocular D recebe a do E
                espelhada, em profundidade E em textura. Substitui o eye_open do S09.
Frame: x+ = lado esquerdo dele, -y = frente, z = altura; metros no arquivo."""
import bpy, json, math, numpy as np, importlib, s09_face as F9
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT = F9.ROOT; _V, _set, _ss = F9._V, F9._set, F9._ss
CD = (-0.0387, 0.1795); CE = (0.04045, 0.1806)                     # centros (x, z) dos globos: íris medidas na foto (S09)
AX, AZ = 0.028, 0.017                                              # semieixos da região trocada (elipse), m
W0 = 0.62                                                          # raio normalizado até onde a troca é total; daí até 1,0 esfuma

def lower_lip(A=0.5, groove=0.9, sulcus=0.4): F9.lower_lip(A=A, groove=groove, sulcus=sulcus)

def to_E(x, z): return CE[0] - (x - CD[0]), z + (CE[1] - CD[1])
def weight(x, z):
    r = np.hypot((x - CD[0])/AX, (z - CD[1])/AZ); return 1 - _ss((r - W0)/(1 - W0))

def _mesh():
    me = bpy.data.objects['Busto'].data; me.calc_loop_triangles(); n = len(me.loop_triangles)
    tv = np.empty(n*3, np.int64); me.loop_triangles.foreach_get('vertices', tv); tl = np.empty(n*3, np.int64); me.loop_triangles.foreach_get('loops', tl)
    uv = np.empty(len(me.loops)*2, np.float32); me.uv_layers[0].data.foreach_get('uv', uv); V = _V()
    return me, V, tv.reshape(-1, 3), uv.reshape(-1, 2)[tl.reshape(-1, 3)]

def _maps(V, T, UV, tex, cx, cz, sgn, step=0.0002, hx=0.034, hz=0.024):
    """Mapa frontal (profundidade e cor) em torno de (cx, cz). sgn=-1 espelha o x: a coluna i é sempre 'de medial para lateral do olho D'."""
    bvh = BVHTree.FromPolygons([Vector(v) for v in V], T.tolist()); nx, nz = int(2*hx/step)+1, int(2*hz/step)+1
    Y = np.full((nz, nx), np.nan); C = np.zeros((nz, nx, 3)); S = tex.shape[0]
    for j in range(nz):
        z = cz - hz + j*step
        for i in range(nx):
            x = cx + sgn*(-hx + i*step); h = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
            if h[0] is None: continue
            t = h[2]; a, b, c = V[T[t]]; p = np.array(h[0]); v0, v1, v2 = b - a, c - a, p - a
            d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1; den = d00*d11 - d01*d01
            if abs(den) < 1e-20: continue
            w1 = (d11*d20 - d01*d21)/den; w2 = (d00*d21 - d01*d20)/den; u = UV[t, 0]*(1 - w1 - w2) + UV[t, 1]*w1 + UV[t, 2]*w2
            fx, fy = u[0]*S - 0.5, u[1]*S - 0.5; x0, y0 = int(math.floor(fx)), int(math.floor(fy)); ax, ay = fx - x0, fy - y0
            x0c, x1c, y0c, y1c = np.clip([x0, x0+1, y0, y0+1], 0, S-1)
            C[j, i] = (tex[y0c, x0c]*(1-ax) + tex[y0c, x1c]*ax)*(1-ay) + (tex[y1c, x0c]*(1-ax) + tex[y1c, x1c]*ax)*ay; Y[j, i] = p[1]
    return Y, C

def _blur(A, M, sig):
    import numpy as np
    k = int(3*sig) | 1; g = np.exp(-0.5*(np.arange(-k, k+1)/sig)**2); g /= g.sum()
    def conv(X):
        X = np.apply_along_axis(lambda r: np.convolve(np.pad(r, k, mode='edge'), g, mode='valid'), 1, X); return np.apply_along_axis(lambda r: np.convolve(np.pad(r, k, mode='edge'), g, mode='valid'), 0, X)
    m = conv(M.astype(float)); return np.stack([conv(A[..., c]*M)/np.maximum(m, 1e-4) for c in range(A.shape[2])], 2)

def _inpoly_grid(poly, X, Z):
    x, z = poly[:, 0], poly[:, 1]; ins = np.zeros(X.shape, bool); j = len(poly)-1
    for i in range(len(poly)):
        ins ^= ((z[i] > Z) != (z[j] > Z)) & (X < (x[j]-x[i])*(Z-z[i])/(z[j]-z[i]+1e-15) + x[i]); j = i
    return ins

def mirror_eye(step=0.0002, hx=0.034, hz=0.024, sig_mm=7.0, out='export/s10/pele_s10.jpg'):
    ob = bpy.data.objects['Busto']; me, V, T, UV = _mesh(); mat = me.materials[0]; tn = next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'); im = tn.image
    S = im.size[0]; px = np.empty(S*S*4, np.float32); im.pixels.foreach_get(px); tex = px.reshape(S, S, 4)[..., :3].astype(np.float64)
    YD, CDm = _maps(V, T, UV, tex, CD[0], CD[1], +1, step, hx, hz); YE, CEm = _maps(V, T, UV, tex, CE[0], CE[1], -1, step, hx, hz)
    # sgn=-1 já devolve o E na grade do D: coluna i <-> x_D = CD.x - hx + i*step
    nz, nx = YD.shape; gx = CD[0] - hx + np.arange(nx)*step; gz = CD[1] - hz + np.arange(nz)*step; GX, GZ = np.meshgrid(gx, gz); Wg = weight(GX, GZ)
    # --- profundidade: plano de ajuste no anel de transição (o rosto não é simétrico em rotação), depois troca ponderada
    r = np.hypot((GX - CD[0])/AX, (GZ - CD[1])/AZ); ring = (r > 0.8) & (r < 1.15) & ~np.isnan(YD) & ~np.isnan(YE)
    A_ = np.c_[np.ones(ring.sum()), GX[ring], GZ[ring]]; dif = (YD - YE)[ring]; k = np.linalg.lstsq(A_, dif, rcond=None)[0]
    res = dif - A_ @ k; print("MIRROR profundidade: plano D-E = %.2f mm %+.3f*x %+.3f*z ; residuo no anel rms %.2f mm, max %.2f mm" % (k[0]*1000, k[1], k[2], res.std()*1000, np.abs(res).max()*1000))
    DY = np.nan_to_num((YE + k[0] + k[1]*GX + k[2]*GZ) - YD)*Wg        # quanto a superfície D anda em y, por pixel
    # --- cor: E espelhado, com o tom de baixa frequência do lado D (a luz assada é diferente de cada lado)
    C9 = json.load(open(ROOT + 'analise/gate/olhos_contorno_mao.json')); PD = np.array(C9['D'])/1000; PE = np.array(C9['E'])/1000
    PEm = np.c_[CD[0] - (PE[:, 0] - CE[0]), PE[:, 1] - (CE[1] - CD[1])]
    def grow(P, d): c = P.mean(0); v = P - c; return c + v*(1 + d/np.linalg.norm(v, axis=1, keepdims=True))
    hole = _inpoly_grid(grow(PD, 0.003), GX, GZ) | _inpoly_grid(grow(PEm, 0.003), GX, GZ); ok = ~hole & ~np.isnan(YD) & ~np.isnan(YE)
    sig = sig_mm/1000/step; lowD = _blur(CDm, ok, sig); lowE = _blur(CEm, ok, sig); Lw = np.array([0.2126, 0.7152, 0.0722]); g0 = lowD/np.maximum(lowE, 1e-3)
    gl = np.clip((lowD @ Lw)/np.maximum(lowE @ Lw, 1e-3), 0.75, 1.30)[..., None]              # o tom do lado D entra pela LUMINÂNCIA
    gain = gl*np.clip(g0/gl, 0.95, 1.05); N = np.clip(CEm*gain, 0, 1)                           # matiz: no máximo 5% (ganho livre por canal deu mancha oliva na pálpebra)
    print("MIRROR cor: ganho medio RGB %s (min %.2f max %.2f)" % (np.round(gain[Wg > 0.5].mean(0), 2), gain[Wg > 0.5].min(), gain[Wg > 0.5].max()))
    # --- geometria
    front = (np.abs(V[:, 0] - CD[0]) < hx - 2*step) & (np.abs(V[:, 2] - CD[1]) < hz - 2*step) & (V[:, 1] < 0.05)
    idx = np.nonzero(front)[0]; fi = (V[idx, 0] - gx[0])/step; fj = (V[idx, 2] - gz[0])/step
    def bil(M, fi, fj):
        i0 = np.floor(fi).astype(int); j0 = np.floor(fj).astype(int); a = fi - i0; b = fj - j0
        if M.ndim == 3: a = a[:, None]; b = b[:, None]
        return (M[j0, i0]*(1-a) + M[j0, i0+1]*a)*(1-b) + (M[j0+1, i0]*(1-a) + M[j0+1, i0+1]*a)*b
    yd = bil(np.nan_to_num(YD, nan=9.0), fi, fj); vis = np.abs(yd - V[idx, 1]) < 0.0012                    # só a camada vista de frente
    dy = bil(DY, fi, fj)*vis; V2 = V.copy(); V2[idx, 1] += dy; _set(V2)
    print("MIRROR geometria: %d vertices, |dy| medio %.2f mm, max %.2f mm (p95 %.2f)" % ((np.abs(dy) > 1e-5).sum(), np.abs(dy[np.abs(dy) > 1e-5]).mean()*1000, np.abs(dy).max()*1000, np.percentile(np.abs(dy[np.abs(dy) > 1e-5]), 95)*1000))
    # --- textura: cada texel das faces da região recebe a cor nova na posição (x, z) dele
    tc = V[T].mean(1); sel = np.nonzero((np.hypot((tc[:, 0] - CD[0])/AX, (tc[:, 2] - CD[1])/AZ) < 1.05) & (tc[:, 1] < 0.05) & vis_tri(V, T, idx, vis))[0]; new = tex.copy(); cnt = 0
    for t in sel:
        uvp = UV[t]*S - 0.5; x0, y0 = np.floor(uvp.min(0) - 1).astype(int); x1, y1 = np.ceil(uvp.max(0) + 1).astype(int)
        xs, ys = np.meshgrid(np.arange(max(x0, 0), min(x1, S-1)+1), np.arange(max(y0, 0), min(y1, S-1)+1)); P = np.c_[xs.ravel(), ys.ravel()].astype(float)
        a, b, c = uvp; v0, v1 = b - a, c - a; den = v0[0]*v1[1] - v0[1]*v1[0]
        if abs(den) < 1e-9: continue
        w1 = ((P[:, 0]-a[0])*v1[1] - (P[:, 1]-a[1])*v1[0])/den; w2 = (v0[0]*(P[:, 1]-a[1]) - v0[1]*(P[:, 0]-a[0]))/den; w0 = 1 - w1 - w2
        tol = 0.75/max(np.sqrt(abs(den)), 1.0); ins = (w0 > -tol) & (w1 > -tol) & (w2 > -tol)
        if not ins.any(): continue
        p3 = w0[ins, None]*V[T[t, 0]] + w1[ins, None]*V[T[t, 1]] + w2[ins, None]*V[T[t, 2]]
        qi = np.clip((p3[:, 0] - gx[0])/step, 0, nx-1.001); qj = np.clip((p3[:, 2] - gz[0])/step, 0, nz-1.001); col = bil(N, qi, qj); w = weight(p3[:, 0], p3[:, 2])[:, None]
        X_, Y_ = P[ins, 0].astype(int), P[ins, 1].astype(int); new[Y_, X_] = new[Y_, X_]*(1 - w) + col*w; cnt += ins.sum()
    px4 = px.reshape(S, S, 4).copy(); px4[..., :3] = new
    im2 = bpy.data.images.get('pele_s10') or bpy.data.images.new('pele_s10', S, S, alpha=False); im2.pixels.foreach_set(px4.ravel()); im2.filepath_raw = ROOT + out; im2.file_format = 'JPEG'
    bpy.context.scene.render.image_settings.quality = 95; im2.save(); im2.pack(); tn.image = im2
    print("MIRROR textura: %d triangulos, %d texels escritos -> %s" % (len(sel), cnt, out))
    # contorno do olho D = contorno do E espelhado
    C9['D'] = (PEm*1000).round(2).tolist()[::-1]; C9['_doc'] = C9.get('_doc', '') + ' | olhos_contorno_s10: D = E espelhado (s10_face.mirror_eye)'
    json.dump(C9, open(ROOT + 'analise/gate/olhos_contorno_s10.json', 'w'), indent=1)

def vis_tri(V, T, idx, vis):
    ok = np.zeros(len(V), bool); ok[idx[vis]] = True; return ok[T].all(1)
