import { describe, expect, it } from 'vitest'
import { proximaNosBastidores } from './bastidores'
import { advance, candidates, createLineup } from './lineup'

const todas = (total: number) => new Set(Array.from({ length: total }, (_, i) => i))

describe('quem se prepara nos bastidores (D-138d)', () => {
  it('no primeiro acesso, a inicial e a seguinte do carrossel: duas, não todas', () => {
    const l = createLineup(9, 4, Math.random)
    const proxima = proximaNosBastidores(candidates(l, null), todas(9), null)
    expect(proxima).toBe(l.queue[0])
    expect(new Set([l.current, proxima]).size).toBe(2)
  })
  it('a seguinte que falhou ou ainda baixa é pulada: prepara a candidata seguinte já baixada', () => {
    expect(proximaNosBastidores([2, 5, 7], new Set([5, 7]), null)).toBe(5)
  })
  it('nenhuma candidata baixada (ou nenhuma candidata): nada a preparar, a atual fica', () => {
    expect(proximaNosBastidores([2, 5], new Set([0]), null)).toBeUndefined()
    expect(proximaNosBastidores([], todas(9), null)).toBeUndefined()
  })
  it('a reservada segue enquanto for candidata: a que chega depois não desfaz o preparo em curso', () => {
    expect(proximaNosBastidores([2, 5, 7], new Set([2, 5, 7]), 5)).toBe(5)
  })
  it('a escolha no indicador troca a próxima; a escolhida ainda baixando espera, sem preparar outra', () => {
    expect(proximaNosBastidores([7], todas(9), 5)).toBe(7)
    expect(proximaNosBastidores([7], new Set([5]), 5)).toBeUndefined()
  })
  it('a cada troca entra só uma: a próxima preparada é a vida que o carrossel mostra, nunca a atual nem uma que falhou', () => {
    const failed = new Set([3])
    const baixadas = new Set([...todas(9)].filter((i) => !failed.has(i)))
    let l = createLineup(9, 0, Math.random)
    let reservada: number | null = null
    for (let i = 0; i < 40; i++) {
      const c = candidates(l, null, failed)
      const proxima: number | undefined = proximaNosBastidores(c, baixadas, reservada)
      expect(proxima).toBeDefined()
      expect(proxima).not.toBe(l.current)
      expect(proxima).not.toBe(3)
      reservada = proxima ?? null
      // O relógio troca para a 1ª candidata pronta: preparadas são só a atual e a próxima, então é a próxima.
      const antes = l.current
      l = advance(l, 9, c.find((v) => v === proxima) ?? null, Math.random, failed)
      expect(l.current).toBe(proxima)
      expect(l.current).not.toBe(antes)
    }
  })
})
