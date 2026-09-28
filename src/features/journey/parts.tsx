import { Fragment } from 'react'
import type { Entry } from '../../content/journey-page'
import { stages, type Stage } from '../../content/journey'
import { cx } from '../../lib/cx'

/** Peças comuns às cenas, aos cartões e ao fechamento. Tudo vira HTML estático no build (render.tsx). */

export const byId = new Map(stages.map((s) => [s.id, s]))

/** "Today I am a" / "Yesterday I was an", a mesma frase do herói. */
export function lifeLead(stage: Stage): string {
  const article = /^[aeiou]/i.test(stage.slot) ? 'an' : 'a'
  return `${stage.past ? 'Yesterday I was' : 'Today I am'} ${article}`
}

/** A vida letra a letra (main.ts assenta as letras com a rolagem); o leitor de tela recebe a palavra inteira. */
export function Slot({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <span className={cx('slot block font-semibold tracking-tight text-(--accent)', className)}>
      <span className="sr-only">{stage.slot}</span>
      <span aria-hidden>
        {stage.slot.split(' ').map((word, w) => (
          // Espaço fora da palavra: a vida quebra entre palavras quando não cabe, nunca no meio de uma.
          // eslint-disable-next-line @eslint-react/no-array-index-key -- palavras fixas: a posição é a identidade
          <Fragment key={`${w}-${word}`}>
            {w > 0 && ' '}
            <span className="whitespace-nowrap">
              {Array.from(word).map((ch, k) => (
                // eslint-disable-next-line @eslint-react/no-array-index-key -- letras fixas, nunca reordenam
                <span key={`${k}-${ch}`} className="ch inline-block">
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

/** Rótulo pequeno em caixa alta (datas, "What I carry", numeração). */
export const eyebrow = 'text-xs font-medium tracking-[0.18em] text-white/60 uppercase'

/** "What I did" (abre com um clique, J11), a stack e o link da entrada. */
export function EntryExtras({ entry }: { entry: Entry }) {
  return (
    <>
      {entry.details && (
        <details className="group mt-5">
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-1.5 text-sm font-medium text-white/85 transition-colors hover:border-(--accent) hover:text-white focus-visible:outline-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden">
            What I did
            <span aria-hidden className="text-(--accent) transition-transform duration-300 group-open:rotate-45">
              +
            </span>
          </summary>
          <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-white/75 sm:text-[0.95rem]">
            {entry.details.map((d) => (
              <li key={d} className="relative pl-5">
                <span aria-hidden className="absolute top-[0.6em] left-0 h-1.5 w-1.5 rounded-full bg-(--accent)" />
                {d}
              </li>
            ))}
          </ul>
        </details>
      )}
      {entry.stack && (
        <ul aria-label="Stack" className="mt-5 flex flex-wrap gap-1.5">
          {entry.stack.map((t) => (
            <li
              key={t}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/70"
            >
              {t}
            </li>
          ))}
        </ul>
      )}
      {entry.link && (
        <a
          href={entry.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex min-h-6 items-center gap-1.5 text-sm font-medium text-white/85 underline decoration-(--accent) underline-offset-4 hover:text-white"
        >
          {entry.link.label} <span aria-hidden>↗</span>
        </a>
      )}
    </>
  )
}
