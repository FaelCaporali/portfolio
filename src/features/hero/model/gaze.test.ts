import { describe, expect, it } from 'vitest'
import { createDrag, grab } from './drag'
import { createGaze, stepGaze, toPointer } from './gaze'

describe('olhar', () => {
  it('o centro do ponteiro é o busto: no largo, à direita do meio da tela', () => {
    const wide = toPointer(720, 450, 1440, 900)
    expect(wide.x).toBeCloseTo(-0.4)
    expect(wide.y).toBeCloseTo(0)
    expect(toPointer(180, 0, 360, 740)).toEqual({ x: 0, y: 1 })
    expect(toPointer(1440, 900, 1440, 900).x).toBeCloseTo(0.6)
    // Celular deitado: layout largo, centro também à direita.
    expect(toPointer(560, 180, 800, 360).x).toBeCloseTo(0)
  })
  it('sem arrasto a cabeça acompanha o ponteiro; com arrasto, só os olhos', () => {
    const free = createGaze()
    for (let i = 0; i < 120; i++) stepGaze(free, { x: 1, y: 0 }, createDrag(), 1 / 60)
    expect(free.headRight).toBeGreaterThan(0.1)

    const held = createGaze()
    const d = createDrag()
    grab(d)
    for (let i = 0; i < 120; i++) stepGaze(held, { x: 1, y: 0 }, d, 1 / 60)
    expect(held.headRight).toBe(0)
    expect(held.eyeRight).toBeGreaterThan(0.4)
  })
  it('o olho para no canto da órbita', () => {
    const g = createGaze()
    const d = createDrag()
    d.yaw = -0.6
    stepGaze(g, { x: 1, y: 0 }, d, 1 / 60)
    expect(g.eyeRight).toBeCloseTo(0.45)
  })
})
