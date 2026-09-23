import { describe, expect, it } from 'vitest'
import { readHeroOptions } from './options'

const ids = ['ai', 'qa', 'vela']

describe('opções da URL', () => {
  it('sem parâmetros: começa na primeira vida, carrossel normal', () => {
    expect(readHeroOptions('', ids, false)).toEqual({ start: 0, frozenDissolve: null, reducedMotion: false })
  })
  it('?slot escolhe a vida; desconhecida volta para a primeira', () => {
    expect(readHeroOptions('?slot=vela', ids, false).start).toBe(2)
    expect(readHeroOptions('?slot=nada', ids, false).start).toBe(0)
  })
  it('?d congela a desintegração; valor inválido é ignorado', () => {
    expect(readHeroOptions('?d=0.7', ids, true)).toMatchObject({ frozenDissolve: 0.7, reducedMotion: true })
    expect(readHeroOptions('?d=abc', ids, false).frozenDissolve).toBeNull()
  })
})
