# Fusão multi-foto dos 468 landmarks 3D (MediaPipe) em um único rosto no referencial da face,
# ponderando cada foto por quanto cada eixo do rosto está no plano da imagem (onde o landmark é preciso).
# Saída: face/fused_landmarks.json (cm), métricas 3D, malha OBJ (topologia canônica do MediaPipe) e atlas de textura.
import json, math, os, glob, numpy as np, cv2
import mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision
V='/home/fael/projects/portfolio/3d'; A=f'{V}/analise'; OUT=f'{V}/face'
NEUTRAL=['ref-15.jpg','ref-14.jpg','ref-11.jpg','ref-12.jpg','ref-05.jpg','ref-04.jpg','ref-02.jpg','ref-01.jpg','ref-24.jpg']
FULLRES={'ref-15.jpg','ref-14.jpg','ref-11.jpg','ref-12.jpg','ref-24.jpg'}
TEXSET={'ref-15.jpg','ref-14.jpg','ref-11.jpg','ref-12.jpg'}
def path(n): 
    p=f'{V}/referencias/upload-02/{n}'; return p if os.path.exists(p) else f'{V}/referencias/{n}'
opts=vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path=f'{A}/face_landmarker.task'),
    output_face_blendshapes=True, output_facial_transformation_matrixes=True, num_faces=3, running_mode=vision.RunningMode.IMAGE)
lm=vision.FaceLandmarker.create_from_options(opts)
photos={}
for n in NEUTRAL:
    img=cv2.imread(path(n)); h,w=img.shape[:2]
    r=lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(img,cv2.COLOR_BGR2RGB)))
    if not r.face_landmarks: print(n,"NO_FACE"); continue
    b=max(range(len(r.face_landmarks)),key=lambda i:np.ptp([p.x for p in r.face_landmarks[i]]))
    L=r.face_landmarks[b][:468]; M=np.array(r.facial_transformation_matrixes[b]); R=M[:3,:3]
    P=np.array([[p.x*w,p.y*h,p.z*w] for p in L])
    # frame "câmera" y para cima, z para a câmera: (x, -y, -z)
    C=np.stack([P[:,0],-P[:,1],-P[:,2]],1)
    C=C-C.mean(0)
    F=(R.T@C.T).T           # para o referencial da face (canônico do MediaPipe)
    canthi=np.linalg.norm(F[263]-F[33]); F=F/canthi
    # peso por eixo: quanto o eixo k do rosto está no plano da imagem
    axw=np.array([math.sqrt(R[0,k]**2+R[1,k]**2) for k in range(3)])
    yaw=math.degrees(math.atan2(R[0,2],R[2,2]))
    photos[n]={'F':F,'axw':axw,'R':R,'P2':P[:,:2],'img':img,'yaw':yaw,'w':w,'h':h}
    print("%-11s yaw=%6.1f pesos-eixo x=%.2f y=%.2f z=%.2f"%(n,yaw,*axw))
names=list(photos); 
Fs=np.stack([photos[n]['F'] for n in names]); Ws=np.stack([photos[n]['axw'] for n in names])
# alinhamento fino entre fotos (Procrustes rígido para a frontal ref-15) antes de fundir
ref=photos['ref-15.jpg']['F']
def procrustes(X,Y):
    mx,my=X.mean(0),Y.mean(0); U,S,Vt=np.linalg.svd((X-mx).T@(Y-my)); Rm=(U@Vt).T
    if np.linalg.det(Rm)<0: Vt[-1]*=-1; Rm=(U@Vt).T
    return Rm,mx,my
for i,n in enumerate(names):
    Rm,mx,my=procrustes(Fs[i],ref); Fs[i]=(Rm@(Fs[i]-mx).T).T+my
    Ws[i]=np.abs(Rm@Ws[i])
fused=np.zeros((468,3))
for k in range(3):
    wk=Ws[:,k][:,None]; fused[:,k]=(Fs[:,:,k]*wk).sum(0)/wk.sum(0)
# resíduo por foto (qualidade)
for i,n in enumerate(names):
    print("resíduo %-11s %.4f"%(n,np.mean(np.linalg.norm(Fs[i]-fused,axis=1))))
# escala: canthi externo = 9.0 cm
S=9.0; fused_cm=fused*S
json.dump({'pts_cm':fused_cm.tolist(),'photos':names},open(f'{OUT}/fused_landmarks.json','w'))
# --- métricas 3D (sem perspectiva)
X=fused_cm; mid=(X[33]+X[263])/2
def w_(i): return X[i][0]-X[168][0]
print("== MÉTRICAS 3D FUNDIDAS (cm) ==")
print("largura zigoma D %.2f  E %.2f | mandíbula D %.2f E %.2f"%(X[168][0]-X[234][0], X[454][0]-X[168][0], X[168][0]-X[172][0], X[397][0]-X[168][0]))
print("ponta do nariz fora do eixo %.2f cm; eixo nariz %.1f°"%(X[4][0]-X[168][0], math.degrees(math.atan2(X[4][0]-X[6][0], X[6][1]-X[4][1]))))
print("abertura olho D %.2f E %.2f cm | largura olho D %.2f E %.2f"%(abs(X[159][1]-X[145][1]),abs(X[386][1]-X[374][1]),np.linalg.norm(X[33]-X[133]),np.linalg.norm(X[263]-X[362])))
print("projeção do nariz (ponta - canto interno do olho, z) %.2f cm; altura rosto (testa10->queixo152) %.2f; largura 234->454 %.2f"%(X[4][2]-((X[133][2]+X[362][2])/2), X[10][1]-X[152][1], X[454][0]-X[234][0]))
print("profundidade: queixo z %.2f, zigoma z D %.2f E %.2f, testa z %.2f (rel. ponta do nariz)"%(X[152][2]-X[4][2],X[234][2]-X[4][2],X[454][2]-X[4][2],X[10][2]-X[4][2]))
# --- malha: topologia canônica
faces=[]; uvs=[]; fuv=[]
for line in open(f'{A}/canonical_face_model.obj'):
    if line.startswith('vt '): uvs.append([float(x) for x in line.split()[1:3]])
    if line.startswith('f '): faces.append([int(t.split('/')[0])-1 for t in line.split()[1:4]]); fuv.append([int(t.split('/')[1])-1 for t in line.split()[1:4]])
faces=np.array(faces); uvs=np.array(uvs); fuv=np.array(fuv)
# --- atlas de textura 2048: por triângulo, foto cujo eixo de visão mais encara a normal
SZ=2048; atlas=np.zeros((SZ,SZ,3),np.uint8); cover=np.zeros((SZ,SZ),np.uint8)
normals=np.zeros((len(faces),3))
for fi,(a,b,c) in enumerate(faces):
    nrm=np.cross(X[b]-X[a],X[c]-X[a]); normals[fi]=nrm/(np.linalg.norm(nrm)+1e-9)
views={}
for n in names:
    Rm,_,_=procrustes(photos[n]['F']*S, X)  # rotação foto->fundido
    views[n]=Rm@(photos[n]['R'].T@np.array([0,0,1.0]))
# correção de cor por foto: média da pele (bochechas) relativa à frontal
skin_ids=[50,280,101,330,118,347,205,425]
def skin_mean(n):
    img=photos[n]['img']; P2=photos[n]['P2']; vals=[]
    for i in skin_ids:
        x,y=int(P2[i][0]),int(P2[i][1]); vals.append(img[max(0,y-6):y+6,max(0,x-6):x+6].reshape(-1,3).mean(0))
    return np.mean(vals,0)
gain={n:(skin_mean('ref-15.jpg')/np.maximum(skin_mean(n),1)) for n in names}
choice={}
for fi,(a,b,c) in enumerate(faces):
    best=None
    for n in names:
        if n not in TEXSET: continue
        d=float(normals[fi]@views[n]); s=d+(0.45 if n=='ref-15.jpg' else 0.0)
        if best is None or s>best[0]: best=(s,n)
    n=best[1]; choice[n]=choice.get(n,0)+1
    img=photos[n]['img']; P2=photos[n]['P2']
    ua,ub,uc=fuv[fi]
    src=np.float32([P2[a],P2[b],P2[c]]); dst=np.float32([[uvs[ua][0]*SZ,(1-uvs[ua][1])*SZ],[uvs[ub][0]*SZ,(1-uvs[ub][1])*SZ],[uvs[uc][0]*SZ,(1-uvs[uc][1])*SZ]])
    x0,y0=np.floor(dst.min(0)).astype(int); x1,y1=np.ceil(dst.max(0)).astype(int)
    if x1<=x0 or y1<=y0: continue
    Mw=cv2.getAffineTransform(src,np.float32(dst-[x0,y0]))
    patch=cv2.warpAffine(img,Mw,(x1-x0,y1-y0),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
    patch=np.clip(patch.astype(np.float32)*gain[n],0,255).astype(np.uint8)
    mask=np.zeros((y1-y0,x1-x0),np.uint8); cv2.fillConvexPoly(mask,np.int32(np.round(dst-[x0,y0])),255)
    mask=cv2.dilate(mask,np.ones((3,3),np.uint8))
    roi=atlas[y0:y1,x0:x1]; roi[mask>0]=patch[mask>0]; cover[y0:y1,x0:x1][mask>0]=255
print("ATLAS por foto:",choice)
# preencher buracos do atlas por inpainting leve
atlas=cv2.inpaint(atlas,(255-cover),3,cv2.INPAINT_TELEA)
cv2.imwrite(f'{OUT}/face_atlas.jpg',atlas,[cv2.IMWRITE_JPEG_QUALITY,92])
# OBJ em metros: 1 cm = 0.01; converter para Blender (Y up no MediaPipe -> Z up): x, z=-y?  manter: x, y(up), z(para a câmera) -> Blender: x, -z(frente = -Y), y
with open(f'{OUT}/face_v01.obj','w') as f:
    f.write("mtllib face_v01.mtl\nusemtl face\n")
    for p in X: f.write("v %.5f %.5f %.5f\n"%(p[0]*0.01, p[1]*0.01, p[2]*0.01))
    for u in uvs: f.write("vt %.5f %.5f\n"%(u[0],u[1]))
    for (a,b,c),(ua,ub,uc) in zip(faces,fuv): f.write("f %d/%d %d/%d %d/%d\n"%(a+1,ua+1,b+1,ub+1,c+1,uc+1))
open(f'{OUT}/face_v01.mtl','w').write("newmtl face\nKd 1 1 1\nmap_Kd face_atlas.jpg\n")
print("OBJ ok", len(X), "verts", len(faces), "faces")
