import json, math, numpy as np
D=json.load(open('/data/portfolio-3d/analise/landmarks.json'))
def metrics(name):
    d=D[name]; P=np.array(d['pts'])[:,:2]
    # corrigir roll: alinhar linha dos olhos (cantos externos 33 e 263) na horizontal
    eL,eR=P[263],P[33]  # 263 = olho esquerdo do sujeito (direita da imagem), 33 = olho direito do sujeito
    ang=math.atan2(eL[1]-eR[1], eL[0]-eR[0]); c,s=math.cos(-ang),math.sin(-ang)
    R=np.array([[c,-s],[s,c]]); Q=(P-P[168])@R.T   # origem no ponto entre os olhos (168)
    ipd=np.linalg.norm(Q[263]-Q[33])  # distância entre cantos externos = unidade
    u=lambda v: v/ipd
    mid_top=Q[168]; chin=Q[152]
    # eixo do rosto: 168 -> 152; ângulo em relação à vertical
    face_axis=math.degrees(math.atan2(chin[0]-mid_top[0], chin[1]-mid_top[1]))
    # eixo do nariz: 6 (raiz) -> 4 (ponta) ; 1 = ponta, 2 = base/columela
    nose_axis=math.degrees(math.atan2(Q[4][0]-Q[6][0], Q[4][1]-Q[6][1]))
    nose_tip_off=u(Q[4][0]-mid_top[0]); nose_base_off=u(Q[2][0]-mid_top[0])
    # narinas: 98 (dir), 327 (esq) largura; alturas
    alar=u(Q[327][0]-Q[98][0])
    # olhos: altura dos cantos internos 133 (dir) e 362 (esq), e centros
    eye_in_dh=u(Q[362][1]-Q[133][1]); eye_out_dh=u(Q[263][1]-Q[33][1])
    eye_w_R=u(np.linalg.norm(Q[33]-Q[133])); eye_w_L=u(np.linalg.norm(Q[263]-Q[362]))
    eye_open_R=u(abs(Q[159][1]-Q[145][1])); eye_open_L=u(abs(Q[386][1]-Q[374][1]))
    # sobrancelhas: 105 (dir) 334 (esq) altura sobre o olho
    brow_R=u(Q[159][1]-Q[105][1]); brow_L=u(Q[386][1]-Q[334][1])
    # boca: cantos 61 (dir) 291 (esq); centro 0/17
    mouth_dh=u(Q[291][1]-Q[61][1]); mouth_center_off=u((Q[61][0]+Q[291][0])/2-mid_top[0]); mouth_w=u(Q[291][0]-Q[61][0])
    # largura das bochechas em relação ao eixo: 234 (dir) 454 (esq)
    cheek_R=u(mid_top[0]-Q[234][0]); cheek_L=u(Q[454][0]-mid_top[0])
    jaw_R=u(mid_top[0]-Q[172][0]); jaw_L=u(Q[397][0]-mid_top[0])
    # proporções verticais (Loomis): testa 10 -> sobrancelha (9) -> base do nariz (2) -> queixo (152)
    top=Q[10][1]; brow=Q[9][1]; nb=Q[2][1]; ch=Q[152][1]
    thirds=[u(brow-top),u(nb-brow),u(ch-nb)]
    face_h=u(ch-top); face_w=u(Q[454][0]-Q[234][0])
    print(f"== {name}  yaw={d['yaw']} pitch={d['pitch']} roll={d['roll']}  (unidade = distância entre cantos externos dos olhos)")
    print(f"  eixo do rosto {face_axis:+.1f}°   eixo do nariz {nose_axis:+.1f}°  (positivo = ponta desvia para a ESQUERDA do sujeito / direita da imagem)")
    print(f"  ponta do nariz fora do eixo {nose_tip_off:+.3f}   base do nariz {nose_base_off:+.3f}   largura alar {alar:.3f}")
    print(f"  olhos: dif. altura cantos internos {eye_in_dh:+.3f} (positivo = esq. mais baixo)  externos {eye_out_dh:+.3f}")
    print(f"  largura olho D {eye_w_R:.3f} E {eye_w_L:.3f}   abertura D {eye_open_R:.3f} E {eye_open_L:.3f}")
    print(f"  sobrancelha acima do olho D {brow_R:.3f} E {brow_L:.3f}")
    print(f"  boca: largura {mouth_w:.3f}  dif. altura cantos {mouth_dh:+.3f} (positivo = esq. mais baixo)  centro fora do eixo {mouth_center_off:+.3f}")
    print(f"  bochecha D {cheek_R:.3f} E {cheek_L:.3f}   mandíbula D {jaw_R:.3f} E {jaw_L:.3f}")
    print(f"  terços: testa {thirds[0]:.3f} | sobrancelha-nariz {thirds[1]:.3f} | nariz-queixo {thirds[2]:.3f}   altura {face_h:.3f} largura {face_w:.3f} razão {face_h/face_w:.2f}")
for n in ['ref-15.jpg','ref-21.jpg','ref-05.jpg']: metrics(n)
