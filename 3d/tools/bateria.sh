#!/usr/bin/env bash
# bash tools/bateria.sh <sNN>   -> portão, folha de poses, glb web (+poses web), vídeo. Log: stdout.
set -u; cd "$(dirname "$0")/.."; v=$1; mkdir -p export/$v
blender -b --python tools/r_exprgate.py -- blend/busto-$v.blend analise/clay/${v} 2>&1 | grep -E "^GATE|FOLHA"
blender -b --python tools/s08_poses.py -- blend/busto-$v.blend analise/clay/${v}_poses.jpg 2>&1 | grep -E "^POSES"
blender -b --python tools/s08_web.py -- blend/busto-$v.blend export/$v/busto-$v-web.blend export/$v/busto-$v.glb 0.15 2>&1 | grep -E "^WEB"
# glb do site: pele em WebP q95 (codificada uma vez do JPEG, a única fonte: o .blend empacota o mesmo arquivo; q95 é o menor
# q sem pixel acima de 8/255 contra a pele JPEG no site, nas 3 telas, neutro e 10 expressões), meshopt +
# quantização (volume único), cada malha num filho `<nó>_malha` para os olhos girarem no próprio centro. Régua e provas:
# captura/busto/compressao/. O s08_web.py sozinho não reproduz o glb entregue (decimação e sombras mudaram no .blend).
python3 -c "from PIL import Image; Image.open('export/$v/pele_$v.jpg').convert('RGB').save('export/$v/pele_$v.webp', quality=95, method=6)"
node tools/props/otimizar.mjs export/$v/busto-$v.glb --malha-em-filho --webp=pele_$v=export/$v/pele_$v.webp | grep -v "^preservados"
blender -b --python tools/s08_poses.py -- export/$v/busto-$v-web.blend analise/clay/${v}_web_poses.jpg 2>&1 | grep -E "^POSES"
blender -b --python tools/s08_video.py -- blend/busto-$v.blend renders/${v}_demo.mp4 2>&1 | grep -E "^VIDEO"
echo BATERIA_FIM
