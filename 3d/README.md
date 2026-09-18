# 3d — busto do Fael para o herói do portfólio

Estado, decisões e pendências: `ESTADO.md` (ler primeiro), lições: `LICOES.md`, pedidos dele: `PEDIDOS-FAEL.md`.

## O que está no git (lista de permissão no `.gitignore` da raiz)
| Pasta | Conteúdo versionado |
|---|---|
| `blend/` | `busto-s07.blend` (escultura sobre o scan, FONTE de toda receita), `busto-s13.blend` (busto base APROVADO em 18/09/2026), `toon-npc-01.blend` (cartoon riggado), `mpfb-02.json` (parâmetros faciais medidos) |
| `export/s13/` | `busto-s13.glb` (web, 44 k vértices, 10 morphs ARKit) e `pele_s13.jpg` |
| `export/npc01/` | `npc01.glb` (armature MPFB + 24 morphs) e textura do olho |
| `tools/` | todas as receitas e ferramentas (Python para Blender headless e `/data/venv-face`) |
| `analise/` | documentos, medições (`gate/*.json`, `pnp/*.json`), auditoria (`aud/`, `aud13/`) e folhas curadas (`clay/s13_*`, `clay/npc01_*`) |
| `referencias/upload-02/` | fotos de referência usadas pelas ferramentas de medição (dados pessoais: repositório PRIVADO) |
| `renders/` | `s13_demo.mp4` |

Fora do git, no disco e no backup `/data/portfolio-backup/*.bundle`: capturas, scans brutos, iterações S01–S12 e anteriores, renders de processo, caches.

## Reproduzir
```bash
blender -b --python tools/s13_build.py                 # S07 -> S13 (busto base), ~10 min
bash tools/bateria.sh s13                              # portão de expressões, poses, glb web, vídeo
blender -b --python tools/npc01_build.py -- blend/toon-npc-01.blend glb=export/npc01/npc01.glb sheets=/tmp/npc
AUD_O=analise/audNN AUD_B="blend/busto-sNN.blend" AUD_V="sNN" tools/aud_pack.sh && AUD_O=analise/audNN /data/venv-face/bin/python tools/aud_sheets.py
```
Regras: arquivo entregue abre no NEUTRO; nenhuma expressão sem passar em `tools/r_exprgate.py`; nenhuma entrega sem as folhas pela câmera das fotos (`aud_pack`/`aud_sheets`); a página Three.js aplica `mouthSmileFix = min(mouthSmileLeft, mouthSmileRight)`.
