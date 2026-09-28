/**
 * O ROSTO do robô da mesa (FICHA §4.2): a tela `ai_tela` do glb vira um canvas (UV 0–1 = área útil, u da esquerda na
 * tela, v de baixo para cima) com os estados da história — desligado, escuta, pensa (reticências nos olhos), fala,
 * pergunta (no handoff) e comemora —, na mesma linguagem dos rostinhos do fundo (estilo.ts: olhos em pílula no acento).
 * O canvas só é redesenhado quando o estado muda ou, nos estados animados, a no máximo 12 quadros por segundo.
 */
import * as THREE from 'three'
import { ACENTO } from './estilo'
import type { Rosto } from './roteiro'

/** Canvas na proporção da área útil da tela (37 × 21 mm). */
const W = 256
const H = 146
const PASSO = 1 / 12

export function criarRosto() {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const textura = new THREE.CanvasTexture(canvas)
  textura.colorSpace = THREE.SRGBColorSpace
  let ultimo: Rosto | null = null
  let quando = -1

  const olhos = (dx: number, alto: number, forma: 'pilula' | 'arco') => {
    if (!ctx) return
    for (const s of [-1, 1]) {
      const x = W / 2 + s * 48 + dx
      if (forma === 'arco') {
        ctx.lineWidth = 11
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.arc(x, 72, 20, Math.PI * 1.12, Math.PI * 1.88)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.roundRect(x - 13, 64 - alto / 2, 26, alto, 13)
        ctx.fill()
      }
    }
  }

  /** Desenha o estado `r` no instante `t` (s); devolve se mudou. */
  const desenhar = (r: Rosto, t: number) => {
    const animado = r === 'pensa' || r === 'fala' || r === 'comemora'
    if (!ctx || (r === ultimo && (!animado || t - quando < PASSO))) return false
    ultimo = r
    quando = t
    ctx.fillStyle = '#030607'
    ctx.fillRect(0, 0, W, H)
    if (r === 'desligado') {
      // Tela apagada: só o reflexo na diagonal.
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0.35, 'rgba(255,255,255,0)')
      g.addColorStop(0.5, 'rgba(255,255,255,0.05)')
      g.addColorStop(0.65, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      textura.needsUpdate = true
      return true
    }
    ctx.fillStyle = ACENTO
    ctx.strokeStyle = ACENTO
    ctx.shadowColor = ACENTO
    ctx.shadowBlur = 10
    if (r === 'pensa') {
      for (let i = -1; i <= 1; i++) {
        const salto = Math.max(0, Math.sin(t * 9 - i * 1.1)) * 8
        ctx.beginPath()
        ctx.arc(W / 2 + i * 34, 68 - salto, 9, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (r === 'comemora') {
      olhos(0, 0, 'arco')
      ctx.beginPath()
      ctx.arc(W / 2, 92, 26, 0.15 * Math.PI, 0.85 * Math.PI)
      ctx.lineWidth = 8
      ctx.stroke()
      const brilho = 0.5 + 0.5 * Math.sin(t * 10)
      ctx.globalAlpha = brilho
      for (const [x, y] of [
        [34, 30],
        [222, 38],
      ] as const) {
        ctx.fillRect(x - 1.5, y - 8, 3, 16)
        ctx.fillRect(x - 8, y - 1.5, 16, 3)
      }
      ctx.globalAlpha = 1
    } else if (r === 'pergunta') {
      olhos(-10, 40, 'pilula')
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(W / 2 + 24, 30)
      ctx.lineTo(W / 2 + 54, 24)
      ctx.stroke()
      ctx.font = '700 44px ui-sans-serif, system-ui, sans-serif'
      ctx.fillText('?', 214, 84)
    } else {
      olhos(0, r === 'escuta' ? 46 : 42, 'pilula')
      if (r === 'fala') {
        const boca = 5 + Math.abs(Math.sin(t * 14)) * 12
        ctx.beginPath()
        ctx.ellipse(W / 2, 110, 20, boca / 2, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.shadowBlur = 0
    textura.needsUpdate = true
    return true
  }
  const dispose = () => textura.dispose()
  return { textura, desenhar, dispose }
}
