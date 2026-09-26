"""Pele das mãos do `uber` (U3: aderente ao busto em estilo, textura e tonalidade), da MESMA fonte da pele do S13.

Fonte: a textura do busto (`pele_s13`, a que o glb do site usa). Uma amostra da bochecha direita dele (ilha única no UV,
sem barba, sem sombra de olho) dá a paleta e o microdetalhe (manchas suaves do scan); um ladrilho sem costura é
montado por retalhos dessa amostra e projetado nas mãos em três planos pela posição de REPOUSO, na mesma densidade de
texel do rosto (≈ 2050 texel por unidade do glb). Sobre ela: palma mais clara, rubor nos nós, rugas finas nas juntas
(dorso e palma), unha com cutícula, lúnula e borda livre, e oclusão de ambiente por vértice (a pele do busto também
traz a luz assada do scan). Rugosidade da pele 0,50–0,65 com variação (ADENDO 4); unha em material próprio.

Calibração de tom (K_COR): medida no render da câmera do 1440 (ΔE2000 dorso × bochecha, prop_uber_prova.py);
o valor abaixo é o que a medida devolveu, não um ajuste de olho.
"""
import math

import bpy
import numpy as np

import prop_uber_mao_relevo as RL
import prop_vela_base as B

AMOSTRA = (90, 453, 170, 573)             # retângulo (x0, y0, x1, y1) na textura 2048² (linhas de cima), bochecha D
DENS = 2050.0                              # texel por unidade do glb no rosto (medido no S13)
K_COR = np.array((1.07, 0.97, 0.95))       # calibração de tom por medida (ΔE no render do 1440; ver LOG)
RES = 1024
GAMA = 1.15                                # fração da compensação da luz do site (ver cor_pele)
AMBIENTE = 0.35                            # luz sem direção (ambiente + env) no modelo de compensação
SATURA = 0.90                              # saturação relativa à amostra da bochecha
LUZES = [(np.array(d) / np.linalg.norm(d), i) for d, i in (((-0.6, -0.9, 0.8), 2.2), ((0.8, -0.6, 0.3), 0.6),
                                                           ((0.3, 1.0, 0.4), 0.5))]


def _textura_busto(busto):
    img = [n.image for n in busto.pele.data.materials['3DModel'].node_tree.nodes if n.type == 'TEX_IMAGE'][0]
    w, h = img.size
    return np.array(img.pixels[:]).reshape(h, w, 4)[::-1, :, :3]


def ladrilho(busto, tam=256, semente=7):
    """Ladrilho sem costura (sRGB 0..1) por retalhos de 40 px da amostra, com bordas de peso suave e periódicas."""
    x0, y0, x1, y1 = AMOSTRA
    src = _textura_busto(busto)[y0:y1, x0:x1]
    rng = np.random.default_rng(semente)
    acc = np.zeros((tam, tam, 3))
    peso = np.zeros((tam, tam, 1))
    b = 40
    g = np.hanning(b + 2)[1:-1]
    jan = (g[:, None] * g[None, :])[..., None]
    for _ in range(int(tam * tam / (b * b) * 9)):
        sy, sx = rng.integers(0, src.shape[0] - b), rng.integers(0, src.shape[1] - b)
        bl = src[sy:sy + b, sx:sx + b]
        if rng.random() < 0.5:
            bl = bl[:, ::-1]
        ty, tx = rng.integers(0, tam), rng.integers(0, tam)
        ys, xs = (np.arange(b) + ty) % tam, (np.arange(b) + tx) % tam
        acc[np.ix_(ys, xs)] += bl * jan
        peso[np.ix_(ys, xs)] += jan
    return acc / np.maximum(peso, 1e-6), src.reshape(-1, 3).mean(0)


def _amostrar(tile, P, N):
    """Projeção triplanar do ladrilho (posição em unidades do glb × DENS)."""
    t = tile.shape[0]
    out = np.zeros((len(P), 3))
    wsum = np.zeros((len(P), 1))
    for ax in range(3):
        a, b = [k for k in range(3) if k != ax]
        w = np.abs(N[:, ax:ax + 1]) ** 4
        iy = (P[:, a] * DENS).astype(int) % t
        ix = (P[:, b] * DENS).astype(int) % t
        out += tile[iy, ix] * w
        wsum += w
    return out / np.maximum(wsum, 1e-9)


def rasterizar(me, atributos, res=RES, uv='UVMap'):
    """Atributos por vértice (n, k) → imagem (res, res, k) pela UV `uv` (baricêntrica); devolve (imagem, máscara)."""
    k = atributos.shape[1]
    img = np.zeros((res, res, k))
    msk = np.zeros((res, res), bool)
    uvd = me.uv_layers[uv].data
    for p in me.polygons:
        vs, ls = list(p.vertices), list(p.loop_indices)
        for i in range(1, len(vs) - 1):
            tri = (0, i, i + 1)
            U = np.array([uvd[ls[j]].uv[:] for j in tri]) * res
            A = atributos[[vs[j] for j in tri]]
            x0, y0 = np.floor(U.min(0)).astype(int)
            x1, y1 = np.ceil(U.max(0)).astype(int)
            xs, ys = np.meshgrid(np.arange(max(x0, 0), min(x1 + 1, res)), np.arange(max(y0, 0), min(y1 + 1, res)))
            px = np.stack([xs.ravel() + 0.5, ys.ravel() + 0.5], 1)
            T = np.array([[U[1, 0] - U[0, 0], U[2, 0] - U[0, 0]], [U[1, 1] - U[0, 1], U[2, 1] - U[0, 1]]])
            det = np.linalg.det(T)
            if abs(det) < 1e-12:
                continue
            l12 = (px - U[0]) @ np.linalg.inv(T).T
            bc = np.c_[1 - l12.sum(1), l12]
            ok = (bc >= -0.02).all(1)
            if not ok.any():
                continue
            yy, xx = ys.ravel()[ok], xs.ravel()[ok]
            img[yy, xx] = bc[ok] @ A
            msk[yy, xx] = True
    return img, msk


def dilatar(img, msk, passos=8):
    """Sangria das ilhas (margem ≥ 4 px): cada passo copia a média dos vizinhos preenchidos."""
    img, msk = img.copy(), msk.copy()
    for _ in range(passos):
        acc = np.zeros_like(img)
        cnt = np.zeros(msk.shape)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            m = np.roll(np.roll(msk, dy, 0), dx, 1)
            acc += np.roll(np.roll(img, dy, 0), dx, 1) * m[..., None]
            cnt += m
        novo = (~msk) & (cnt > 0)
        img[novo] = acc[novo] / cnt[novo, None]
        msk |= novo
    return img


def _sm(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def cor_pele(d, tile, media, P, N, ao, Npose):
    """Albedo sRGB e rugosidade por ponto (posição/normal de REPOUSO da mão `d`, oclusão 0..1)."""
    mao, U = d['mao'], d['unhas']
    s = '.' + mao.lado
    w, df, lat, n = mao.quadro()
    base = _amostrar(tile, P + (0.37 if mao.lado == 'R' else 0.0), N)
    base = media + (base - media) * 1.15                     # microdetalhe da bochecha, levemente mais marcado
    palma = _sm(0.1, 0.6, N @ n)[:, None]
    cor = base * (1 + palma * np.array((0.10, 0.07, 0.07)))
    rub = np.zeros(len(P))
    rugas = np.zeros(len(P))
    for dd in range(2, 6):
        for k in (1, 2, 3):
            c = mao.cab['finger%d-%d' % (dd, k) + s][0]
            ax = mao.cab['finger%d-%d' % (dd, k) + s][1] - c
            ax /= np.linalg.norm(ax)
            r2 = ((P - c) ** 2).sum(1)
            dors = np.clip(-(N @ n), 0, 1)
            rub += (0.9 if k == 1 else 0.6) * np.exp(-r2 / 0.009 ** 2) * dors
            if k > 1:                                          # rugas transversais no dorso e na palma
                al = (P - c) @ ax
                lat2 = r2 - al ** 2
                env = np.exp(-(al / 0.0022) ** 2) * np.exp(-lat2 / 0.0055 ** 2)
                rugas += env * (0.5 + 0.5 * np.cos(al / 0.0009 * math.pi)) ** 3 * (0.8 * dors + 0.6 * palma[:, 0])
    cor *= 1 - rub[:, None] * np.array((-0.02, 0.07, 0.07))
    cor *= 1 - 0.22 * np.clip(rugas, 0, 1)[:, None]
    rug = 0.56 + 0.05 * rub + 0.06 * (_amostrar(tile, P * 3.1, N).mean(1) - media.mean()) / max(tile.std(), 1e-6)
    for f in U.values():
        dentro, t, borda, pm = RL.campo_unha(P, f)
        cut = np.exp(-((borda + 0.0003) / 0.00035) ** 2) * (borda < 0.0002) * (pm > -0.003) * (t < 0.35)
        unha = cor * 0.55 + np.array((0.66, 0.46, 0.42)) * 0.45     # leito rosado (a placa é malha própria)
        lun = _sm(0.22, 0.08, t)[:, None] * 0.35
        livre = _sm(0.86, 0.97, t)[:, None]
        unha = unha * (1 - lun) + np.array((0.93, 0.80, 0.76)) * lun
        unha = unha * (1 - livre) + np.array((0.90, 0.84, 0.76)) * livre
        cor = cor * (1 - dentro[:, None]) + unha * dentro[:, None]
        cor *= 1 - 0.18 * cut[:, None]
        rug = rug * (1 - dentro) + 0.52 * dentro
    cor *= (0.90 + 0.10 * ao)[:, None]
    # luz assada como a do scan (o rosto é textura com o flash do celular, quase sem sombra própria): compensação
    # parcial da luz do site, para a mão ter a mesma faixa de valor da bochecha no render
    ref = _irradiancia(np.array([[0.0, -1.0, 0.0]]))[0]
    cor *= np.clip((ref / _irradiancia(Npose)) ** GAMA, 0.6, 1.6)[:, None]        # teto: sem borda amarela estourada
    y = cor @ np.array((0.2126, 0.7152, 0.0722))
    cor = y[:, None] + (cor - y[:, None]) * SATURA                  # nunca mais saturada que a bochecha
    return np.clip(cor * K_COR, 0, 1), rug


def texturas(dados, busto, pasta):
    """Albedo 1024², normal 1024² (escultura procedural assada) e ORM 256² das duas mãos → imagens WebP."""
    import prop_uber_pele_normal as PN
    tile, media = ladrilho(busto)
    alb = np.zeros((RES, RES, 3))
    rgh = np.zeros((RES, RES, 1))
    alt = np.zeros((RES, RES))
    pim = np.zeros((RES, RES, 3))
    msk = np.zeros((RES, RES), bool)
    for d in dados:
        me = d['ob'].data
        Np = np.array([v.normal[:] for v in me.vertices])      # normal na pose (luz assada)
        attr = np.c_[d['Vr'], d['Nr'], d['ao'], Np]
        img, m = rasterizar(me, attr)
        P, N = img[m][:, :3], img[m][:, 3:6]
        N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
        Npo = img[m][:, 7:10]
        Npo /= np.maximum(np.linalg.norm(Npo, axis=1, keepdims=True), 1e-9)
        c, r = cor_pele(d, tile, media, P, N, img[m][:, 6], Npo)
        alb[m] = c
        rgh[m, 0] = r
        alt[m] = PN.altura(d, tile, P, N, DENS)
        pim[m] = P
        msk |= m
    nrm = dilatar(PN.mapa(alt, pim, msk), msk)
    alb = dilatar(alb, msk)
    im_alb = B.imagem('uber_pele_cor', alb, pasta, qualidade=76)       # linhas de baixo para cima (v)
    im_nrm = B.imagem('uber_pele_normal', nrm, pasta, qualidade=82)
    rgh = dilatar(np.clip(rgh, 0.50, 0.65), msk)
    orm = np.dstack([np.ones((RES, RES)), rgh[..., 0], np.zeros((RES, RES))])[::4, ::4]
    im_orm = B.imagem('uber_pele_orm', orm, pasta, qualidade=85)
    return im_alb, im_orm, im_nrm                  # rugosidade 0,50–0,65 com variação (ADENDO 4)


def uv_maos(obs):
    """UV das duas mãos juntas (Smart UV Project, ilhas empacotadas numa só folha, margem ≈ 6 px no 1024)."""
    for o in bpy.context.view_layer.objects:
        o.select_set(o in obs)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.006, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def oclusao(ob, bvh, raios=20, alcance=0.03):
    """Oclusão por vértice (1 = aberto) na pose final, contra `bvh` (mãos + aro)."""
    from mathutils import Vector
    rng = np.random.default_rng(3)
    dirs = rng.normal(size=(raios, 3))
    dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
    me = ob.data
    mw = ob.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    ao = np.zeros(len(me.vertices))
    for v in me.vertices:
        p = mw @ v.co
        n = (nm @ v.normal).normalized()
        livre = tot = 0.0
        for d in dirs:
            dv = Vector(d)
            c = dv.dot(n)
            if c <= 0:
                dv, c = -dv, -c
            tot += c
            if bvh.ray_cast(p + n * 2e-4, dv, alcance)[0] is None:
                livre += c
        ao[v.index] = livre / max(tot, 1e-9)
    return ao


def material(pasta, cor, orm, nrm):
    return B.material('uber_pele', 0.0, 0.58, cor_base=cor, orm=orm, normal=nrm, vcor=False)


def _irradiancia(N):
    """Luz difusa aproximada do site (Lighting.tsx, Blender): ambiente+env, chave, preenchimento, contraluz."""
    e = np.full(len(N), AMBIENTE)
    for d, i in LUZES:
        e += i * np.clip(N @ d, 0, 1)
    return e

