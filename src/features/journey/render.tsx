import { renderToStaticMarkup } from 'react-dom/server'
import { stages } from '../../content/journey'
import { JourneyPage } from './JourneyPage'

/**
 * Chamadas do build (vite.config.ts, journeyPage), nunca do navegador: o HTML da página e o CSS das cores das vidas
 * (a CSP não aceita estilo inline, então a cor de cada vida vira uma classe).
 */
export function renderJourney(): string {
  return renderToStaticMarkup(<JourneyPage />)
}

export function lifeAccentsCss(): string {
  return stages.map((s) => `.life-${s.id}{--accent:${s.accent}}`).join('\n')
}
