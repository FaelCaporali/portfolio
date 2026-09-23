/** Expressão e piscar do rosto: aproximação suave da expressão da vida e piscar autônomo. Sem three.js. */
import type { Expression } from '../../../content/journey'
import { approach } from '../../../lib/math'

export interface Face {
  smile: number
  innerUp: number
  outerUp: number
  down: number
  /** 0 aberto, 1 fechado. */
  blink: number
  /** Segundos até o próximo piscar. */
  nextBlink: number
  /** Tempo dentro do piscar atual; negativo = sem piscar. */
  blinkT: number
}

/** Piscar: 150 ms fechando e abrindo, a cada 2 a 5 s. */
const BLINK_S = 0.15
const BLINK_EVERY = { min: 2, spread: 3 }

export const createFace = (): Face => ({
  smile: 0,
  innerUp: 0,
  outerUp: 0,
  down: 0,
  blink: 0,
  nextBlink: BLINK_EVERY.min,
  blinkT: -1,
})

export function stepFace(f: Face, expr: Expression, dt: number, random: () => number = Math.random) {
  const k = approach(dt, 4)
  f.smile += ((expr.mouthSmile ?? 0) - f.smile) * k
  f.innerUp += ((expr.browInnerUp ?? 0) - f.innerUp) * k
  f.outerUp += ((expr.browOuterUp ?? 0) - f.outerUp) * k
  f.down += ((expr.browDown ?? 0) - f.down) * k

  f.nextBlink -= dt
  if (f.nextBlink <= 0 && f.blinkT < 0) {
    f.blinkT = 0
    f.nextBlink = BLINK_EVERY.min + random() * BLINK_EVERY.spread
  }
  if (f.blinkT >= 0) {
    f.blinkT += dt
    f.blink = Math.sin(Math.min(f.blinkT / BLINK_S, 1) * Math.PI)
    if (f.blinkT >= BLINK_S) {
      f.blinkT = -1
      f.blink = 0
    }
  }
}
