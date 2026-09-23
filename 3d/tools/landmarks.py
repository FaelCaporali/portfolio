import sys, os, json, math, glob
import numpy as np, cv2
import mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision
V=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); A=f'{V}/analise'
opts=vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path=f'{A}/face_landmarker.task'),
    output_face_blendshapes=True, output_facial_transformation_matrixes=True, num_faces=3, running_mode=vision.RunningMode.IMAGE)
lm=vision.FaceLandmarker.create_from_options(opts)
files=sorted(glob.glob(f'{V}/referencias/upload-02/ref-*.jpg'))+sorted(glob.glob(f'{V}/referencias/ref-0*.jpg'))
out={}
for f in files:
    img=cv2.imread(f); h,w=img.shape[:2]
    if max(h,w)>2000:
        s=2000/max(h,w); img=cv2.resize(img,(int(w*s),int(h*s))); h,w=img.shape[:2]
    mpimg=mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img,cv2.COLOR_BGR2RGB))
    r=lm.detect(mpimg)
    name=os.path.basename(f)
    if not r.face_landmarks: print(name,"NO_FACE"); continue
    # escolher o rosto maior (o Fael)
    best=max(range(len(r.face_landmarks)), key=lambda i: np.ptp([p.x for p in r.face_landmarks[i]]))
    L=r.face_landmarks[best]; M=np.array(r.facial_transformation_matrixes[best])
    pts=np.array([[p.x*w,p.y*h,p.z*w] for p in L])
    bs={b.category_name:round(b.score,3) for b in r.face_blendshapes[best]}
    # yaw/pitch/roll da matriz
    R=M[:3,:3]; yaw=math.degrees(math.atan2(R[0,2],R[2,2])); pitch=math.degrees(math.asin(-R[1,2])); roll=math.degrees(math.atan2(R[1,0],R[1,1]))
    out[name]={'size':[w,h],'yaw':round(yaw,1),'pitch':round(pitch,1),'roll':round(roll,1),'pts':pts.round(2).tolist(),'bs':{k:v for k,v in bs.items() if v>0.15}}
    print(name, f"faces={len(r.face_landmarks)} yaw={yaw:.1f} pitch={pitch:.1f} roll={roll:.1f}", {k:v for k,v in bs.items() if v>0.3})
    # overlay
    ov=img.copy()
    for (x,y,z) in pts: cv2.circle(ov,(int(x),int(y)),1,(0,255,0),-1)
    for i in [1,4,6,168,152,33,133,362,263,61,291,234,454,10,9,2,164,0,17]:
        x,y,_=pts[i]; cv2.circle(ov,(int(x),int(y)),4,(0,0,255),-1); cv2.putText(ov,str(i),(int(x)+4,int(y)-4),cv2.FONT_HERSHEY_SIMPLEX,0.45,(255,255,0),1)
    cv2.imwrite(f'{A}/lm_{name}',ov,[cv2.IMWRITE_JPEG_QUALITY,80])
json.dump(out,open(f'{A}/landmarks.json','w'))
print("SAVED",len(out))
