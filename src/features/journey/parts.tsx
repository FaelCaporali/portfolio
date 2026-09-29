import { stages } from '../../content/journey'

/** Peças comuns à página. Tudo vira HTML estático no build (render.tsx). */

export const byId = new Map(stages.map((s) => [s.id, s]))

/** Rótulo pequeno em caixa alta (datas, partes, grupos de tags). */
export const eyebrow = 'text-xs font-medium tracking-[0.18em] text-white/60 uppercase'

/** "an AI Product Engineer", "a QA Analyst". */
export function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a'
}
