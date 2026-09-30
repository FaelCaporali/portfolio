import { stages } from '../../content/journey'

/**
 * As cores das vidas como CSS, para o build e o servidor de dev (vite.config.ts, virtual:journey-accents.css): a CSP
 * não aceita estilo inline, então a cor de cada vida vira uma classe. Uma classe por vida, mais o espectro das nove
 * cores em ordem (o "journey" da abertura e o anel do "Contact me"), e a posição das letras da vida no herói. O texto
 * só fica transparente junto com o gradiente: sem esta folha, a palavra continua branca. Entra em todas as páginas
 * (src/root.tsx): o herói também usa as cores (indicador das vidas, a vida em destaque, o anel do botão).
 */
export function lifeAccentsCss(): string {
  const colors = stages.map((s) => s.accent).join(',')
  // O espectro também como variável: o anel do "Contact me" (index.css) gira nele, fechando o círculo na primeira cor.
  const root = `:root{--spectrum:${colors};--spectrum-loop:${colors},${stages[0]?.accent ?? 'var(--color-fg)'}}`
  const spectrum = `.journey-spectrum{background-image:linear-gradient(90deg,${colors});-webkit-background-clip:text;background-clip:text;color:transparent}`
  // A posição de cada letra da vida no herói (SlotWord: ch-<n> dá --i, que escalona a animação).
  const letters = Math.max(...stages.map((s) => s.slot.replaceAll(' ', '').length))
  const positions = Array.from({ length: letters }, (_, i) => `.ch-${String(i)}{--i:${String(i)}}`)
  return [root, ...stages.map((s) => `.life-${s.id}{--accent:${s.accent}}`), spectrum, ...positions].join('\n')
}
