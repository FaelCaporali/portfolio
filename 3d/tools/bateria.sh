#!/usr/bin/env bash
# bash tools/bateria.sh <sNN>   -> portão, folha de poses, glb web (+poses web), vídeo. Log: stdout.
set -u; cd "$(dirname "$0")/.."; v=$1; mkdir -p export/$v
blender -b --python tools/r_exprgate.py -- blend/busto-$v.blend analise/clay/${v} 2>&1 | grep -E "^GATE|FOLHA"
blender -b --python tools/s08_poses.py -- blend/busto-$v.blend analise/clay/${v}_poses.jpg 2>&1 | grep -E "^POSES"
blender -b --python tools/s08_web.py -- blend/busto-$v.blend export/$v/busto-$v-web.blend export/$v/busto-$v.glb 0.15 2>&1 | grep -E "^WEB"
blender -b --python tools/s08_poses.py -- export/$v/busto-$v-web.blend analise/clay/${v}_web_poses.jpg 2>&1 | grep -E "^POSES"
blender -b --python tools/s08_video.py -- blend/busto-$v.blend renders/${v}_demo.mp4 2>&1 | grep -E "^VIDEO"
echo BATERIA_FIM
