#!/usr/bin/env bash
# uso: tools/r_texchain.sh <nome>   (export/r01/<nome>.blend -> <nome>_t.blend com textura do scan remendada e olhos assados)
set -e
n=$1; d=export/r01
blender -b --python tools/r_bake.py -- $d/$n.blend blend/busto-s07.blend $d/${n}_bk 2>&1 | grep -E "R_BAKE|Error|Traceback" || true
blender -b --python tools/r_masks.py -- $d/${n}_bk.blend $d/s07_cls.blend $d/$n 2>&1 | grep -E "Error|Traceback" || true
/data/venv-face/bin/python tools/r_patch_tex.py $d/$n $d/${n}_bk $d/${n}_patch.jpg
blender -b --python tools/r_settex.py -- $d/${n}_bk.blend $d/${n}_patch.jpg $d/${n}_t.blend 2>&1 | grep -E "SETTEX|Error|Traceback" || true
