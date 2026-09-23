import { Fragment, type CSSProperties } from 'react'
import { cx } from '../../lib/cx'

/**
 * A vida, letra a letra para a animação de troca (index.css: .slot-word). Quebra só entre palavras, para caber na
 * coluna de texto; --i é a posição da letra na frase inteira e escalona a entrada e a saída.
 */
export function SlotWord({ text, color, leaving }: { text: string; color: string; leaving: boolean }) {
  const words = text.split(' ')
  const starts = words.map((_, w) => [...words.slice(0, w).join('')].length)
  return (
    <span key={text} className={cx('slot-word', leaving && 'is-leaving')} style={{ color }} aria-live="polite">
      {words.map((word, w) => (
        <Fragment key={`${w}-${word}`}>
          {w > 0 && ' '}
          <span className="whitespace-nowrap">
            {[...word].map((ch, k) => (
              <span key={`${k}-${ch}`} className="ch" style={{ '--i': (starts[w] ?? 0) + k } as CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </span>
  )
}
