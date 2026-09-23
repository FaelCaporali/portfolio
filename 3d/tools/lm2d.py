import os, sys, json, numpy as np, cv2, mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision
A=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'analise')
opts=vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path=f'{A}/face_landmarker.task'),num_faces=1,running_mode=vision.RunningMode.IMAGE)
lm=vision.FaceLandmarker.create_from_options(opts)
img=cv2.imread(sys.argv[1]); h,w=img.shape[:2]
r=lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(img,cv2.COLOR_BGR2RGB)))
pts=[[p.x*w,p.y*h] for p in r.face_landmarks[0]]
json.dump({'size':[w,h],'pts':pts},open(sys.argv[2],'w')); print("LM2D",len(pts))
