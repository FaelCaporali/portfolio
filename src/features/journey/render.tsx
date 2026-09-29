import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { stages } from '../../content/journey'
import { JourneyPage } from './JourneyPage'

/**
 * Chamadas do build (vite.config.ts, journeyPage), nunca do navegador: o HTML da página, que o navegador hidrata
 * (main.tsx, a mesma árvore), e o CSS das cores das vidas (a CSP não aceita estilo inline, então a cor de cada vida
 * vira uma classe).
 */
export function renderJourney(): string {
  return renderToString(
    <StrictMode>
      <JourneyPage />
    </StrictMode>,
  )
}

/**
 * Uma classe por vida, mais o espectro das nove cores em ordem (o "journey" da abertura e o anel do "Contact me"). O
 * texto só fica transparente junto com o gradiente: sem esta folha, a palavra continua branca. Vai também para o herói
 * (src/main.tsx), por causa do botão.
 */
export function lifeAccentsCss(): string {
  const colors = stages.map((s) => s.accent).join(',')
  // O espectro também como variável: o anel do "Contact me" (index.css) gira nele, fechando o círculo na primeira cor.
  const root = `:root{--spectrum:${colors};--spectrum-loop:${colors},${stages[0]?.accent ?? '#fff'}}`
  const spectrum = `.journey-spectrum{background-image:linear-gradient(90deg,${colors});-webkit-background-clip:text;background-clip:text;color:transparent}`
  return [root, ...stages.map((s) => `.life-${s.id}{--accent:${s.accent}}`), spectrum].join('\n')
}
