import { describe, expect, it } from 'vitest'
import { createFace, stepFace } from './face'

describe('rosto', () => {
  it('aproxima a expressão da vida aos poucos', () => {
    const f = createFace()
    stepFace(f, { mouthSmile: 1 }, 1 / 60, () => 0)
    expect(f.smile).toBeGreaterThan(0)
    expect(f.smile).toBeLessThan(0.1)
    for (let i = 0; i < 120; i++) stepFace(f, { mouthSmile: 1 }, 1 / 60, () => 0)
    expect(f.smile).toBeGreaterThan(0.99)
  })
  it('pisca: fecha e abre em 150 ms e agenda o próximo entre 2 e 5 s', () => {
    const f = createFace()
    stepFace(f, {}, 1.99, () => 0.5)
    expect(f.blink).toBe(0)
    stepFace(f, {}, 0.02, () => 0.5)
    expect(f.nextBlink).toBeCloseTo(3.5)
    stepFace(f, {}, 0.055, () => 0.5)
    expect(f.blink).toBeCloseTo(1)
    stepFace(f, {}, 0.1, () => 0.5)
    expect(f.blink).toBe(0)
    expect(f.blinkT).toBe(-1)
  })
})
