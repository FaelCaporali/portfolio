import { describe, expect, it } from 'vitest'
import { fitFontSize } from './fit'

describe('fonte para uma linha', () => {
  it('usa o teto quando cabe e encolhe quando não cabe', () => {
    expect(fitFontSize(1000, 10, 80)).toBe(80)
    expect(fitFontSize(660, 10.35, 80)).toBe(63)
  })
  it('sem medida válida (elemento oculto), fica no teto', () => {
    expect(fitFontSize(0, 10, 80)).toBe(80)
    expect(fitFontSize(500, 0, 80)).toBe(80)
  })
})
