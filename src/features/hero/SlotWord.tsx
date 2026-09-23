import { Fragment, type CSSProperties } from 'react'
import { cx } from '../../lib/cx'

/**
 * A vida, letra a letra para a animação de troca (index.css: .slot-word). Quebra só entre palavras, para caber na
 * coluna de texto; --i é a posição da letra na frase inteira e escalona a entrada e a saída.
 * O leitor de tela recebe a frase inteira; as letras soltas são só visuais.
 */
export function SlotWord({ text, color, leaving }: { text: string; color: string; leaving: boolean }) {
  const words = text.split(' ')
  const starts = words.map((_, w) => Array.from(words.slice(0, w).join('')).length)
  return (
    <span key={text} className={cx('slot-word', leaving && 'is-leaving')} style={{ color }} aria-live="polite">
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, w) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- palavras fixas: a posição é a identidade
          <Fragment key={`${w}-${word}`}>
            {w > 0 && ' '}
            <span className="whitespace-nowrap">
              {Array.from(word).map((ch, k) => (
                // eslint-disable-next-line @eslint-react/no-array-index-key -- letras fixas da palavra, nunca reordenam
                <span key={`${k}-${ch}`} className="ch" style={{ '--i': (starts[w] ?? 0) + k } as CSSProperties}>
                  {ch}
                </span>
              ))}
            </span>
          </Fragment>
        ))}
      </span>
    </span>
  )
}
