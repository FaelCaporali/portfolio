# NPC01 — personagem cartoon riggado do Fael (2026-09-17)

Personagem 3D estilizado ("quase um NPC dele"), corpo inteiro, riggado, com expressões, para comparar com o busto realista.
Tudo local e a custo zero: MPFB2 (MakeHuman para Blender) + numpy, Blender 4.5.1 headless. Nenhum asset externo.

## Entregas
- `blend/toon-npc-01.blend` — abre no neutro (chaves em 0, rig em repouso, sem animação). Objetos: `NPC01` (corpo, 13 380 vértices, topologia MakeHuman intacta), `Eye.L/R`, `Teeth.U/L`, `Beard`, `Brows`, `Hair`, `Bun`, `Shirt`, `Pants`, `Shoes`, `Outline`; armature `NPC01.rig` (163 ossos: esqueleto "default" do MPFB com `head`, `neck01-03`, `jaw`, `eye.L/R`, dedos, ossos faciais).
- `export/npc01/npc01.glb` (3,6 MB) + `npc01_eye.png` — armature com pesos, morph targets com nomes ARKit em `NPC01`, `Beard`, `Brows`, `Hair`, `Teeth.L`, `Outline`; cores toon em `COLOR_0`; olho com textura; `Outline` = casca invertida single-sided (renderiza como contorno em qualquer engine com backface culling). Materiais PBR simples: no Three.js trocar por `MeshToonMaterial({vertexColors:true})` (corpo e roupas) e `MeshBasicMaterial({color:0x050403})` no `Outline`.
- Folhas em `analise/clay/`: `npc01_turntable.jpg`, `npc01_vs_fotos.jpg`, `npc01_expressoes.jpg`, `npc01_rig.jpg`.

## Como reproduzir
```
cd 3d
blender -b --python tools/npc01_build.py -- blend/toon-npc-01.blend glb=export/npc01/npc01.glb sheets=/tmp/npc01
blender -b blend/toon-npc-01.blend --python tools/npc01_medidas.py       # medidas do rosto
```
Scripts: `tools/npc01_build.py` (tudo), `npc01_lib.py` (cascas, normais, materiais), `npc01_style.json` (todos os parâmetros de estilo), `npc01_render.py` (EEVEE, luz própria, vistas e chaves), `npc01_sheet.py`/`npc01_sheets.sh`/`npc01_vsfotos.py` (folhas), `npc01_export.py` (glb), `npc01_poses.json` (poses A/B do rig), `npc01_medidas.py`. Build completo com folhas: ~30 s.

## O que foi feito (pipeline)
1. **Base**: `HumanService.create_human` (masculino, 40 anos, helpers e cubos de junta) + os 64 parâmetros faciais medidos em `blend/mpfb-02.json` assados na malha (mesmo ponto de partida do busto realista).
2. **Estilização** por um campo de deformação numpy `F(p)`, aplicado à malha completa (corpo, helpers e cubos de junta — por isso o rig cai no lugar) e também a cada alvo de expressão (`F(V+delta)`), logo as chaves são consistentes com a cabeça exagerada:
   cabeça ×1,42 em torno da base do pescoço (razão cabeça:corpo **1:5,8**), crânio ×1,15 acima dos olhos, olhos ×1,30 no plano xz em torno de cada centro, nariz empurrado 8 mm para frente, mãos ×1,15, pés ×1,12.
3. **Rig**: `HumanService.add_builtin_rig(o, 'default', import_weights=True)` — esqueleto e pesos do MPFB. Depois o objeto MPFB é desmontado em partes; cascas herdam os pesos do vértice de origem (roupa: vizinho mais próximo).
4. **Partes** geradas em numpy a partir de regiões da malha, como cascas fechadas (camada externa deslocada pela normal + camada interna sob a pele + paredes na borda) — sem modificadores, para as chaves sobreviverem ao glb. As regiões são campos escalares (`f>0` dentro) e os polígonos parciais têm os vértices de fora puxados até a isolinha `f=0`: bordas lisas em vez de escada.
   - Barba+bigode: linha da base do nariz ao lóbulo, boca livre por elipse, espessura 20 mm, bigode +12 mm, ponta puxada 60 mm para baixo sob o queixo.
   - Sobrancelhas: barras grossas e retas (14 mm de altura, 11 mm de relevo), baixas.
   - Cabelo: linha alta com entradas em "M" (45 mm mais alta nas têmporas), fronteira diagonal acima da orelha, puxado para trás; coque (elipsoide) na nuca.
   - Olhos: esferas próprias com polo para a frente e textura procedural (esclera, íris castanha com limbo, pupila, brilho). Dentes: helpers do MPFB (superior no `head`, inferior no `jaw`, com chave `jawOpen` por transformação rígida do queixo).
   - Roupa a partir do helper `tights` do MPFB: camiseta preta (gola pela cilindrada do pescoço, manga até |x|=0,30), calça azul, tênis.
   - Cores por vértice: pele, lábio inferior, interior da boca, olheiras leves.
5. **Material toon**: Diffuse → Shader to RGB → rampa constante de 3 degraus × cor de vértice → Emission (EEVEE). Contorno: casca invertida (2,5 mm na cabeça, 3 mm no corpo) com material preto e backface culling; o contorno do corpo é desligado sob a roupa.
6. **Chaves de forma** (24, nomes ARKit) dos alvos `expression/units/caucasian` do MPFB, bilaterais divididas por máscara suave em x, com ganho (sorriso ×2, sobrancelhas ×1,6–1,7) porque os alvos do MakeHuman são discretos demais para cartoon: mouthSmileL/R, mouthFrownL/R, browInnerUp, browOuterUpL/R, browDownL/R, eyeBlinkL/R, eyeSquintL/R, eyeWideL/R, jawOpen, mouthPucker, mouthFunnel, mouthPressL/R, noseSneerL/R, mouthShrugUpper, mouthRollLower.

## Decisões de estilo
- Identidade preservada (o que a caricatura elege): barba cheia e longa, bigode cobrindo o lábio superior, sobrancelhas grossas e retas, nariz forte, testa alta com entradas, coque, olhar pesado (pálpebras encapuzadas cobrem o topo da íris), lábio inferior visível e recuado. Cabelo é o das fotos (puxado para trás com coque), não "curto".
- Rosto longo e estreito (largura ×1,0) sob crânio cheio (×1,15): o oval longo dele mantido; a caricatura vem da cabeça grande, olhos e nariz.
- Formas lisas e legíveis: cascas com bordas por isolinha, três degraus de sombra, contorno fino. Sem textura de pele (cores chapadas), como um personagem de jogo indie.

## Proporções NPC × ref-15 (% da interocular, cantos externos dos olhos)
Medidas na malha (`tools/npc01_medidas.py`); a coluna "foto" vem de `tools/r_lmcompare.py` (MediaPipe na ref-15). O detector não funciona confiavelmente no render cartoon (superestima a interocular ~3×), por isso as do NPC são geométricas e aproximadas.

| medida | foto | NPC | dif |
|---|---|---|---|
| boca largura | 50,8 | 53,1 | +4 % |
| olho largura | 31,5 | 37,1 | +18 % (olhos maiores de propósito) |
| sobrancelhas distância | 30,4 | 26,4 | −13 % |
| rosto largura | 141,5 | 148,2 | +5 % |
| rosto altura (linha do cabelo→queixo) | 179,2 | 164,2 | −8 % |
| boca→queixo | 33,1 | 29,1 | −12 % |
| nariz largura | 45,9 | 29,4* | (*banda na ponta; asas não capturadas) |
| nariz→boca | 21,0 | 4,1* | (*base do nariz estimada; não confiável) |

Cabeça 0,321 m em 1,858 m de altura total → 1:5,8. Interocular 0,155 m.

## O que está bom / ruim (avaliação honesta)
Bom: lê como cartoon dele (barba, coque, sobrancelhas, nariz, olhar pesado); rig deforma corpo e roupa sem rasgos nas duas poses; expressões funcionam nas partes (barba, sobrancelhas, dentes, contorno seguem); glb com tudo, 3,6 MB.
Ruim / pendências:
- Sorriso ainda discreto (alvo do MakeHuman não levanta bochecha); precisaria de alvo esculpido próprio. `browInnerUp` também é sutil.
- Olhos: com as pálpebras encapuzadas, no neutro a íris fica meio coberta ("sonolento"); um `eyeWide` ~0,25 na cena resolve, ou baixar `eyeball_back`. Sem cílios.
- Cabelo é um casco liso (sem mechas); barba é uma massa lisa, com um degrau quadrado na parte de trás sob a mandíbula (perfil). Coque parcialmente afundado na cabeça.
- Nariz de frente vira um volume mole (topologia MakeHuman + cores chapadas); a assimetria real (ponta para a esquerda) não foi exagerada.
- Roupa: ombros da camiseta "acolchoados" (casca de 10 mm sobre o helper); sem dobras; calça e tênis são o helper inflado, sem sola/cadarço.
- Mãos com dedos finos (sem estilização própria); pose A das folhas tem a mão passando perto da cabeça.
- Sem língua; interior da boca é só cor.
- Medidas nariz/nariz→boca da tabela não são confiáveis (heurística geométrica).
