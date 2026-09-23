/** Largura a partir da qual o texto vai para a esquerda e o busto para a direita (lg do Tailwind). */
export const WIDE = 1024
/** No layout largo, quanto o busto sai do centro da tela para a direita (fração da largura). */
export const BUST_SHIFT = 0.2

export const isWide = (width: number) => width >= WIDE

/** Posição horizontal do busto na tela, em fração da largura. */
export const bustCenterX = (width: number) => (isWide(width) ? 0.5 + BUST_SHIFT : 0.5)
