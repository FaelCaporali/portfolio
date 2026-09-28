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

/**
 * Uma classe por vida, mais o espectro das nove cores em ordem (o "journey" da abertura). O texto só fica
 * transparente junto com o gradiente: sem esta folha, a palavra continua branca.
 */
export function lifeAccentsCss(): string {
  const colors = stages.map((s) => s.accent).join(',')
  const spectrum = `.journey-spectrum{background-image:linear-gradient(90deg,${colors});-webkit-background-clip:text;background-clip:text;color:transparent}`
  return [...stages.map((s) => `.life-${s.id}{--accent:${s.accent}}`), spectrum].join('\n')
}
