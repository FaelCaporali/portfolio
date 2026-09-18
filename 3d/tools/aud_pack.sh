#!/usr/bin/env bash
# Pacote de evidências para auditoria S10/S11/S12: renders pela câmera PnP de cada foto (+ tabela MediaPipe),
# folhas de cabeça (8 vistas) e de baixo (5 vistas) por versão. Saída: analise/aud/
set -u; cd "$(dirname "$0")/.."; O=${AUD_O:-analise/aud}; mkdir -p $O
B="${AUD_B:-blend/busto-s10.blend blend/busto-s11.blend blend/busto-s12.blend}"
for f in ref-15 ref-11 ref-14 ref-12; do
  echo "== LM $f"; LM_EEVEE=1 blender -b --python tools/r_lmcheck.py -- $f $O/lm_$f $B 2>&1 | grep -vE '^(Fra:|Blender|Read|Saved|Time)' | tee $O/lm_$f.txt
done
for v in ${AUD_V:-s10 s11 s12}; do
  echo "== HEAD $v"; blender -b blend/busto-$v.blend --python tools/s11_headviews.py -- $O/${v}_cabeca.jpg >/dev/null 2>&1
  echo "== BELOW $v"; blender -b blend/busto-$v.blend --python tools/s12_below.py -- $O/${v}_debaixo.jpg >/dev/null 2>&1
done
echo AUD_FIM
