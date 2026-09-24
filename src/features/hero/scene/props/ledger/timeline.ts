/**
 * Roteiro do adereço, em segundos desde a montagem (a montagem acontece no auge do furacão; a vida fica ~1 s
 * reconstruindo + 2,5 s parada, TIMING em model/carousel.ts). A macro é digitada, roda e preenche as células; o total
 * vira a linha de tendência, que sobe até a bandeira; a meta atingida paga em moedas. Termina em ~2,6 s: sobra ~0,9 s
 * de estado final antes do próximo furacão.
 */
import { CELL_COUNT, MACRO } from './sheet'

export const T = {
  typeStart: 0.55,
  perChar: 0.026,
  fillStart: 0.97,
  perCell: 0.032,
  lineStart: 1.63,
  lineDur: 0.42,
  coinStart: 2.08,
  coinStagger: 0.065,
  coinFall: 0.22,
} as const

/** Instante em que a linha toca a bandeira. */
export const HIT = T.lineStart + T.lineDur
export const COINS = 5
/** Fim do roteiro (a última moeda assentada). */
export const END = T.coinStart + (COINS - 1) * T.coinStagger + T.coinFall

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (x: number) => x * x * (3 - 2 * x)

export const typedAt = (t: number) => Math.min(MACRO.length, Math.max(0, Math.floor((t - T.typeStart) / T.perChar)))
export const filledAt = (t: number) => Math.min(CELL_COUNT, Math.max(0, Math.floor((t - T.fillStart) / T.perCell) + 1))
/** Célula ativa: a última preenchida (antes de começar, A1). */
export const activeAt = (t: number) => Math.max(0, filledAt(t) - 1)
/** Progresso da linha (0..1), com arranque e chegada suaves. */
export const lineAt = (t: number) => smooth(clamp01((t - T.lineStart) / T.lineDur))

/** Altura acima do lugar e giro residual da moeda i: queda com um quique curto. null = ainda não apareceu. */
export function coinAt(t: number, i: number): { lift: number; tilt: number } | null {
  const k = (t - (T.coinStart + i * T.coinStagger)) / T.coinFall
  if (k < 0) return null
  if (k >= 1) return { lift: 0, tilt: 0 }
  // 0..0,7: cai (acelera); 0,7..1: quique pequeno que amortece.
  if (k < 0.7) {
    const f = 1 - k / 0.7
    return { lift: 0.034 * f * f, tilt: 0.5 * f }
  }
  const b = Math.sin(((k - 0.7) / 0.3) * Math.PI)
  return { lift: 0.0025 * b, tilt: 0.06 * b }
}

/** Brilho da bandeira: pulso no toque que assenta num resto discreto (meta atingida). */
export function glowAt(t: number) {
  if (t < HIT) return 0
  const k = t - HIT
  return 0.05 + 0.9 * Math.exp(-k * 5)
}
