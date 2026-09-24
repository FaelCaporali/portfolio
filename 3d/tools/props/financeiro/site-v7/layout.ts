/**
 * Retângulos do atlas do painel (gerado de `3d/tools/props/financeiro/atlas_layout.json`, a fonte). Convenção do
 * layout: [u0, v0, u1, v1] com origem embaixo à esquerda (v = 1 − y/H); o shader converte a UV do glTF (v para baixo).
 */
type Rect = readonly [number, number, number, number]

/** As 12 células em ordem de leitura (A1, B1, C1, A2 … C4). */
export const CELLS: readonly Rect[] = [
  [0.09024, 0.57333, 0.38171, 0.75429],
  [0.38171, 0.57333, 0.67317, 0.75429],
  [0.67317, 0.57333, 0.96463, 0.75429],
  [0.09024, 0.39238, 0.38171, 0.57333],
  [0.38171, 0.39238, 0.67317, 0.57333],
  [0.67317, 0.39238, 0.96463, 0.57333],
  [0.09024, 0.21143, 0.38171, 0.39238],
  [0.38171, 0.21143, 0.67317, 0.39238],
  [0.67317, 0.21143, 0.96463, 0.39238],
  [0.09024, 0.03048, 0.38171, 0.21143],
  [0.38171, 0.03048, 0.67317, 0.21143],
  [0.67317, 0.03048, 0.96463, 0.21143],
]

/** Texto da fórmula `Sub AtingirMeta()` e o u1 de cada caractere (u0 do primeiro = TEXT[0]). */
export const TEXT: Rect = [0.12073, 0.78667, 0.9439, 0.85143]
export const CHAR_U1: readonly number[] = [
  0.16919, 0.21764, 0.2661, 0.31456, 0.36301, 0.41147, 0.45993, 0.50838, 0.55684, 0.6053, 0.65375, 0.70221, 0.75067,
  0.79912, 0.84758, 0.89604, 0.94449,
]
/** Cursor de texto do atlas cheio (fim da fórmula). */
export const CARET: Rect = [0.95122, 0.77863, 0.95732, 0.86518]
/** Alça da célula ativa final (C4), para medir o tamanho da alça desenhada na célula que anda. */
export const HANDLE: Rect = [0.94378, 0.03048, 0.96463, 0.04676]
/** Espessura da moldura da célula ativa no atlas (5 px de 820 × 1050). */
export const FRAME_UV: readonly [number, number] = [0.0061, 0.00476]
