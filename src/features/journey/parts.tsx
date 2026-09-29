import { stages } from '../../content/journey'

/** Peças comuns à página. Tudo sai no HTML do build (react-router.config.ts, prerender). */

export const byId = new Map(stages.map((s) => [s.id, s]))

/** Rótulo pequeno em caixa alta (datas, partes, grupos de tags). */
export const eyebrow = 'text-xs font-medium tracking-[0.18em] text-white/60 uppercase'
