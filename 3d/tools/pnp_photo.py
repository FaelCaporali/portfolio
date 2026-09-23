# Pose da câmera da foto em relação ao modelo (PnP) usando landmarks 3D (raycast) e 2D (foto). Varre a focal.
import json, os, sys, numpy as np, cv2
V=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lm3=json.load(open(sys.argv[1] if len(sys.argv)>1 else f'{V}/analise/lm3d_v07.json')); L=json.load(open(f'{V}/analise/landmarks.json'))['ref-15.jpg']
W,H=L['size']; P2=np.array(L['pts'])[:468,:2]
# escala da foto no landmarks.json (foi redimensionada para máx 2000 px); a foto original é 2368x4208
img_w,img_h=2368,4208; sx=img_w/W; sy=img_h/H; P2=P2*[sx,sy]
eye_ids=set([33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398])
ids=[i for i in range(468) if str(i) in lm3 and i not in eye_ids]
obj=np.array([lm3[str(i)] for i in ids],dtype=np.float64); img=np.array([P2[i] for i in ids],dtype=np.float64)
best=None
for f in np.linspace(1200,4200,61):
    K=np.array([[f,0,img_w/2],[0,f,img_h/2],[0,0,1]])
    ok,rvec,tvec,inl=cv2.solvePnPRansac(obj,img,K,None,reprojectionError=25,flags=cv2.SOLVEPNP_ITERATIVE)
    if not ok: continue
    ok,rvec,tvec=cv2.solvePnP(obj[inl[:,0]],img[inl[:,0]],K,None,rvec,tvec,useExtrinsicGuess=True,flags=cv2.SOLVEPNP_ITERATIVE)
    proj,_=cv2.projectPoints(obj,rvec,tvec,K,None); err=np.sqrt(((proj[:,0,:]-img)**2).sum(1))
    med=np.median(err)
    if best is None or med<best[0]: best=(med,f,rvec.ravel().tolist(),tvec.ravel().tolist(),len(inl),float(np.mean(err)))
med,f,rvec,tvec,ninl,mean=best
print("PNP focal_px=%.0f  erro mediano=%.1f px  médio=%.1f px  inliers=%d/%d"%(f,med,mean,ninl,len(ids)))
json.dump({'f':f,'rvec':rvec,'tvec':tvec,'w':img_w,'h':img_h},open(sys.argv[2] if len(sys.argv)>2 else f'{V}/analise/pnp_ref15.json','w'))
