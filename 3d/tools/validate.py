# Validação objetiva: landmarks no render frontal de cada versão vs foto ref-15. Mesmas métricas de asym_metrics.
import sys, json, math, glob, os, numpy as np, cv2, mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision
A='/data/portfolio-3d/analise'
opts=vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path=f'{A}/face_landmarker.task'),
    output_face_blendshapes=False, output_facial_transformation_matrixes=True, num_faces=1, running_mode=vision.RunningMode.IMAGE)
lm=vision.FaceLandmarker.create_from_options(opts)
def detect(path):
    img=cv2.imread(path); h,w=img.shape[:2]
    if max(h,w)>2000: s=2000/max(h,w); img=cv2.resize(img,(int(w*s),int(h*s))); h,w=img.shape[:2]
    r=lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img,cv2.COLOR_BGR2RGB)))
    if not r.face_landmarks: return None
    L=r.face_landmarks[0]; M=np.array(r.facial_transformation_matrixes[0]); R=M[:3,:3]
    yaw=math.degrees(math.atan2(R[0,2],R[2,2]))
    return np.array([[p.x*w,p.y*h] for p in L]), yaw
def metrics(P):
    eL,eR=P[263],P[33]; ang=math.atan2(eL[1]-eR[1],eL[0]-eR[0]); c,s=math.cos(-ang),math.sin(-ang)
    Q=(P-P[168])@np.array([[c,-s],[s,c]]).T; ipd=np.linalg.norm(Q[263]-Q[33]); u=lambda v:v/ipd
    m={}
    m['nariz_eixo_deg']=math.degrees(math.atan2(Q[4][0]-Q[6][0],Q[4][1]-Q[6][1]))
    m['nariz_ponta_x']=u(Q[4][0]); m['alar']=u(Q[327][0]-Q[98][0])
    m['olho_D_w']=u(np.linalg.norm(Q[33]-Q[133])); m['olho_E_w']=u(np.linalg.norm(Q[263]-Q[362]))
    m['olho_D_h']=u(abs(Q[159][1]-Q[145][1])); m['olho_E_h']=u(abs(Q[386][1]-Q[374][1]))
    m['sobr_D']=u(Q[159][1]-Q[105][1]); m['sobr_E']=u(Q[386][1]-Q[334][1])
    m['boca_w']=u(Q[291][0]-Q[61][0]); m['boca_dh']=u(Q[291][1]-Q[61][1])
    m['boch_D']=u(-Q[234][0]); m['boch_E']=u(Q[454][0]); m['mand_D']=u(-Q[172][0]); m['mand_E']=u(Q[397][0])
    m['terco_testa']=u(Q[9][1]-Q[10][1]); m['terco_meio']=u(Q[2][1]-Q[9][1]); m['terco_baixo']=u(Q[152][1]-Q[2][1])
    m['alt_larg']=u(Q[152][1]-Q[10][1])/u(Q[454][0]-Q[234][0])
    m['nariz_len']=u(Q[2][1]-Q[6][1]); m['olho_nariz']=u(Q[2][1]-Q[168][1]); m['nariz_boca']=u(Q[0][1]-Q[2][1])
    return m
ref=detect('/data/portfolio-3d/referencias/upload-02/ref-15.jpg'); mref=metrics(ref[0])
targets=sys.argv[1:]
rows=[]
for t in targets:
    r=detect(t)
    if r is None: print(f"{t}: SEM ROSTO DETECTADO"); continue
    m=metrics(r[0]); rows.append((t,r[1],m))
keys=list(mref.keys())
print("%-22s %7s | "%("métrica","foto")+" | ".join("%-14s"%os.path.basename(os.path.dirname(t))[:14] for t,_,_ in rows))
for k in keys:
    print("%-22s %7.3f | "%(k,mref[k])+" | ".join("%6.3f (%+5.3f)"%(m[k],m[k]-mref[k]) for _,_,m in rows))
print("yaw render: "+", ".join("%s=%.1f"%(os.path.basename(os.path.dirname(t)),y) for t,y,_ in rows))
# score: erro médio absoluto (excluindo nariz_eixo em graus, tratado à parte)
for t,y,m in rows:
    errs=[abs(m[k]-mref[k]) for k in keys if k!='nariz_eixo_deg']
    print("SCORE %-14s erro médio=%.4f  máx=%.4f  nariz_eixo Δ=%+.1f°"%(os.path.basename(os.path.dirname(t)),np.mean(errs),np.max(errs),m['nariz_eixo_deg']-mref['nariz_eixo_deg']))
