"""Operações de escultura pontual no objeto 'Busto' do Blender interativo ou em batch. Uso interativo:
    exec(open('tools/sculpt_ops.py').read(), G); G['op_mirror'](...)
Toda operação atua numa esfera (centro em mm no frame do busto-base, raio em mm) com decaimento suave
w = (1-(d/r)^2)^2, como um pincel. Frame: x+ = lado ESQUERDO do Fael, -y = frente, z = altura. Plano de simetria x=0.
Cada chamada é registrada em analise/sculpt_log.json para reprodução."""
import bpy, json, os, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
LOG = 'analise/sculpt_log.json'
def _ob(): return bpy.data.objects['Busto']
def _V():
    me = _ob().data; V = np.empty(len(me.vertices)*3); me.vertices.foreach_get('co', V); return V.reshape(-1, 3)
def _set(V):
    me = _ob().data; me.vertices.foreach_set('co', V.ravel()); me.update()
def _w(V, c, r):
    d = np.linalg.norm(V - np.array(c)/1000, axis=1)/(r/1000); return np.where(d < 1, (1 - np.clip(d, 0, 1)**2)**2, 0.0)
def _edges():
    me = _ob().data; E = np.empty(len(me.edges)*2, np.int64); me.edges.foreach_get('vertices', E); return E.reshape(-1, 2)
def _log(name, **kw):
    L = json.load(open(LOG)) if os.path.exists(LOG) else []
    L.append(dict(op=name, file=bpy.data.filepath, **kw)); json.dump(L, open(LOG, 'w'), indent=1)
def _lap(V, E, n):
    s = np.zeros_like(V); np.add.at(s, E[:, 0], V[E[:, 1]]); np.add.at(s, E[:, 1], V[E[:, 0]])
    deg = np.bincount(E.ravel(), minlength=n)[:, None]; return s/np.maximum(deg, 1)
def op_smooth(c, r, strength=0.5, it=10, taubin=True):
    """Suaviza (Taubin: não encolhe) dentro da esfera."""
    V = _V(); w = _w(V, c, r)[:, None]*strength; E = _edges(); n = len(V)
    for _ in range(it):
        V = V + w*(_lap(V, E, n) - V)
        if taubin: V = V - 1.03*w*(_lap(V, E, n) - V)
    _set(V); _log('smooth', c=c, r=r, strength=strength, it=it, taubin=taubin); return int((w > 0).sum())
def op_mirror(c, r, strength=1.0):
    """Copia a forma do lado oposto (espelho em x=0) para a esfera centrada em c."""
    ob = _ob(); V = _V(); w = _w(V, c, r); idx = np.nonzero(w > 0)[0]
    bvh = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get()); V0 = V.copy()
    for i in idx:
        p = Vector((-V0[i, 0], V0[i, 1], V0[i, 2])); q = bvh.find_nearest(p)[0]
        if q is None: continue
        V[i] = V0[i] + w[i]*strength*(np.array((-q.x, q.y, q.z)) - V0[i])
    _set(V); _log('mirror', c=c, r=r, strength=strength); return len(idx)
def op_restore(c, r, ref_blend, strength=1.0):
    """Volta a esfera para a forma de outro blend com a mesma topologia (ex.: desfazer retração)."""
    with bpy.data.libraries.load(ref_blend) as (src, dst): dst.meshes = ['3DModel'] if '3DModel' in src.meshes else [src.meshes[0]]
    mr = dst.meshes[0]; R = np.empty(len(mr.vertices)*3); mr.vertices.foreach_get('co', R); R = R.reshape(-1, 3); bpy.data.meshes.remove(mr)
    V = _V(); assert len(R) == len(V); w = _w(R, c, r)[:, None]*strength
    _set(V + w*(R - V)); _log('restore', c=c, r=r, ref=ref_blend, strength=strength); return int((w > 0).sum())
def op_inflate(c, r, mm):
    """Empurra ao longo da normal (mm > 0 para fora)."""
    me = _ob().data; V = _V(); N = np.empty(len(V)*3); me.vertices.foreach_get('normal', N); N = N.reshape(-1, 3)
    _set(V + _w(V, c, r)[:, None]*N*mm/1000); _log('inflate', c=c, r=r, mm=mm)
def op_diff(c, r, ref_blend):
    """Deslocamento (mm) desta malha em relação ao ref dentro da esfera: mediana, máx, média com sinal na normal."""
    with bpy.data.libraries.load(ref_blend) as (src, dst): dst.meshes = [src.meshes[0]]
    mr = dst.meshes[0]; R = np.empty(len(mr.vertices)*3); mr.vertices.foreach_get('co', R); R = R.reshape(-1, 3); bpy.data.meshes.remove(mr)
    me = _ob().data; V = _V(); N = np.empty(len(V)*3); me.vertices.foreach_get('normal', N); N = N.reshape(-1, 3)
    m = _w(R, c, r) > 0; D = (V - R)[m]; s = (D*N[m]).sum(1)*1000
    return dict(n=int(m.sum()), med=float(np.median(np.linalg.norm(D, axis=1))*1000), max=float(np.linalg.norm(D, axis=1).max()*1000), normal_mean=float(s.mean()), normal_min=float(s.min()))
def op_fill(c, r, strength=1.0, dry=False, ring=(0.65, 1.0)):
    """Pincel Fill: ajusta uma superfície quadrática ao anel da esfera (no referencial da normal média) e sobe os
    pontos internos que estão ABAIXO dela (concavidade) até ela. dry=True só mede (profundidade máx./média, mm)."""
    me = _ob().data; V = _V(); N = np.empty(len(V)*3); me.vertices.foreach_get('normal', N); N = N.reshape(-1, 3)
    C = np.array(c)/1000; d = np.linalg.norm(V - C, axis=1)/(r/1000); m = d < 1
    n = N[m].mean(0); n /= np.linalg.norm(n); t1 = np.cross(n, [0, 0, 1.0]); t1 = t1 if np.linalg.norm(t1) > 0.1 else np.cross(n, [1.0, 0, 0]); t1 /= np.linalg.norm(t1); t2 = np.cross(n, t1)
    P = V - C; u, v, h = P @ t1, P @ t2, P @ n
    A = lambda u, v: np.stack([np.ones_like(u), u, v, u*u, u*v, v*v], 1)
    rg = m & (d > ring[0]); coef = np.linalg.lstsq(A(u[rg], v[rg]), h[rg], rcond=None)[0]
    gap = A(u, v) @ coef - h; gap[~m] = 0; inner = m & (d < ring[0]) & (gap > 0)
    rep = dict(n=int(m.sum()), ring=int(rg.sum()), depth_max=float(gap[inner].max()*1000) if inner.any() else 0.0, depth_mean=float(gap[inner].mean()*1000) if inner.any() else 0.0)
    if not dry:
        w = _w(V, c, r)*strength; up = np.where(m & (gap > 0), gap, 0)*w
        _set(V + up[:, None]*n); _log('fill', c=c, r=r, strength=strength)
    return rep
