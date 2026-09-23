# 3d — busto do Fael para o herói do portfólio

Busto 3D do herói, reconstruído do scan por receitas reprodutíveis, e um personagem cartoon riggado para comparação.

## O que está no git (lista de permissão no `.gitignore` da raiz)
| Pasta | Conteúdo versionado |
|---|---|
| `blend/` | `busto-s07.blend` (escultura sobre o scan, FONTE de toda receita), `busto-s13.blend` (busto base APROVADO em 18/09/2026), `toon-npc-01.blend` (cartoon riggado), `mpfb-02.json` (parâmetros faciais medidos) |
| `export/s13/` | `busto-s13.glb` (web, 44 k vértices, 10 morphs ARKit) e `pele_s13.jpg` |
| `export/npc01/` | `npc01.glb` (armature MPFB + 24 morphs) e textura do olho |
| `tools/` | receitas e ferramentas da cadeia S07 → S13 e do NPC01 (Python para Blender headless; medição com MediaPipe/OpenCV em `$FACE_PYTHON`) |
| `analise/` | documentos, medições (`gate/*.json`, `pnp/*.json`), auditoria do S13 (`aud13/`) e folhas curadas (`clay/s13_*`, `clay/npc01_*`) |
| `referencias/upload-02/` | fotos de referência usadas nas medições e na análise do rosto |
| `renders/` | `s13_demo.mp4` |

Fora do git: capturas, scans brutos, iterações S01–S12, renders de processo e caches.

## Reproduzir
`FACE_PYTHON` aponta para um Python com `mediapipe` e `opencv-python` (padrão: `python3`).
```bash
blender -b --python tools/s13_build.py                 # S07 -> S13 (busto base), ~10 min
bash tools/bateria.sh s13                              # portão de expressões, poses, glb web, vídeo
blender -b --python tools/npc01_build.py -- blend/toon-npc-01.blend glb=export/npc01/npc01.glb sheets=/tmp/npc
AUD_O=analise/audNN AUD_B="blend/busto-sNN.blend" AUD_V="sNN" tools/aud_pack.sh && AUD_O=analise/audNN $FACE_PYTHON tools/aud_sheets.py
```
Regras: arquivo entregue abre no NEUTRO; nenhuma expressão sem passar em `tools/r_exprgate.py`; nenhuma entrega sem as folhas pela câmera das fotos (`aud_pack`/`aud_sheets`); a página Three.js aplica `mouthSmileFix = min(mouthSmileLeft, mouthSmileRight)`.
