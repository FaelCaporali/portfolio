import { describe, expect, it } from 'vitest'
import { readHeroOptions } from './options'

const ids = ['vela', 'qa', 'ai']

describe('opções da URL', () => {
  it('sem parâmetros: começa na vida de abertura, carrossel normal', () => {
    expect(readHeroOptions('', ids, 'ai', false)).toEqual({ start: 2, frozenDissolve: null, reducedMotion: false })
  })
  it('?slot escolhe a vida; desconhecida volta para a abertura', () => {
    expect(readHeroOptions('?slot=vela', ids, 'ai', false).start).toBe(0)
    expect(readHeroOptions('?slot=nada', ids, 'ai', false).start).toBe(2)
  })
  it('?d congela a desintegração; valor inválido é ignorado', () => {
    expect(readHeroOptions('?d=0.7', ids, 'ai', true)).toMatchObject({ frozenDissolve: 0.7, reducedMotion: true })
    expect(readHeroOptions('?d=abc', ids, 'ai', false).frozenDissolve).toBeNull()
  })
})
