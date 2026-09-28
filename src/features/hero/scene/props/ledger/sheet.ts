/**
 * A planilha do painel: dados, geometria das células (em pixels do canvas e em metros no vidro) e o desenho em canvas.
 * O canvas vira a textura do vidro (UV 0..1 na área útil, 3d/tools/prop_financeiro.py). Nada aqui depende do React.
 */

/** Área útil do vidro (m), igual a GLASS_W/GLASS_H do script do Blender. */
const GLASS_W = 0.165
const GLASS_H = 0.118

/** Canvas com a mesma proporção do vidro. */
export const CANVAS_W = 768
export const CANVAS_H = 550
const FORMULA_H = 62
const HEADER_H = 40
const ROWHDR_W = 52
const NAMEBOX_W = 96
const COLS = 4
const ROWS = 5
const CELL_W = (CANVAS_W - ROWHDR_W) / COLS
const CELL_H = (CANVAS_H - FORMULA_H - HEADER_H) / ROWS

/** A macro digitada na barra de fórmula. */
export const MACRO = 'Sub HitTarget()'

/**
 * Quatro trimestres (colunas) × quatro linhas de resultado; a quinta linha é o total, e as somas fecham de verdade.
 * O total do trimestre é o que a linha de tendência plota: cai no 2º trimestre e passa da meta no 4º.
 */
const ITEMS = [
  [412, 438, 455, 521],
  [318, 296, 362, 447],
  [276, 251, 318, 389],
  [278, 187, 428, 590],
] as const
export const TOTALS = [0, 1, 2, 3].map((c) => ITEMS.reduce((s, row) => s + (row[c] ?? 0), 0))
/** Valores na ordem em que a macro preenche (linha a linha; o total por último). */
const CELLS = [...ITEMS.flat(), ...TOTALS]
export const CELL_COUNT = CELLS.length

const COL_NAMES = ['A', 'B', 'C', 'D']

/** Centro da célula i (ordem de preenchimento) no plano do vidro, em metros, origem no centro do painel. */
export function cellCenter(i: number): [number, number] {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const px = ROWHDR_W + CELL_W * (col + 0.5)
  const py = FORMULA_H + HEADER_H + CELL_H * (row + 0.5)
  return [(px / CANVAS_W - 0.5) * GLASS_W, (0.5 - py / CANVAS_H) * GLASS_H]
}

/** Tamanho da célula no vidro (m). */
export const CELL_SIZE: [number, number] = [(CELL_W / CANVAS_W) * GLASS_W, (CELL_H / CANVAS_H) * GLASS_H]

/** Centro horizontal da coluna c no vidro (m). */
export const columnX = (c: number) => cellCenter(c)[0]

export interface SheetState {
  /** Caracteres da macro já digitados. */
  typed: number
  /** Células preenchidas (ordem de CELLS). */
  filled: number
  /** Célula ativa (cursor). */
  active: number
  /** Cursor de texto na barra de fórmula (só enquanto digita). */
  caret: boolean
}

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace'
const GREEN = '#175a3a'
const GREEN_HI = '#33c481'
const INK = 'rgba(236, 241, 246, 0.94)'
const INK_DIM = 'rgba(236, 241, 246, 0.5)'
const RULE = 'rgba(255, 255, 255, 0.11)'

/** Fundo do vidro fosco: tinta fria translúcida, grão fixo (sementeado) e o fio de luz na borda de cima. */
export function drawGlass(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, CANVAS_W * 0.35, CANVAS_H)
  g.addColorStop(0, 'rgba(58, 68, 80, 0.62)')
  g.addColorStop(0.55, 'rgba(30, 36, 44, 0.56)')
  g.addColorStop(1, 'rgba(22, 27, 34, 0.6)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  let seed = 7
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let k = 0; k < 9000; k++) {
    const light = rnd() > 0.5
    ctx.fillStyle = light ? `rgba(255,255,255,${0.02 + rnd() * 0.035})` : `rgba(0,0,0,${0.03 + rnd() * 0.05})`
    ctx.fillRect(rnd() * CANVAS_W, rnd() * CANVAS_H, 1.5, 1.5)
  }
  // Reflexo difuso na diagonal (o vidro pega a luz de cima à esquerda) e o fio de luz nas bordas de cima e da esquerda.
  const sheen = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H * 0.9)
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.07)')
  sheen.addColorStop(0.32, 'rgba(255, 255, 255, 0.025)')
  sheen.addColorStop(0.33, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.fillRect(0, 0, CANVAS_W, 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.fillRect(0, 0, 2, CANVAS_H)
}

function drawFormulaBar(ctx: CanvasRenderingContext2D, s: SheetState) {
  const mid = FORMULA_H / 2
  ctx.fillStyle = 'rgba(8, 11, 15, 0.38)'
  ctx.fillRect(0, 0, CANVAS_W, FORMULA_H)
  ctx.fillStyle = RULE
  ctx.fillRect(NAMEBOX_W, 12, 1.5, FORMULA_H - 24)
  ctx.fillRect(0, FORMULA_H - 1.5, CANVAS_W, 1.5)
  ctx.textBaseline = 'middle'
  // Caixa de nome: a referência da célula ativa, como no Excel.
  ctx.font = `500 24px ${FONT}`
  ctx.fillStyle = INK_DIM
  ctx.textAlign = 'center'
  ctx.fillText(`${COL_NAMES[s.active % COLS] ?? 'A'}${Math.floor(s.active / COLS) + 1}`, NAMEBOX_W / 2, mid)
  ctx.font = `italic 500 24px Georgia, "Times New Roman", serif`
  ctx.fillText('fx', NAMEBOX_W + 34, mid)
  ctx.textAlign = 'left'
  ctx.font = `500 27px ${MONO}`
  const text = MACRO.slice(0, s.typed)
  const x0 = NAMEBOX_W + 68
  // "Sub" em azul de palavra-chave do editor de VBA; o resto em tinta clara.
  const kw = Math.min(text.length, 3)
  ctx.fillStyle = '#7fb4ff'
  ctx.fillText(text.slice(0, kw), x0, mid)
  const wKw = ctx.measureText(text.slice(0, kw)).width
  ctx.fillStyle = INK
  ctx.fillText(text.slice(kw), x0 + wKw, mid)
  if (s.caret) {
    ctx.fillStyle = INK
    ctx.fillRect(x0 + ctx.measureText(text).width + 3, mid - 15, 2.5, 30)
  }
}

function drawHeaders(ctx: CanvasRenderingContext2D, s: SheetState) {
  const top = FORMULA_H
  const activeCol = s.active % COLS
  const activeRow = Math.floor(s.active / COLS)
  ctx.fillStyle = GREEN
  ctx.fillRect(0, top, CANVAS_W, HEADER_H)
  // Canto "selecionar tudo": o triângulo do Excel.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.beginPath()
  ctx.moveTo(ROWHDR_W - 8, top + 8)
  ctx.lineTo(ROWHDR_W - 8, top + HEADER_H - 8)
  ctx.lineTo(ROWHDR_W - 22, top + HEADER_H - 8)
  ctx.closePath()
  ctx.fill()
  ctx.font = `600 22px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  COL_NAMES.forEach((name, c) => {
    const x = ROWHDR_W + CELL_W * c
    if (c === activeCol) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.fillRect(x, top, CELL_W, HEADER_H)
      ctx.fillStyle = GREEN_HI
      ctx.fillRect(x, top + HEADER_H - 4, CELL_W, 4)
    }
    ctx.fillStyle = c === activeCol ? '#ffffff' : 'rgba(255, 255, 255, 0.82)'
    ctx.fillText(name, x + CELL_W / 2, top + HEADER_H / 2 + 1)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.fillRect(x, top + 6, 1.5, HEADER_H - 12)
  })
  // Números das linhas.
  const body = FORMULA_H + HEADER_H
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.fillRect(0, body, ROWHDR_W, CANVAS_H - body)
  ctx.font = `500 21px ${FONT}`
  for (let r = 0; r < ROWS; r++) {
    const y = body + CELL_H * r
    if (r === activeRow) {
      ctx.fillStyle = 'rgba(51, 196, 129, 0.16)'
      ctx.fillRect(0, y, ROWHDR_W, CELL_H)
      ctx.fillStyle = GREEN_HI
      ctx.fillRect(ROWHDR_W - 4, y, 4, CELL_H)
    }
    ctx.fillStyle = r === activeRow ? INK : INK_DIM
    ctx.fillText(String(r + 1), ROWHDR_W / 2, y + CELL_H / 2)
  }
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  const body = FORMULA_H + HEADER_H
  ctx.fillStyle = RULE
  for (let c = 0; c <= COLS; c++) ctx.fillRect(ROWHDR_W + CELL_W * c - 0.75, body, 1.5, CANVAS_H - body)
  for (let r = 1; r < ROWS; r++) ctx.fillRect(ROWHDR_W, body + CELL_H * r - 0.75, CANVAS_W - ROWHDR_W, 1.5)
  // Total: fio simples em cima e duplo embaixo, como no fechamento contábil.
  const yTot = body + CELL_H * (ROWS - 1)
  ctx.fillStyle = 'rgba(236, 241, 246, 0.55)'
  ctx.fillRect(ROWHDR_W + 14, yTot + 1, CANVAS_W - ROWHDR_W - 28, 2)
  ctx.fillRect(ROWHDR_W + 14, yTot + CELL_H - 12, CANVAS_W - ROWHDR_W - 28, 2)
  ctx.fillRect(ROWHDR_W + 14, yTot + CELL_H - 7, CANVAS_W - ROWHDR_W - 28, 2)
}

function drawValues(ctx: CanvasRenderingContext2D, s: SheetState) {
  const body = FORMULA_H + HEADER_H
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < Math.min(s.filled, CELL_COUNT); i++) {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const total = row === ROWS - 1
    ctx.font = total ? `700 31px ${FONT}` : `500 29px ${FONT}`
    ctx.fillStyle = total ? '#ffffff' : INK
    const v = CELLS[i] ?? 0
    ctx.fillText(v.toLocaleString('en-US'), ROWHDR_W + CELL_W * (col + 1) - 20, body + CELL_H * (row + 0.5) + 1)
  }
}

/** Desenha a planilha inteira no estado dado, sobre o fundo de vidro já pronto (base). */
export function drawSheet(ctx: CanvasRenderingContext2D, base: HTMLCanvasElement, s: SheetState) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  ctx.drawImage(base, 0, 0)
  drawGrid(ctx)
  drawHeaders(ctx, s)
  drawFormulaBar(ctx, s)
  drawValues(ctx, s)
}
