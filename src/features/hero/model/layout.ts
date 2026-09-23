/**
 * Layout largo: texto à esquerda e busto à direita. Vale no desktop (a partir de 1024 px) e no celular deitado
 * (paisagem com até 520 px de altura), onde o empilhado de celular em pé não cabe na altura. A mesma condição está no
 * variant `wide` de index.css (layout) e em WIDE_QUERY (medidas no navegador); as três mudam juntas.
 */
export const WIDE = 1024
export const SHORT_LANDSCAPE = 520
export const WIDE_QUERY = `(min-width: ${WIDE}px), (orientation: landscape) and (max-height: ${SHORT_LANDSCAPE}px)`

/** No layout largo, quanto o busto sai do centro da tela para a direita (fração da largura). */
export const BUST_SHIFT = 0.2

export const isWide = (width: number, height: number) => width >= WIDE || (width > height && height <= SHORT_LANDSCAPE)

/** Posição horizontal do busto na tela, em fração da largura. */
export const bustCenterX = (width: number, height: number) => (isWide(width, height) ? 0.5 + BUST_SHIFT : 0.5)
