/** Relógio do carrossel: segura a vida, desintegra (troca a vida no auge do furacão) e reconstrói. Sem React. */
import { smooth } from '../../../lib/math'

/**
 * Tempos (s). Parado 2,5 s (a primeira vida, que quem chega lê primeiro, 3 s) e transição de 1 s para cada lado
 * (decisão do Fael, 23/09: antes eram 3,4–4,5 s parado e 1,5 s cada lado).
 */
export const TIMING = { holdFirst: 3, hold: 2.5, out: 1, in: 1 } as const
/** Quadro longo (aba em segundo plano) não pula a animação. */
const MAX_DT = 0.1

/** Desintegração de 0 (inteiro) a DISSOLVE_MAX (só furacão); o shader usa a mesma escala. */
export const DISSOLVE_MAX = 1.35

export type Phase = 'hold' | 'out' | 'in'

export interface CarouselClock {
  phase: Phase
  time: number
}

export const createClock = (): CarouselClock => ({ phase: 'hold', time: 0 })

export interface TickInput {
  /** A vida atual é a primeira do carrossel. */
  first: boolean
  /** Sem furacão: troca direto ao fim do tempo de leitura. */
  reducedMotion: boolean
  /** Alguém está girando o busto: a vida não troca. */
  held: boolean
}

export interface Tick {
  /** Desintegração a aplicar neste quadro. */
  dissolve: number
  /** Passar para a próxima vida neste quadro. */
  next: boolean
  /** Fase nova, quando mudou neste quadro. */
  phase: Phase | null
}

/** Avança o relógio (mutável, vive num ref) e diz o que o quadro aplica. */
export function tick(c: CarouselClock, dt: number, input: TickInput): Tick {
  if (c.phase === 'hold' && input.held) return { dissolve: 0, next: false, phase: null }
  c.time += Math.min(dt, MAX_DT)

  if (c.phase === 'hold') {
    if (c.time < (input.first ? TIMING.holdFirst : TIMING.hold)) return { dissolve: 0, next: false, phase: null }
    c.time = 0
    if (input.reducedMotion) return { dissolve: 0, next: true, phase: null }
    c.phase = 'out'
    return { dissolve: 0, next: false, phase: 'out' }
  }

  if (c.phase === 'out') {
    const dissolve = DISSOLVE_MAX * smooth(Math.min(c.time / TIMING.out, 1))
    if (c.time < TIMING.out) return { dissolve, next: false, phase: null }
    c.time = 0
    c.phase = 'in'
    return { dissolve, next: true, phase: 'in' }
  }

  const dissolve = DISSOLVE_MAX * (1 - smooth(Math.min(c.time / TIMING.in, 1)))
  if (c.time < TIMING.in) return { dissolve, next: false, phase: null }
  c.time = 0
  c.phase = 'hold'
  return { dissolve, next: false, phase: 'hold' }
}
