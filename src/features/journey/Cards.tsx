import type { Entry } from '../../content/journey-page'
import type { Stage } from '../../content/journey'
import { cx } from '../../lib/cx'
import { EntryExtras, Slot, byId, eyebrow, lifeLead } from './parts'

export interface Scoped {
  entry: Entry
  /** Vida em curso quando a entrada acontece: dá a cor do cartão e o ponto aceso no cabeçalho. */
  scope: Stage | undefined
}

/**
 * Os "causos" entre as cenas (entradas sem vida, e o Uber, de passagem): cartões compactos sobre um trilho, cada um
 * com o nó na cor da vida em curso. main.ts deixa a entrada mais perto do meio da tela inteira e apaga as outras.
 */
export function Cards({ items }: { items: Scoped[] }) {
  return (
    <div className="relative mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <span
        aria-hidden
        className="absolute top-0 bottom-0 left-[1.6rem] w-px bg-linear-to-b from-transparent via-white/15 to-transparent sm:left-[2.35rem]"
      />
      <ol className="space-y-6 sm:space-y-8">
        {items.map(({ entry, scope }) => (
          <Card key={entry.title + (entry.when ?? '')} entry={entry} scope={scope} />
        ))}
      </ol>
    </div>
  )
}

function Card({ entry, scope }: Scoped) {
  const stage = entry.life ? byId.get(entry.life) : undefined
  return (
    <li
      id={stage?.id}
      data-scope={scope?.id}
      className={cx('relative scroll-mt-24 pl-8 sm:pl-12', scope && `life-${scope.id}`)}
    >
      <span
        aria-hidden
        className="absolute top-7 left-[0.1rem] grid h-4 w-4 -translate-x-1/2 place-items-center sm:left-[0.1rem]"
      >
        <span className="block h-3 w-3 rounded-full border-2 border-(--accent) bg-[#0b0b0e] shadow-[0_0_12px_var(--accent)]" />
      </span>
      <article data-focus className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        {stage && (
          <p className="mb-3 text-sm text-white/65">
            {lifeLead(stage)} <Slot stage={stage} className="inline! text-base sm:text-lg" />
          </p>
        )}
        {entry.when && <p className={cx(eyebrow, 'mb-2')}>{entry.when}</p>}
        <h3 className="text-lg font-semibold text-white sm:text-xl">{entry.title}</h3>
        {entry.role && <p className="ink mt-0.5 text-sm font-medium">{entry.role}</p>}
        <p className="mt-2.5 leading-relaxed text-white/75">{entry.summary}</p>
        {entry.carry && (
          <p className="mt-3 text-sm text-white/70">
            <span className="text-white/60">What I carry: </span>
            <span className="text-white">{entry.carry}</span>
          </p>
        )}
        <EntryExtras entry={entry} />
      </article>
    </li>
  )
}
