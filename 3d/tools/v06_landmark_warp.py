# v06: deformação frontal (x,z) guiada por landmarks: alvo = foto ref-15 (roll corrigido, normalizado pela distância
# entre cantos externos, perspectiva compensada pela profundidade 3D do modelo); interpolação Shepard/Gaussiana.
import bpy, sys, json, math, numpy as np
from mathutils import Vector
argv=sys.argv[sys.argv.index("--")+1:]
blend, lm3d_json, photo_json, out_blend, scale = argv[0],argv[1],argv[2],argv[3],float(argv[4])
bpy.ops.wm.open_mainfile(filepath=blend)
o=bpy.data.objects["Busto"]; me=o.data
L3=json.load(open(lm3d_json)); L3={int(k):np.array(v) for k,v in L3.items()}
D=json.load(open(photo_json))['ref-15.jpg']; P2=np.array(D['pts'])[:468,:2]
# foto: roll pela linha dos olhos, origem no sellion 168, normalizar por canthi
eL,eR=P2[263],P2[33]; ang=math.atan2(eL[1]-eR[1],eL[0]-eR[0]); c,s=math.cos(-ang),math.sin(-ang)
Q=(P2-P2[168])@np.array([[c,-s],[s,c]]).T; canthi_photo=np.linalg.norm(Q[263]-Q[33]); Q=Q/canthi_photo
Q[:,1]*=-1  # imagem y para baixo -> z para cima
# modelo: projeção frontal (x,z), origem no sellion, normalizar por canthi do modelo
have=[i for i in range(468) if i in L3]
M=np.array([[L3[i][0],L3[i][2]] if i in L3 else [0,0] for i in range(468)]); depth=np.array([L3[i][1] if i in L3 else L3[4][1] for i in range(468)])
M=M-M[168]; canthi_model=np.linalg.norm(M[263]-M[33]); Mn=M/canthi_model
# perspectiva: celular a ~0.40 m real da ponta do nariz; ponto a Δ (real) atrás do plano do nariz aparece menor por D/(D+Δ)
Dcam=0.40; nose_y=depth[4]
dy_real=(depth-nose_y)/scale
persp=(Dcam+dy_real)/Dcam   # desfaz a redução: multiplica offsets da foto
Qc=Q*persp[:,None]
# recentrar no sellion após correção
Qc=Qc-Qc[168]
# excluir: íris (468+), contorno interno dos olhos e lábios internos (texturas fixas), e pontos de silhueta ruidosos
eye_ids=set([33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398])
inner_lips=set([78,95,88,178,87,14,317,402,318,324,308,191,80,81,82,13,312,311,310,415])
use=[i for i in have if i not in eye_ids and i not in inner_lips]
disp=(Qc[use]-Mn[use])*canthi_model   # em unidades do modelo, (dx,dz)
src=M[use]+np.array(M[168]*0)  # coordenadas frontais relativas ao sellion
sel=L3[168]
print("LANDMARKS usados",len(use),"deslocamento médio |d|=%.4f máx=%.4f"%(np.mean(np.linalg.norm(disp,axis=1)),np.max(np.linalg.norm(disp,axis=1))))
# limitar deslocamentos absurdos (ruído de landmark): 2.5 cm reais
lim=0.025*scale; n=np.linalg.norm(disp,axis=1); disp=disp*np.minimum(1,lim/np.maximum(n,1e-9))[:,None]
# aplicar por interpolação Gaussiana normalizada nos vértices da região facial
nose=Vector(L3[4]); ear_y=max(v.co.y for v in me.vertices if v.co.x>0 and abs(v.co.z-nose.z-0.06)<0.08 and v.co.x>0.12) if False else None
sigma=0.025*scale/1.0
sig2=2*sigma*sigma
y0=nose.y+0.10; y1=nose.y+0.19
def smooth(t): return t*t*(3-2*t)
moved=0
V=np.array([[v.co.x,v.co.y,v.co.z] for v in me.vertices])
xz=V[:,[0,2]]-np.array([sel[0],sel[2]])
for k,v in enumerate(me.vertices):
    if v.co.y>y1 or v.co.z<0.03: continue
    d2=np.sum((src-xz[k])**2,axis=1); w=np.exp(-d2/sig2)
    sw=w.sum()
    if sw<1e-6: continue
    dvec=(w[:,None]*disp).sum(0)/sw
    fade=1.0 if v.co.y<y0 else 1.0-smooth((v.co.y-y0)/(y1-y0))
    # confiança: perto dos landmarks (sw alto) deforma; longe, decai
    conf=min(1.0,sw/3.0)
    v.co.x+=dvec[0]*fade*conf; v.co.z+=dvec[1]*fade*conf; moved+=1
print("WARPED",moved)
me.update(); bpy.ops.wm.save_as_mainfile(filepath=out_blend)
