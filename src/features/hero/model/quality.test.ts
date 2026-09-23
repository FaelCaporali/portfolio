import { describe, expect, it } from 'vitest'
import { TOP_QUALITY, lowerQuality, qualityAt, raiseQuality } from './quality'

describe('qualidade adaptativa', () => {
  it('começa no topo e desce um nível por queda de FPS, sem passar do mais baixo', () => {
    expect(qualityAt(TOP_QUALITY)).toEqual({ maxDpr: 2, particles: 1 })
    expect(lowerQuality(lowerQuality(lowerQuality(TOP_QUALITY)))).toBe(0)
    expect(qualityAt(0)).toEqual({ maxDpr: 1, particles: 0.35 })
  })
  it('sobe quando sobra FPS, sem passar do topo', () => {
    expect(raiseQuality(TOP_QUALITY)).toBe(TOP_QUALITY)
    expect(raiseQuality(0)).toBe(1)
  })
  it('cada nível abaixo é mais leve nos dois eixos', () => {
    for (let l = 1; l <= TOP_QUALITY; l++) {
      expect(qualityAt(l - 1).maxDpr).toBeLessThan(qualityAt(l).maxDpr)
      expect(qualityAt(l - 1).particles).toBeLessThan(qualityAt(l).particles)
    }
  })
})
