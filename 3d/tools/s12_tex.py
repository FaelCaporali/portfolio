"""S12 textura: o remendo cinza no topo da cabeça (buraco do scan preenchido com cinza) vira cabelo. Rodar no Blender vivo, depois da forma do crânio:
  import s12_tex; s12_tex.top_patch()
Vista de cima (ortográfica): o remendo é detectado por cor (sem saturação, claro, no topo); cada linha (y constante) do remendo é preenchida com o
cabelo que está logo ao lado, metade vindo da esquerda e metade da direita (os fios correm de frente para trás, então o deslocamento é só em x e
suave ao longo de y), com o brilho igualado ao do anel em volta. Grava em export/s12/pele_s12.jpg; a textura do scan não é tocada."""
import bpy, math, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import s10_face as F
ROOT = F.ROOT

def _blur1(a, k):
    ker = np.ones(2*k+1)/(2*k+1); return np.convolve(np.pad(a, k, mode='edge'), ker, mode='valid')
def _box2(M, k):
    M = np.apply_along_axis(lambda r: _blur1(r, k), 1, M); return np.apply_along_axis(lambda r: _blur1(r, k), 0, M)

def top_patch(step=0.0004, out='export/s12/pele_s12.jpg', gap=0.004):
    import os; os.makedirs(ROOT + 'export/s12', exist_ok=True)
    me, V, T, UV = F._mesh(); mat = me.materials[0]; tn = next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'); im = tn.image; S = im.size[0]
    px = np.empty(S*S*4, np.float32); im.pixels.foreach_get(px); tex = px.reshape(S, S, 4)[..., :3].astype(np.float64)
    bvh = BVHTree.FromPolygons([Vector(v) for v in V], T.tolist()); x0, x1, y0, y1 = -0.115, 0.115, -0.01, 0.25; nx, ny = int((x1-x0)/step)+1, int((y1-y0)/step)+1
    C = np.zeros((ny, nx, 3)); Z = np.full((ny, nx), np.nan)
    for j in range(ny):
        for i in range(nx):
            h = bvh.ray_cast(Vector((x0 + i*step, y0 + j*step, 1.0)), Vector((0, 0, -1)))
            if h[0] is None or h[0].z < 0.24: continue
            t = h[2]; a, b, c = V[T[t]]; p = np.array(h[0]); v0, v1, v2 = b - a, c - a, p - a; d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1; den = d00*d11 - d01*d01
            if abs(den) < 1e-20: continue
            w1 = (d11*d20 - d01*d21)/den; w2 = (d00*d21 - d01*d20)/den; u = UV[t, 0]*(1 - w1 - w2) + UV[t, 1]*w1 + UV[t, 2]*w2
            C[j, i] = tex[min(S-1, max(0, int(u[1]*S))), min(S-1, max(0, int(u[0]*S)))]; Z[j, i] = p[2]
    ok = ~np.isnan(Z); lum = C @ np.array([0.2126, 0.7152, 0.0722]); sat = C.max(2) - C.min(2)
    G = ok & (Z > 0.262) & (sat < 0.12) & (lum > 0.27)                                    # remendo: cinza CLARO (lum ~0,43); reflexo de cabelo não passa de 0,25
    G = _box2(G.astype(float), 4) > 0.5; G = _box2(G.astype(float), 8) > 0.06              # tira pontos soltos e dilata ~3 mm (a borda do remendo é borrada)
    hair = ok & ~G & (lum < 0.25); print("TOP: remendo %d px (%.0f cm2)" % (G.sum(), G.sum()*step*step*1e4))
    # 1) cor de base: difusão da cor do cabelo em volta para dentro do remendo (média normalizada, várias escalas)
    base = C.copy(); known = hair.astype(float)
    for k in (8, 16, 32, 64):
        num = np.stack([_box2(base[..., c]*known, k) for c in range(3)], 2); den = _box2(known, k); fill = (known == 0) & (den > 0.02) & ok
        base[fill] = num[fill]/den[fill][:, None]; known[fill] = 1.0
    base = np.stack([_box2(base[..., c], 6) for c in range(3)], 2)
    # 2) fios: ruído esticado de frente para trás, com o MESMO contraste do cabelo real em volta (medido no anel)
    ring = (_box2(G.astype(float), 30) > 0.02) & hair; det = lum - _box2(np.where(hair, lum, lum[hair].mean()), 6); sd = det[ring].std(); mean_l = lum[ring].mean()
    rng = np.random.default_rng(11); nz = rng.normal(0, 1, (ny, nx)); fine = np.apply_along_axis(lambda r: _blur1(r, 18), 0, nz); fine = np.apply_along_axis(lambda r: _blur1(r, 1), 1, fine)
    coarse = np.apply_along_axis(lambda r: _blur1(r, 45), 0, rng.normal(0, 1, (ny, nx))); coarse = np.apply_along_axis(lambda r: _blur1(r, 4), 1, coarse)
    st = 0.7*fine/fine.std() + 0.5*coarse/coarse.std(); st = st/st.std()*sd
    bl = base @ np.array([0.2126, 0.7152, 0.0722]); base = base*(mean_l/max(bl[G].mean(), 1e-3)); bl = base @ np.array([0.2126, 0.7152, 0.0722])    # a difusão puxava reflexos da borda: o preenchimento saía 22% mais claro que o anel
    N = np.clip(base*((bl + st)/np.maximum(bl, 1e-3))[..., None], 0, 1)
    Wf = np.clip(_box2(G.astype(float), 6)*1.5 - 0.15, 0, 1)                                                   # borda esfumada em ~2,5 mm
    N = C*(1 - Wf[..., None]) + N*Wf[..., None]
    print("TOP: brilho medio do anel %.3f, do preenchimento %.3f; contraste dos fios (desvio) %.3f" % (mean_l, (N @ np.array([0.2126, 0.7152, 0.0722]))[G].mean(), sd))
    # grava nos texels das faces do topo
    tc = V[T].mean(1); nrm = np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]]); nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-12)
    ci = np.clip(((tc[:, 0] - x0)/step).astype(int), 0, nx-1); cj = np.clip(((tc[:, 1] - y0)/step).astype(int), 0, ny-1)
    sel = np.nonzero((tc[:, 2] > 0.26) & (nrm[:, 2] > 0.25) & (_box2(Wf, 8)[cj, ci] > 0.01))[0]; new = tex.copy(); cnt = 0
    for t in sel:
        uvp = UV[t]*S - 0.5; xa, ya = np.floor(uvp.min(0) - 1).astype(int); xb, yb = np.ceil(uvp.max(0) + 1).astype(int)
        xs_, ys_ = np.meshgrid(np.arange(max(xa, 0), min(xb, S-1)+1), np.arange(max(ya, 0), min(yb, S-1)+1)); P = np.c_[xs_.ravel(), ys_.ravel()].astype(float)
        a, b, c = uvp; v0, v1 = b - a, c - a; den = v0[0]*v1[1] - v0[1]*v1[0]
        if abs(den) < 1e-9: continue
        w1 = ((P[:, 0]-a[0])*v1[1] - (P[:, 1]-a[1])*v1[0])/den; w2 = (v0[0]*(P[:, 1]-a[1]) - v0[1]*(P[:, 0]-a[0]))/den; w0 = 1 - w1 - w2; tol = 0.75/max(np.sqrt(abs(den)), 1.0)
        ins = (w0 > -tol) & (w1 > -tol) & (w2 > -tol)
        if not ins.any(): continue
        p3 = w0[ins, None]*V[T[t, 0]] + w1[ins, None]*V[T[t, 1]] + w2[ins, None]*V[T[t, 2]]
        qi = np.clip(((p3[:, 0] - x0)/step).round().astype(int), 0, nx-1); qj = np.clip(((p3[:, 1] - y0)/step).round().astype(int), 0, ny-1); wv = Wf[qj, qi][:, None]
        X_, Y_ = P[ins, 0].astype(int), P[ins, 1].astype(int); new[Y_, X_] = new[Y_, X_]*(1 - wv) + N[qj, qi]*wv; cnt += int((wv > 0.01).sum())
    px4 = px.reshape(S, S, 4).copy(); px4[..., :3] = new
    im2 = bpy.data.images.get('pele_s12') or bpy.data.images.new('pele_s12', S, S, alpha=False); im2.pixels.foreach_set(px4.ravel()); im2.filepath_raw = ROOT + out; im2.file_format = 'JPEG'
    bpy.context.scene.render.image_settings.quality = 95; im2.save(); im2.pack(); tn.image = im2; print("TOP: %d triangulos, %d texels escritos -> %s" % (len(sel), cnt, out))


def nostril(radius=0.0115, inner=0.0065):
    """S12: a narina ESQUERDA dele está pintada como um risco diagonal ("corte por faca"); a direita é um furo oval normal. Não há relevo de narina no scan
    (conferido em argila, de baixo): é só textura. Cada texel em volta da narina esquerda recebe a cor do ponto ESPELHADO na narina direita (ponto mais
    próximo na superfície, sem projeção: a base do nariz olha para baixo). Plano de espelho local = meio entre a ponta do nariz e a base (o nariz dele é
    torto, o plano do rosto não serve). Só textura; nenhum vértice se move."""
    me, V, T, UV = F._mesh(); mat = me.materials[0]; tn = next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'); im = tn.image; S = im.size[0]
    px = np.empty(S*S*4, np.float32); im.pixels.foreach_get(px); tex = px.reshape(S, S, 4)[..., :3].astype(np.float64); bvh = BVHTree.FromPolygons([Vector(v) for v in V], T.tolist())
    tc = V[T].mean(1); nrm = np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]]); nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-12)
    def colour(t, p):
        a, b, c = V[T[t]]; v0, v1, v2 = b - a, c - a, p - a; d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1; den = d00*d11 - d01*d01
        if abs(den) < 1e-20: return None
        w1 = (d11*d20 - d01*d21)/den; w2 = (d00*d21 - d01*d20)/den; u = UV[t, 0]*(1 - w1 - w2) + UV[t, 1]*w1 + UV[t, 2]*w2
        fx, fy = u[0]*S - 0.5, u[1]*S - 0.5; x0, y0 = int(math.floor(fx)), int(math.floor(fy)); ax, ay = fx - x0, fy - y0; x0c, x1c, y0c, y1c = np.clip([x0, x0+1, y0, y0+1], 0, S-1)
        return (tex[y0c, x0c]*(1-ax) + tex[y0c, x1c]*ax)*(1-ay) + (tex[y1c, x0c]*(1-ax) + tex[y1c, x1c]*ax)*ay
    base = (np.abs(tc[:, 0]) < 0.024) & (tc[:, 2] > 0.116) & (tc[:, 2] < 0.142) & (tc[:, 1] < -0.004) & (nrm[:, 2] < -0.25)                    # base do nariz: faces olhando para baixo
    tip = V[(np.abs(V[:, 0]) < 0.02) & (V[:, 2] > 0.12) & (V[:, 2] < 0.16)]; xt = tip[tip[:, 1].argmin(), 0]; bx = tc[base]; xm = 0.5*(xt + np.median(bx[:, 0]))
    cols = np.array([colour(t, tc[t]) for t in np.nonzero(base)[0]]); lum = cols @ np.array([0.2126, 0.7152, 0.0722]); dark = lum < np.percentile(lum, 22)
    R = bx[dark & (bx[:, 0] < xm - 0.003)]; cR = np.median(R, 0); cL = np.array([2*xm - cR[0], cR[1], cR[2]]); hit = bvh.find_nearest(Vector(cL)); cL = np.array(hit[0])
    print("NOSTRIL: plano de espelho x = %.1f mm (ponta do nariz em %.1f); narina D em %s mm; centro da E em %s mm" % (xm*1000, xt*1000, np.round(cR*1000, 1), np.round(cL*1000, 1)))
    sel = np.nonzero(np.linalg.norm(tc - cL, axis=1) < radius + 0.002)[0]; new = tex.copy(); cnt = 0; far = 0
    for t in sel:
        uvp = UV[t]*S - 0.5; xa, ya = np.floor(uvp.min(0) - 1).astype(int); xb, yb = np.ceil(uvp.max(0) + 1).astype(int)
        xs_, ys_ = np.meshgrid(np.arange(max(xa, 0), min(xb, S-1)+1), np.arange(max(ya, 0), min(yb, S-1)+1)); P = np.c_[xs_.ravel(), ys_.ravel()].astype(float)
        a, b, c = uvp; v0, v1 = b - a, c - a; den = v0[0]*v1[1] - v0[1]*v1[0]
        if abs(den) < 1e-9: continue
        w1 = ((P[:, 0]-a[0])*v1[1] - (P[:, 1]-a[1])*v1[0])/den; w2 = (v0[0]*(P[:, 1]-a[1]) - v0[1]*(P[:, 0]-a[0]))/den; w0 = 1 - w1 - w2; tol = 0.75/max(np.sqrt(abs(den)), 1.0)
        for k in np.nonzero((w0 > -tol) & (w1 > -tol) & (w2 > -tol))[0]:
            p3 = w0[k]*V[T[t, 0]] + w1[k]*V[T[t, 1]] + w2[k]*V[T[t, 2]]; d = np.linalg.norm(p3 - cL); wv = 1 - F._ss((d - inner)/(radius - inner))
            if wv <= 0: continue
            q = Vector((2*xm - p3[0], p3[1], p3[2])); h = bvh.find_nearest(q)
            if h[0] is None: continue
            if (h[0] - q).length > 0.004: far += 1
            cq = colour(h[2], np.array(h[0]))
            if cq is None: continue
            X_, Y_ = int(P[k, 0]), int(P[k, 1]); new[Y_, X_] = new[Y_, X_]*(1 - wv) + cq*wv; cnt += 1
    px4 = px.reshape(S, S, 4).copy(); px4[..., :3] = new; im.pixels.foreach_set(px4.ravel())
    if im.filepath_raw: im.save()
    im.pack(); print("NOSTRIL: %d triangulos, %d texels; %d texels com ponto espelhado a mais de 4 mm da superficie (assimetria do nariz)" % (len(sel), cnt, far))
