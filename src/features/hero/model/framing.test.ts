import { describe, expect, it } from 'vitest'
import { computeFraming } from './framing'
import { BUST_SHIFT } from './layout'

describe('enquadramento', () => {
  it('largo: fov fixo e busto deslocado para a direita', () => {
    expect(computeFraming(1440, 900, [0, 0])).toEqual({ fov: 24, offsetX: -1440 * BUST_SHIFT, offsetY: 54 })
  })
  it('celular deitado (paisagem baixa) usa o layout largo; em pé, não', () => {
    expect(computeFraming(800, 360, [0, 0])).toEqual({ fov: 30, offsetX: -800 * BUST_SHIFT, offsetY: -36 })
    expect(computeFraming(800, 1280, [80, 900]).fov).not.toBe(24)
  })
  it('celular: fov entre 30° e 60°, cresce quando o espaço livre encolhe', () => {
    const roomy = computeFraming(360, 740, [80, 600])
    const tight = computeFraming(360, 740, [80, 300])
    expect(roomy.fov).toBeGreaterThanOrEqual(30)
    expect(tight.fov).toBeLessThanOrEqual(60)
    expect(tight.fov).toBeGreaterThan(roomy.fov)
    expect(roomy.offsetX).toBe(0)
  })
})
