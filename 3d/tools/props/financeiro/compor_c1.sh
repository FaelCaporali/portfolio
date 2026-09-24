#!/usr/bin/env bash
# Folha lado a lado das opções do estudo da lâmina (diretor, correção 1 do conceito), no tamanho real de cada tela.
# Uso: compor_c1.sh <pasta com <opção>-<tela>.png> <saída-prefixo> <opção>...  → <saída-prefixo>-<tela>.png
# Recorte fixo por tela (px da captura): rosto à esquerda + peça, sem escala (o que se vê é o tamanho real).
set -euo pipefail
pasta=$1; saida=$2; shift 2
declare -A RECORTE=([1440x900]=440x430+1000+140 [1024x768]=330x320+700+100 [360x740]=340x400+380+210)
for tela in 1440x900 1024x768 360x740; do
  args=()
  for op in "$@"; do
    args+=( \( "$pasta/$op-$tela.png" -gravity northwest -crop "${RECORTE[$tela]}" +repage -gravity north -background '#202024' \
      -splice 0x26 -fill '#e8e8e8' -pointsize 18 -annotate +0+3 "$op" -bordercolor '#202024' -border 3 \) )
  done
  convert "${args[@]}" +append "$saida-$tela.png"
done
