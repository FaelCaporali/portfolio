import { Fragment } from 'react'
import { cx } from '../../lib/cx'

/**
 * A vida, letra a letra para a animação de troca (index.css: .slot-word). Quebra só entre palavras, para caber na
 * coluna de texto; a classe ch-<n> dá a posição da letra na frase inteira (--i, que escalona a entrada e a saída) e
 * life-<id> dá a cor da vida: classes, não estilo inline, porque a página sai pronta do build e a CSP não aceita
 * atributo style (as classes são do CSS gerado, src/features/journey/accents.ts).
 * O leitor de tela recebe a frase inteira; as letras soltas são só visuais.
 * `medida`: a amostra parada e escondida que a cena 3D mede (HeroCopy, #138): sem animação, sem leitor de tela.
 */
export function SlotWord({
  text,
  life,
  leaving,
  medida = false,
}: {
  text: string
  life: string
  leaving: boolean
  medida?: boolean
}) {
  const words = text.split(' ')
  const starts = words.map((_, w) => Array.from(words.slice(0, w).join('')).length)
  return (
    <span
      key={text}
      className={cx('slot-word', `life-${life}`, leaving && 'is-leaving', medida && '[&_.ch]:animate-none!')}
      aria-live={medida ? undefined : 'polite'}
    >
      {!medida && <span className="sr-only">{text}</span>}
      <span aria-hidden>
        {words.map((word, w) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- palavras fixas: a posição é a identidade
          <Fragment key={`${w}-${word}`}>
            {w > 0 && ' '}
            <span className="whitespace-nowrap">
              {Array.from(word).map((ch, k) => (
                // eslint-disable-next-line @eslint-react/no-array-index-key -- letras fixas da palavra, nunca reordenam
                <span key={`${k}-${ch}`} className={`ch ch-${String((starts[w] ?? 0) + k)}`}>
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
