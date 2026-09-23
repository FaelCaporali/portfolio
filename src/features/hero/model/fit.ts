/**
 * Tamanho de fonte para uma linha: o maior até o teto em que o texto mais largo cabe. `ratio` é a largura do texto
 * mais largo dividida pelo tamanho da fonte (medida com a fonte real do visitante).
 */
export function fitFontSize(available: number, ratio: number, max: number): number {
  if (available <= 0 || ratio <= 0) return max
  return Math.min(max, Math.floor(available / ratio))
}
