/**
 * Boleto de cobrança da Immersus (canvas do site, zero download), no valor da meta. Banco e linha digitável FICTÍCIOS;
 * sem data, CPF, CNPJ ou qualquer dado real. UV da malha: u da esquerda para a direita de quem vê, v de cima (0) para
 * baixo (1) no glTF, por isso flipY = false. Beneficiário, valor e código de barras ficam na metade esquerda (a fita
 * pode passar na frente da direita); a direita tem os campos cinza do boleto.
 */
import * as THREE from 'three'
import { HIT } from './timeline'

/** Folha de 0,105 × 0,07 m. */
const W = 1024
const H = Math.round((W * 0.07) / 0.105)
const PAPER = '#fbfaf5'
const INK = '#1d1d1f'
const GRAY = '#8a8a84'
const RULE = '#b9b8b0'
const SANS = "'Helvetica Neue', Arial, 'Liberation Sans', sans-serif"
const MONO = "'DejaVu Sans Mono', ui-monospace, Menlo, monospace"

/** Intercalado 2 de 5: 5 elementos por dígito, 2 largos ('1'); nos pares, o 1º dígito são barras e o 2º, espaços. */
const ITF = ['00110', '10001', '01001', '11000', '00101', '10100', '01100', '00011', '10010', '01010']
/** Fictício. Poucos dígitos de propósito: barras largas o bastante para ler "código de barras" a distância. */
const DIGITS = '0019470000000000'

function barcode(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const els: [boolean, number][] = []
  const push = (bar: boolean, wide: boolean) => els.push([bar, wide ? 3 : 1])
  for (let i = 0; i < 4; i++) push(i % 2 === 0, false)
  for (let i = 0; i + 1 < DIGITS.length; i += 2) {
    const a = ITF[Number(DIGITS[i])] ?? '00110'
    const b = ITF[Number(DIGITS[i + 1])] ?? '00110'
    for (let k = 0; k < 5; k++) {
      push(true, a[k] === '1')
      push(false, b[k] === '1')
    }
  }
  push(true, true)
  push(false, false)
  push(true, false)
  const unit = w / els.reduce((s, [, u]) => s + u, 0)
  let cx = x
  ctx.fillStyle = INK
  for (const [bar, u] of els) {
    if (bar) ctx.fillRect(Math.round(cx), y, Math.round(u * unit), h)
    cx += u * unit
  }
}

function field(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string) {
  ctx.strokeStyle = RULE
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, w, h)
  ctx.fillStyle = GRAY
  ctx.font = `400 20px ${SANS}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(label, x + 10, y + 8)
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color = INK) {
  ctx.fillStyle = color
  ctx.font = font
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(s, x, y)
}

export function createBoletoTexture() {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('canvas 2d indisponível')
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  let seed = 3
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let k = 0; k < 9000; k++) {
    ctx.fillStyle = `rgba(110, 105, 95, ${(rnd() * 0.05).toFixed(3)})`
    ctx.fillRect(rnd() * W, rnd() * H, 1, 1)
  }

  // Faixa superior: banco fictício | linha digitável fictícia.
  ctx.textBaseline = 'middle'
  ctx.fillStyle = INK
  ctx.font = `700 56px ${SANS}`
  ctx.textAlign = 'left'
  ctx.fillText('000-0', 22, 50)
  ctx.fillRect(196, 14, 4, 72)
  ctx.font = `600 22px ${MONO}`
  ctx.fillText('00000.00000 00000.000000 00000.000000 0 00000000194700', 214, 50)
  ctx.fillRect(14, 94, W - 28, 5)

  // Esquerda, em destaque: quem cobra e quanto.
  field(ctx, 14, 108, 474, 168, 'Beneficiário')
  text(ctx, 'IMMERSUS', 28, 142, `800 64px ${SANS}`)
  text(ctx, 'ENSINO DE IDIOMAS', 28, 214, `700 36px ${SANS}`)
  field(ctx, 14, 284, 474, 150, 'Valor do documento')
  text(ctx, 'R$ 1.947,00', 28, 324, `800 76px ${SANS}`)

  // Direita: campos de boleto em cinza, preenchidos só por traços (nenhum dado).
  const labels = ['Nosso número', 'Espécie doc.', 'Carteira', 'Quantidade', '(−) Desconto', '(=) Valor cobrado']
  labels.forEach((label, i) => {
    const x = 500 + (i % 2) * 257
    const y = 108 + Math.floor(i / 2) * 109
    field(ctx, x, y, 253, 105, label)
    ctx.fillStyle = '#d6d5ce'
    ctx.fillRect(x + 10, y + 56, 150 - (i % 3) * 30, 14)
  })

  barcode(ctx, 22, 458, 660, 196)
  text(ctx, 'Autenticação mecânica', 704, 462, `400 22px ${SANS}`, GRAY)
  text(ctx, 'Ficha de compensação', 704, 494, `700 24px ${SANS}`, GRAY)

  const texture = new THREE.CanvasTexture(c)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = false
  texture.anisotropy = 4
  return texture
}

/** Distância (m) que o boleto desliza para assentar no toque da linha na bandeira. */
const SLIDE = 0.008
const SETTLE = 0.25

/** Afastamento do boleto do seu lugar no instante t: 8 mm até HIT, depois assenta em 0,25 s (easeOut). */
export function boletoSlideAt(t: number) {
  const k = Math.min(1, Math.max(0, (t - HIT) / SETTLE))
  return SLIDE * (1 - k) ** 3
}
