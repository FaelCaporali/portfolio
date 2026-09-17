"""blender -b --python tools/align_face.py -- <in.blend> <lm3d.json> <fused.json> <out.blend>
Gira/centra a malha 'Busto' para que o rosto fique exatamente de frente (−Y), vertical (Z), pela medida fundida
(Procrustes sem escala entre landmarks raycast e fusão). Grava também o lm3d transformado."""
import bpy, json, sys, numpy as np, os
from mathutils import Matrix
a = sys.argv[sys.argv.index("--")+1:]; src, lmf, fuf, out = a
lm = json.load(open(lmf)); F = np.array(json.load(open(fuf))['pts_cm'])
eye = {33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398}
oval = {10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109}
ids = [i for i in range(468) if str(i) in lm and i not in eye and i not in oval]
A = np.array([lm[str(i)] for i in ids]); B = F[ids]
# canônico MediaPipe (x dir. da imagem, y cima, z p/ câmera) -> malha (x, -z, y): rosto para -Y, Z cima
Bm = np.stack([B[:,0], -B[:,2], B[:,1]], 1)
for it in range(3):
    ca, cb = A.mean(0), Bm.mean(0); U,S,Vt = np.linalg.svd((A-ca).T @ (Bm-cb)); D=np.eye(3); D[2,2]=np.sign(np.linalg.det(U@Vt))
    R = U@D@Vt          # A_local ≈ R @ Bm_local  -> queremos girar A por R^T
    Ar = (A-ca) @ R
    r = np.linalg.norm(Ar - (Bm-cb)*np.linalg.norm(Ar,axis=1).mean()/np.linalg.norm(Bm-cb,axis=1).mean(), axis=1)
    keep = r < np.median(r)*2.5; A, Bm = A[keep], Bm[keep]
ang = np.degrees(np.arccos(np.clip((np.trace(R)-1)/2, -1, 1)))
print("ALIGN rotação aplicada %.1f graus, pontos %d" % (ang, len(A)))
bpy.ops.wm.open_mainfile(filepath=src); o = bpy.data.objects['Busto']
M = Matrix(np.vstack([np.hstack([R.T, -(R.T@ca)[:,None]]), [0,0,0,1]]).tolist())
o.matrix_world = M @ o.matrix_world
bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.transform_apply(rotation=True, location=True, scale=True)
V = np.array([v.co[:] for v in o.data.vertices]); zmin = V[:,2].min(); o.location = (0,0,0)
# centrar: rosto em x=0 pelo centro dos landmarks, base em z=0
lm2 = {k: (np.array(v)-ca) @ R for k, v in lm.items()}
cx = np.mean([p[0] for p in lm2.values()])
for v in o.data.vertices: v.co.x -= cx; v.co.z -= zmin
for k in lm2: lm2[k] = (lm2[k] - [cx, 0, zmin]).tolist()
json.dump(lm2, open(os.path.join(os.path.dirname(lmf), 'lm3d_aligned.json'), 'w'))
bpy.ops.wm.save_as_mainfile(filepath=out); print("ALIGN salvo")
