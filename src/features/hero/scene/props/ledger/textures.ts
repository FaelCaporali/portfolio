/** Texturas geradas no próprio site (zero download): a planilha no vidro e o desgaste das moedas. */
import * as THREE from 'three'
import { CANVAS_H, CANVAS_W, drawGlass, drawSheet, type SheetState } from './sheet'

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('canvas 2d indisponível')
  return { c, ctx }
}

/**
 * Textura da planilha. O fundo de vidro (com grão) é desenhado uma vez; update() redesenha só quando o estado muda.
 * UV do vidro vem do glTF (v = 0 no topo), por isso flipY = false.
 */
export function createSheetTexture() {
  const base = canvas(CANVAS_W, CANVAS_H)
  drawGlass(base.ctx)
  const { c, ctx } = canvas(CANVAS_W, CANVAS_H)
  const texture = new THREE.CanvasTexture(c)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = false
  texture.anisotropy = 4
  let last = ''
  return {
    texture,
    update(s: SheetState) {
      const key = `${s.typed}|${s.filled}|${s.active}|${s.caret}`
      if (key === last) return
      last = key
      drawSheet(ctx, base.c, s)
      texture.needsUpdate = true
    },
  }
}

/**
 * Desgaste da moeda (roughnessMap, canal G multiplica a rugosidade): orla polida pelo manuseio, campo acetinado com
 * grão fino e riscos curtos. UV planar vista de cima (3d/tools/prop_financeiro.py): o centro do canvas é o eixo.
 */
export function createWearTexture() {
  const S = 128
  const { c, ctx } = canvas(S, S)
  ctx.fillStyle = 'rgb(0, 190, 0)'
  ctx.fillRect(0, 0, S, S)
  let seed = 11
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let k = 0; k < 1400; k++) {
    const g = 150 + rnd() * 90
    ctx.fillStyle = `rgb(0, ${g.toFixed(0)}, 0)`
    ctx.fillRect(rnd() * S, rnd() * S, 1, 1)
  }
  ctx.lineWidth = 0.6
  for (let k = 0; k < 26; k++) {
    const x = rnd() * S
    const y = rnd() * S
    const a = rnd() * Math.PI
    const l = 4 + rnd() * 12
    ctx.strokeStyle = `rgba(0, ${(120 + rnd() * 120).toFixed(0)}, 0, 0.7)`
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
    ctx.stroke()
  }
  // Orla (raio 0,93–1 do disco) mais lisa: é onde o dedo e as outras moedas gastam.
  ctx.strokeStyle = 'rgb(0, 115, 0)'
  ctx.lineWidth = S * 0.035
  ctx.beginPath()
  ctx.arc(S / 2, S / 2, S * 0.48, 0, Math.PI * 2)
  ctx.stroke()
  const texture = new THREE.CanvasTexture(c)
  texture.flipY = false
  return texture
}
