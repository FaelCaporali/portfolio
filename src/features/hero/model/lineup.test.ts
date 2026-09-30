import { describe, expect, it } from 'vitest'
import { advance, candidates, createLineup, loadOrder, peek, skipFailed } from './lineup'

// Aleatório fixo: o embaralhamento vira determinístico.
const fixed = () => 0

describe('ordem de carga das vidas', () => {
  it('abre na vida inicial e segue a ordem do carrossel, com todas as vidas', () => {
    const l = createLineup(9, 4, fixed)
    const order = loadOrder(l, null)
    expect(order[0]).toBe(4)
    expect(order.slice(1)).toEqual(l.queue)
    expect(new Set(order).size).toBe(9)
  })
  it('a vida escolhida no indicador passa para a frente, sem repetir', () => {
    const l = createLineup(9, 4, fixed)
    const chosen = l.queue[5] ?? 0
    const order = loadOrder(l, chosen)
    expect(order.slice(0, 2)).toEqual([chosen, 4])
    expect(order).toHaveLength(9)
  })
  it('depois de uma troca, a atual e as que faltam na volta', () => {
    const l = advance(createLineup(9, 4, fixed), 9, null, fixed)
    expect(loadOrder(l, null)).toEqual([l.current, ...l.queue])
  })
  it('a próxima vida é sempre conhecida: a escolhida, a seguinte da volta e, no fim da volta, a da volta nova', () => {
    let l = createLineup(3, 0, Math.random)
    expect(peek(l, 2)).toBe(2)
    for (let i = 0; i < 10; i++) {
      const next = peek(l, null)
      expect(l.queue.length).toBeGreaterThan(0)
      l = advance(l, 3, null, Math.random)
      expect(l.current).toBe(next)
    }
  })
  it('uma vida com falha não para o carrossel: sai da volta, nunca é a próxima, e a volta segue (#138)', () => {
    const failed = new Set([3])
    let l = createLineup(9, 0, Math.random)
    const vistas = new Set<number>()
    for (let i = 0; i < 40; i++) {
      const c = candidates(l, null, failed)
      expect(c.length).toBeGreaterThan(0)
      expect(c).not.toContain(3)
      expect(c).not.toContain(l.current)
      const antes = l.current
      l = advance(l, 9, c[0] ?? null, Math.random, failed)
      expect(l.current).not.toBe(antes)
      vistas.add(l.current)
    }
    expect(vistas.has(3)).toBe(false)
    expect(vistas.size).toBe(8)
  })
  it('só restam vidas com falha na volta: sorteia a seguinte sem elas, sem repetir a atual (#138)', () => {
    const failed = new Set([3, 5])
    const l = skipFailed({ queue: [3, 5], current: 1 }, 9, failed, Math.random)
    expect(l.queue).toHaveLength(7)
    expect(l.queue).not.toContain(3)
    expect(l.queue[0]).not.toBe(1)
    expect(candidates(l, null, failed)).toHaveLength(6)
  })
  it('o glb que chega depois devolve a vida ao sorteio (#138)', () => {
    let l = createLineup(9, 0, Math.random)
    for (let i = 0; i < 20; i++) l = advance(l, 9, null, Math.random, new Set([3]))
    const vistas = new Set<number>()
    for (let i = 0; i < 30; i++) {
      l = advance(l, 9, null, Math.random)
      vistas.add(l.current)
    }
    expect(vistas.has(3)).toBe(true)
  })
  it('na virada da volta, a próxima nunca é a vida atual (#138)', () => {
    let l = createLineup(3, 0, Math.random)
    for (let i = 0; i < 60; i++) {
      const antes = l.current
      l = advance(l, 3, null, Math.random)
      expect(l.current).not.toBe(antes)
      expect(candidates(l, null)).not.toContain(l.current)
    }
  })
})
