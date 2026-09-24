/**
 * Fita da calculadora (canvas do site, zero download): papel térmico com quatro somas, da mais antiga (ponta) à mais
 * nova (fenda). A nova soma a coluna D do painel e dá a meta da bandeira; o total sai em vermelho (fita bicolor).
 * UV da malha (3d/tools/prop_financeiro_direita.py): u na largura (0 à esquerda de quem vê), v no comprimento; no glTF
 * v = 0 na ponta e 1 na fenda (no Blender, o contrário), então o topo do canvas é a ponta e flipY = false.
 * Imprimir é deslocar a textura em v: o bloco novo está desenhado "dentro da máquina" e sai pela fenda linha a linha.
 */
import * as THREE from 'three'
import { HIT, T } from './timeline'

/** Largura do papel (m). O comprimento vem da malha: o canvas tem a proporção do papel. */
const FITA_W = 0.03
const BLOCKS: readonly (readonly [readonly number[], string])[] = [
  [[412, 318, 276, 278], '1.284'],
  [[438, 296, 251, 187], '1.172'],
  [[455, 362, 318, 428], '1.563'],
  [[521, 447, 389, 590], '1.947'],
]
/** Linhas de cada soma: 4 parcelas, tracejado e total. */
const LINES = 6
/** Passos de linha no comprimento: 4 somas com uma linha em branco entre elas, 1 de papel até a fenda, 2 na ponta. */
const ROWS = 30
const BOTTOM = 1
/** O bloco novo avança uma linha em branco e as suas 6 linhas. */
const FEED = LINES + 1
/** Intervalo entre linhas impressas: a primeira no início do preenchimento do painel, o total no toque (HIT). */
const STEP = (HIT - T.fillStart) / (LINES - 1)
/** Tranco do avanço do papel a cada linha (s). */
const JOLT = 0.04

const PAPER = '#f6f1e5'
const INK = '#3a2553'
const RED = '#b3232b'

/** Pontos médios da malha em cada valor de v (uv.y), da ponta à fenda. */
export function alongV(g: THREE.BufferGeometry) {
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  const sums = new Map<number, [number, number, number, number]>()
  for (let i = 0; i < pos.count; i++) {
    const k = Math.round(uv.getY(i) * 1e4)
    const s = sums.get(k) ?? [0, 0, 0, 0]
    s[0] += pos.getX(i)
    s[1] += pos.getY(i)
    s[2] += pos.getZ(i)
    s[3] += 1
    sums.set(k, s)
  }
  return [...sums.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, s]) => new THREE.Vector3(s[0] / s[3], s[1] / s[3], s[2] / s[3]))
}

export function lengthOf(points: readonly THREE.Vector3[]) {
  let l = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (a && b) l += a.distanceTo(b)
  }
  return l
}

/** Linhas já avançadas no instante t (0..FEED): cada linha dá um tranco curto que desacelera, sem quique. */
function fedAt(t: number) {
  let fed = 0
  for (let i = 0; i < LINES; i++) {
    const k = (t - (T.fillStart + i * STEP)) / JOLT
    if (k <= 0) break
    // A primeira linha também avança a linha em branco entre as somas.
    fed += (i === 0 ? 2 : 1) * (1 - (1 - Math.min(1, k)) ** 3)
  }
  return fed
}

/** Deslocamento da textura em v: antes de imprimir, a fenda está no fim da soma C; ao fim, no fim da soma D. */
export const fitaOffsetAt = (t: number) => -(FEED - fedAt(t)) / ROWS

function paper(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, w, h)
  let seed = 7
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let k = 0; k < (w * h) / 40; k++) {
    ctx.fillStyle = `rgba(120, 100, 80, ${(rnd() * 0.06).toFixed(3)})`
    ctx.fillRect(rnd() * w, rnd() * h, 1, 1)
  }
  // Bordas um pouco mais escuras: o papel fino deixa passar o que está atrás.
  const edge = ctx.createLinearGradient(0, 0, w, 0)
  edge.addColorStop(0, 'rgba(150, 130, 110, 0.22)')
  edge.addColorStop(0.07, 'rgba(150, 130, 110, 0)')
  edge.addColorStop(0.93, 'rgba(150, 130, 110, 0)')
  edge.addColorStop(1, 'rgba(150, 130, 110, 0.22)')
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, w, h)
}

/** Textura estática da fita inteira; a impressão é só o offset (fitaOffsetAt). */
export function createFitaTexture(length: number) {
  const h = 1024
  const w = Math.max(64, Math.round((h * FITA_W) / length))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('canvas 2d indisponível')
  paper(ctx, w, h)

  const pitch = h / ROWS
  const size = Math.min(pitch * 0.8, (w * 0.88) / (8 * 0.6))
  ctx.font = `700 ${size.toFixed(1)}px 'DejaVu Sans Mono', ui-monospace, Menlo, Consolas, monospace`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  const cw = ctx.measureText('0').width
  const right = w - Math.max(cw * 0.5, w * 0.05)
  const y = (row: number) => h - (row + 0.5) * pitch

  BLOCKS.forEach(([items, total], b) => {
    const base = BOTTOM + (BLOCKS.length - 1 - b) * (LINES + 1)
    // Número alinhado à direita, uma coluna vazia, sinal na última coluna.
    const line = (j: number, num: string, sign: string, color: string) => {
      const yy = y(base + LINES - 1 - j)
      ctx.fillStyle = color
      ctx.fillText(sign, right, yy)
      ctx.fillText(num, right - 2 * cw, yy)
    }
    items.forEach((n, j) => line(j, String(n), '+', INK))
    ctx.strokeStyle = INK
    ctx.lineWidth = Math.max(1.5, pitch * 0.07)
    ctx.setLineDash([cw * 0.55, cw * 0.45])
    ctx.beginPath()
    ctx.moveTo(right - 7 * cw, y(base + 1))
    ctx.lineTo(right, y(base + 1))
    ctx.stroke()
    ctx.setLineDash([])
    line(LINES - 1, total, 'T', b === BLOCKS.length - 1 ? RED : INK)
  })

  const texture = new THREE.CanvasTexture(c)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = false
  texture.anisotropy = 8
  return texture
}
