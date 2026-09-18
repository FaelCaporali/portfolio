#!/bin/bash
# bash tools/npc01_sheets.sh <blend> <tmpdir>  -> folhas em analise/clay/npc01_*.jpg
set -e; B=$1; T=$2; R="blender -b $B --python tools/npc01_render.py --"
$R $T/t front,q34,profile,back,body,face res=900 >/dev/null 2>&1
python3 tools/npc01_sheet.py analise/clay/npc01_turntable.jpg 3 "frente|$T/t_front.png" "3/4|$T/t_q34.png" "perfil|$T/t_profile.png" "costas|$T/t_back.png" "corpo|$T/t_body.png" "rosto|$T/t_face.png"
for k in mouthSmileLeft mouthSmileRight browInnerUp browDownLeft browDownRight eyeBlinkLeft eyeBlinkRight jawOpen; do $R $T/x_$k face,face34 $k=1 res=600 >/dev/null 2>&1; done
$R $T/x_sorriso face,face34 mouthSmileLeft=1 mouthSmileRight=1 jawOpen=0.35 browInnerUp=0.5 res=600 >/dev/null 2>&1
A=(); for k in mouthSmileLeft mouthSmileRight browInnerUp browDownLeft browDownRight eyeBlinkLeft eyeBlinkRight jawOpen sorriso; do A+=("$k|$T/x_${k}_face.png" "$k 3/4|$T/x_${k}_face34.png"); done
python3 tools/npc01_sheet.py analise/clay/npc01_expressoes.jpg 6 "${A[@]}"
$R $T/pA body,body34 pose=A res=800 >/dev/null 2>&1; $R $T/pB body,body34 pose=B res=800 >/dev/null 2>&1
python3 tools/npc01_sheet.py analise/clay/npc01_rig.jpg 4 "pose A (acena)|$T/pA_body.png" "pose A 3/4|$T/pA_body34.png" "pose B (passo)|$T/pB_body.png" "pose B 3/4|$T/pB_body34.png"
$R $T/v front,profileR,q34R res=800 bg=white >/dev/null 2>&1
python3 tools/npc01_vsfotos.py $T
