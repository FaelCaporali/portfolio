import { describe, expect, it } from 'vitest'
import { DRAG_MAX_PITCH, DRAG_MAX_YAW, createDrag, dragBy, grab, isHeld, release, stepDrag } from './drag'

describe('arrasto do busto', () => {
  it('meia tela gira ~100° e respeita os limites', () => {
    const d = createDrag()
    grab(d)
    dragBy(d, 0.1, 0, 0.016)
    expect(d.yaw).toBeCloseTo(0.35)
    dragBy(d, 5, -5, 0.016)
    expect(d.yaw).toBe(DRAG_MAX_YAW)
    expect(d.pitch).toBe(DRAG_MAX_PITCH)
  })
  it('soltar em movimento dá embalo; parado antes de soltar, não', () => {
    const moving = createDrag()
    grab(moving)
    dragBy(moving, 0.01, 0, 0.016)
    release(moving, 10)
    expect(moving.vYaw).toBeGreaterThan(0)

    const stopped = createDrag()
    grab(stopped)
    dragBy(stopped, 0.01, 0, 0.016)
    release(stopped, 200)
    expect(stopped.vYaw).toBe(0)
  })
  it('parado, volta sozinho para a frente', () => {
    const d = createDrag()
    d.yaw = 0.5
    for (let i = 0; i < 300; i++) stepDrag(d, 1 / 60)
    expect(Math.abs(d.yaw)).toBeLessThan(0.05)
  })
  it('segura a vida enquanto há mão e um instante depois de soltar', () => {
    const d = createDrag()
    expect(isHeld(d)).toBe(false)
    grab(d)
    expect(isHeld(d)).toBe(true)
    release(d, 200)
    expect(isHeld(d)).toBe(true)
    stepDrag(d, 1)
    expect(isHeld(d)).toBe(false)
  })
})
