import { describe, expect, it } from 'vitest'
import { advance, candidates, createLineup, loadOrder, peek, skipFailed } from './lineup'

// 9 vidas em ordem cronológica (stages): 0 financeiro … 8 ai. O carrossel anda de trás para frente (D-U2b).
const volta = (from: number) => {
  let l = createLineup(9, from)
  const vistas = [l.current]
  for (let i = 0; i < 9; i++) {
    l = advance(l, 9, null)
    vistas.push(l.current)
  }
  return vistas
}

describe('ordem do carrossel: de trás para frente, em laço (D-U2b)', () => {
  it('abre na vida de abertura (ai) e segue ai → techlead → devops → qa → fullstack → uber → vela → empreendedor → financeiro → ai', () => {
    expect(volta(8)).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 0, 8])
  })
  it('?slot abre em outra vida e a volta segue dela, passando do começo para o fim da lista', () => {
    expect(volta(2)).toEqual([2, 1, 0, 8, 7, 6, 5, 4, 3, 2])
  })
  it('a escolha no indicador leva à vida escolhida e a volta segue dela', () => {
    let l = createLineup(9, 8)
    l = advance(l, 9, 3)
    expect(l.current).toBe(3)
    expect(peek(l, null)).toBe(2)
    l = advance(l, 9, null)
    expect(l.current).toBe(2)
  })
})

describe('ordem de carga das vidas', () => {
  it('abre na vida inicial e segue a ordem do carrossel, com todas as vidas', () => {
    const l = createLineup(9, 4)
    const order = loadOrder(l, null)
    expect(order).toEqual([4, 3, 2, 1, 0, 8, 7, 6, 5])
  })
  it('a vida escolhida no indicador passa para a frente, sem repetir', () => {
    const order = loadOrder(createLineup(9, 4), 6)
    expect(order.slice(0, 2)).toEqual([6, 4])
    expect(order).toHaveLength(9)
    expect(new Set(order).size).toBe(9)
  })
  it('depois de uma troca, a atual e as que faltam na volta', () => {
    const l = advance(createLineup(9, 4), 9, null)
    expect(loadOrder(l, null)).toEqual([l.current, ...l.queue])
  })
  it('a próxima vida é sempre conhecida: a escolhida ou a seguinte da volta', () => {
    let l = createLineup(3, 0)
    expect(peek(l, 2)).toBe(2)
    for (let i = 0; i < 10; i++) {
      const next = peek(l, null)
      expect(l.queue.length).toBeGreaterThan(0)
      l = advance(l, 3, null)
      expect(l.current).toBe(next)
    }
  })
})

describe('vidas com falha (#138)', () => {
  it('uma vida com falha não para o carrossel: é pulada, nunca é a próxima, e a ordem segue', () => {
    const failed = new Set([3])
    let l = createLineup(9, 8)
    const vistas: number[] = []
    for (let i = 0; i < 16; i++) {
      const c = candidates(l, null, failed)
      expect(c.length).toBeGreaterThan(0)
      expect(c).not.toContain(3)
      expect(c).not.toContain(l.current)
      l = advance(l, 9, null, failed)
      vistas.push(l.current)
    }
    expect(vistas.slice(0, 8)).toEqual([7, 6, 5, 4, 2, 1, 0, 8])
  })
  it('só restam vidas com falha na volta: a volta sai da atual sem elas', () => {
    const failed = new Set([3, 5])
    const l = skipFailed({ queue: [3, 5], current: 1 }, 9, failed)
    expect(l.queue).toEqual([0, 8, 7, 6, 4, 2])
    expect(candidates(l, null, failed)).toHaveLength(6)
  })
  it('o glb que chega depois devolve a vida à volta', () => {
    let l = createLineup(9, 8)
    for (let i = 0; i < 20; i++) l = advance(l, 9, null, new Set([3]))
    const vistas = new Set<number>()
    for (let i = 0; i < 9; i++) {
      l = advance(l, 9, null)
      vistas.add(l.current)
    }
    expect(vistas.has(3)).toBe(true)
  })
  it('na virada da volta, a próxima nunca é a vida atual', () => {
    let l = createLineup(3, 0)
    for (let i = 0; i < 12; i++) {
      const antes = l.current
      l = advance(l, 3, null)
      expect(l.current).not.toBe(antes)
      expect(candidates(l, null)).not.toContain(l.current)
    }
  })
})
