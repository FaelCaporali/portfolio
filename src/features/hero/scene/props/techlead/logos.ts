/**
 * Logos oficiais da vida techlead (REQUISITOS T4): Jira, Figma, Excalidraw e Mermaid num WebP local gerado por
 * 3d/tools/props/techlead_atlas.mjs (nada vem de fora: CSP); fonte e licença de cada um em
 * 3d/referencias/props/techlead/logos/FONTES.md. A ORDEM de LOGOS é a das células do script.
 */
import atlasUrl from './logos.webp?url'

const LOGOS = ['jira', 'figma', 'excalidraw', 'mermaid'] as const
export type Logo = (typeof LOGOS)[number]

/** Célula do atlas (px) e colunas da grade: as do script. */
const CELULA = 96
const COLUNAS = 4

/** Carrega o atlas (uma vez por montagem da vida; o navegador guarda em cache). */
export function carregarLogos(): Promise<HTMLImageElement> {
  const img = new Image()
  img.decoding = 'async'
  img.src = atlasUrl
  return img.decode().then(() => img)
}

/** Desenha o logo `id` com centro (x, y) e lado `lado` (unidades do contexto). */
export function desenharLogo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  id: Logo,
  x: number,
  y: number,
  lado: number,
) {
  const i = LOGOS.indexOf(id)
  const sx = (i % COLUNAS) * CELULA
  const sy = Math.floor(i / COLUNAS) * CELULA
  ctx.drawImage(img, sx, sy, CELULA, CELULA, x - lado / 2, y - lado / 2, lado, lado)
}
