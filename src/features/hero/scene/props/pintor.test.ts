import { afterEach, describe, expect, it, vi } from 'vitest'
import { criarPintor } from './pintor'

// O pintor lê o estado das fontes (jsdom não tem document.fonts).
Object.defineProperty(document, 'fonts', { value: { status: 'loaded' }, configurable: true })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('pintor do fundo', () => {
  it('pintura que falha não prende o pintor: o pedido seguinte pinta, e o depois dele também (#138)', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const p = criarPintor()
    p.pedir('a', function* () {
      yield
      throw new Error('falhou no desenho')
    })
    let seguinte = false
    p.pedir('b', function* () {
      seguinte = true
      yield
    })
    await p.pronta()
    expect(erro).toHaveBeenCalled()
    expect(seguinte).toBe(true)
    let depois = false
    p.pedir('c', function* () {
      depois = true
      yield
    })
    await p.pronta()
    expect(depois).toBe(true)
    expect(p.precisa('c')).toBe(false)
  })
})
