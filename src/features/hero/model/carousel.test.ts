import { describe, expect, it } from 'vitest'
import { DISSOLVE_MAX, TIMING, createClock, tick, type CarouselClock, type Tick, type TickInput } from './carousel'

const normal: TickInput = { first: false, reducedMotion: false, held: false, jump: false }

/** Avança o relógio em passos de 50 ms e devolve os quadros em que algo mudou. */
function run(c: CarouselClock, seconds: number, input: TickInput = normal) {
  const events: Tick[] = []
  for (let t = 0; t < seconds - 1e-9; t += 0.05) {
    const r = tick(c, 0.05, input)
    if (r.next || r.phase) events.push(r)
  }
  return events
}

describe('carrossel', () => {
  it('segura, desintegra, troca a vida no auge e reconstrói', () => {
    const c = createClock()
    expect(run(c, TIMING.hold - 0.05)).toEqual([])
    expect(run(c, 0.1)).toEqual([{ dissolve: 0, next: false, phase: 'out' }])
    expect(run(c, TIMING.out)).toEqual([{ dissolve: DISSOLVE_MAX, next: true, phase: 'in' }])
    expect(run(c, TIMING.in)).toEqual([{ dissolve: 0, next: false, phase: 'hold' }])
  })
  it('a primeira vida fica mais tempo', () => {
    const c = createClock()
    expect(run(c, TIMING.holdFirst - 0.1, { ...normal, first: true })).toEqual([])
    expect(run(c, 0.15, { ...normal, first: true })).toHaveLength(1)
  })
  it('não troca enquanto alguém segura o busto', () => {
    const c = createClock()
    expect(run(c, 10, { ...normal, held: true })).toEqual([])
    expect(c.time).toBe(0)
  })
  it('vida escolhida no indicador: sai do repouso no próximo quadro, mesmo com o busto seguro', () => {
    const c = createClock()
    expect(tick(c, 0.016, { ...normal, held: true, jump: true })).toEqual({ dissolve: 0, next: false, phase: 'out' })
  })
  it('movimento reduzido troca direto, sem furacão', () => {
    const c = createClock()
    const events = run(c, TIMING.hold + 0.05, { ...normal, reducedMotion: true })
    expect(events).toEqual([{ dissolve: 0, next: true, phase: null }])
    expect(c.phase).toBe('hold')
  })
  it('um quadro longo (aba em segundo plano) não pula a animação', () => {
    const c: CarouselClock = { phase: 'out', time: 0 }
    const r = tick(c, 5, normal)
    expect(r.next).toBe(false)
    expect(c.time).toBeCloseTo(0.1)
  })
})
