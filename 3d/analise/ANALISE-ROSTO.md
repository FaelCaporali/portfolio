# Análise do rosto — Rafael Caporali (2026-09-15)

Método: 468 landmarks MediaPipe Face Mesh por foto (pose + blendshapes), métricas normalizadas pela distância entre cantos externos dos olhos (≈ 9 cm em adulto; 0,01 ≈ 1 mm), leitura artística sobre recortes em grade das fotos frontais (ref-15, ref-21, ref-05) e do perfil (ref-12). Métricas em `tools/asym_metrics.py`; overlays em `analise/lm_*.jpg`.

## Assimetrias medidas (consistentes nas 3 frontais)
| Traço | Medida | Leitura |
|---|---|---|
| Largura da bochecha (eixo→zigomático) | D 0,72–0,75 · E 0,67–0,70 | Lado direito 3–8 mm mais largo. |
| Mandíbula (eixo→ângulo) | D 0,60–0,61 · E 0,55–0,56 | Lado direito 5 mm mais largo. Assimetria principal do rosto. |
| Nariz (eixo raiz→ponta) | +0,7° a +2,5°; ponta 0,5–2 mm p/ a esquerda | Desvio da ponta para a **esquerda do sujeito**. Visível a olho como "torto"; o MediaPipe regulariza para simetria, então o real é maior que o medido. |
| Narinas | direita mais aberta/visível (leitura visual) | Confirma rotação da ponta para a esquerda. |
| Olhos | D 0,31–0,32 · E 0,31; abertura D 0,10 · E 0,096 | Direito ligeiramente maior e mais aberto. Alturas iguais. |
| Sobrancelhas | D 0,26 · E 0,24 acima do olho | Direita mais alta ≈1,5 mm. |
| Boca | cantos com dif. ≤ 2 mm; esquerdo um pouco mais alto | Quase simétrica. |

Conclusão: rosto **mais pesado à direita** (osso zigomático e mandíbula), nariz com ponta virada para a esquerda, olho direito um pouco maior. Espelhar o lado esquerdo (v02) mata isso; a v03 recolocou o rosto original.

## Proporções (Loomis / cânone clássico)
- Terços verticais (linha do cabelo → sobrancelha → base do nariz → queixo): 0,31 · 0,77 · 0,72. Terço médio longo: **nariz longo**, testa curta em relação à linha do cabelo atual, mas a testa é alta e recuada nas têmporas (entradas em "M").
- Altura/largura do rosto 1,26–1,29: **oval longo**.
- Distância interocular 0,38 × largura do olho 0,31: olhos ligeiramente **afastados**.
- Largura da boca 0,50; largura alar 0,38: boca larga em relação ao nariz.

## Leitura artística (planos de Asaro, ritmos de Reilly)
- Testa: ampla, bossas frontais marcadas, 4–5 rugas horizontais profundas quando ergue as sobrancelhas (ref-16). Linha do cabelo alta com recuo temporal.
- Arcada supraciliar: forte, sobrancelhas grossas, retas, baixas.
- Olhos: fundos, pálpebra superior encapuzada, olheira/sulco lacrimal profundo, canto externo ligeiramente caído. Olhar pesado.
- Nariz: dorso longo e reto, raiz alta, ponta arredondada com leve projeção, ângulo nasolabial ≈ 90°.
- Zigomas: altos e visíveis; face côncava abaixo deles (bochechas sugadas).
- Boca: lábio inferior cheio; superior coberto pelo bigode.
- Barba: densa, 1/3 da altura do rosto, afunila; grisalha no queixo.
- Cabelo: escuro, puxado para trás em coque/rabo; volume atrás da cabeça. Orelha média, lóbulo aderido, levemente afastada.
- Perfil: testa inclina moderadamente, nariz projetado, queixo escondido pela barba (a barba define a silhueta do maxilar), pescoço longo.
- Pele: tom oliva quente.

## Expressões nas referências (blendshapes)
- ref-16: sobrancelhas ao máximo, olhos arregalados → **surpresa** (rugas de testa obrigatórias).
- ref-19: sorriso largo com dentes, sobrancelhas erguidas → **sorriso**.
- ref-20: sorriso com olho esquerdo apertado (0,77) → sorriso lateral.
- ref-21 / ref-23: bico (mouthPucker 0,85–0,87) → útil para "choro".
- ref-18: olhos fechados, sobrancelhas internas erguidas (0,94) → base de **choro**.
- Neutro: ref-15, ref-05.

## O que a caricatura (caricatura-ia.png) elege como identidade
Rabo de cavalo, barba cheia, sobrancelhas grossas, nariz forte, olhos fundos, testa alta, riso escancarado. São os traços a preservar em qualquer estilização.

## Método de trabalho (escultores)
- Houdon: medir antes de modelar → métricas acima.
- Rodin, "método dos perfis": validar a forma por silhuetas em vários ângulos → folhas de 7 vistas a cada iteração.
- Bernini/Michelangelo: assimetria é vida; nunca espelhar o rosto inteiro.
- Loomis/Asaro: crânio como esfera cortada + planos; a nuca vem de proporção anatômica (tragion→opistocrânio ≈ 0,87 × tragion→ponta do nariz, Farkas) enquanto não houver foto da nuca.
