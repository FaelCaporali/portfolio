import { periodLabel, type Checkpoint as Data } from '../../content/journey-timeline'
import type { Stage } from '../../content/journey'
import { cx } from '../../lib/cx'
import { byId, eyebrow } from './parts'

const TAG_GROUPS = [
  { key: 'tools', label: 'Tools' },
  { key: 'concepts', label: 'Concepts' },
  { key: 'skills', label: 'Skills' },
] as const

/**
 * Um marco da linha do tempo, em duas camadas (J27): o que se lê de relance (data, título, papel, a frase, as
 * conquistas e as tags) e a história, que abre com um clique (`<details>`: funciona sem JavaScript).
 * `scope` é a vida em leitura (a última que começou até aqui): dá a cor ao marco e acende o ponto dela no cabeçalho.
 */
export function Checkpoint({ c, scope }: { c: Data; scope?: Stage }) {
  const life = c.life ? byId.get(c.life) : undefined
  const period = periodLabel(c)
  const prologue = c.part === 'prologue'
  return (
    <li
      id={life?.id ?? c.id}
      data-checkpoint
      data-scope={scope?.id}
      className={cx(
        scope && `life-${scope.id}`,
        'checkpoint relative scroll-mt-20 pb-14 pl-10 sm:pb-16 lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-12 lg:pl-0',
      )}
    >
      {/* O ponto no eixo: maior e com anel quando uma vida do herói começa aqui. */}
      <span
        aria-hidden
        className={cx(
          'dot absolute top-1.5 left-[0.3125rem] -translate-x-1/2 rounded-full border-2 border-(--accent) bg-[#0b0b0e] lg:left-[12.5rem]',
          life ? 'h-4 w-4' : 'h-3 w-3 opacity-80',
        )}
      />
      <div className="lg:pt-0.5 lg:text-right">
        {period && <p className="text-sm font-semibold text-white/85 tabular-nums lg:text-base">{period}</p>}
        {life && (
          <p className="ink mt-1 inline-flex items-center gap-1.5 text-xs font-medium lg:justify-end">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-(--accent)" />
            {life.slot}
          </p>
        )}
      </div>
      <article className="card mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7 lg:mt-0 lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-x-8">
        <div>
          <h3 className="text-2xl leading-tight font-semibold tracking-tight text-white sm:text-3xl">{c.title.en}</h3>
          {c.subtitle && <p className="ink mt-1.5 text-base font-medium sm:text-lg">{c.subtitle.en}</p>}
          <p className={cx('mt-4 leading-relaxed text-white/85', prologue ? 'text-base' : 'text-lg')}>
            {c.headline.en}
          </p>
          {c.highlights && <Highlights items={c.highlights.en} className="mt-5 hidden sm:block" />}
        </div>
        <Tags tags={c.tags} />
        <details className="group mt-6 border-t border-white/[0.08] pt-4 lg:col-span-2">
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 text-sm font-medium text-white/85 hover:text-white focus-visible:outline-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Read the story</span>
            <span className="hidden group-open:inline">Close the story</span>
            <span aria-hidden className="text-(--accent) transition-transform duration-300 group-open:rotate-45">
              +
            </span>
          </summary>
          {c.highlights && <Highlights items={c.highlights.en} className="mt-4 sm:hidden" />}
          <div className="mt-3 max-w-[68ch] space-y-4 text-[0.98rem] leading-relaxed text-white/80">
            {c.body.en.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </details>
        {c.link && (
          <a
            href={c.link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-6 items-center gap-1.5 justify-self-start text-sm font-medium text-white/85 underline decoration-(--accent) underline-offset-4 hover:text-white"
          >
            {c.link.label.en} <span aria-hidden>↗</span>
          </a>
        )}
      </article>
    </li>
  )
}

/**
 * As conquistas. No celular elas ficam dentro de "Read the story" para encurtar a página (J40); do `sm` para cima,
 * à vista. São duas cópias no HTML, uma escondida por `display: none`, que o leitor de tela também ignora.
 */
function Highlights({ items, className }: { items: string[]; className: string }) {
  return (
    <ul className={cx('space-y-2.5 text-[0.95rem] leading-relaxed text-white/75', className)}>
      {items.map((h) => (
        <li key={h} className="relative pl-5">
          <span aria-hidden className="absolute top-[0.6em] left-0 h-1.5 w-1.5 rounded-full bg-(--accent)" />
          {h}
        </li>
      ))}
    </ul>
  )
}

/** Tags separadas em ferramentas, conceitos e habilidades (J26). */
function Tags({ tags }: { tags: Data['tags'] }) {
  const groups = TAG_GROUPS.flatMap((g) => {
    const items = tags?.[g.key]
    return items?.length ? [{ ...g, items }] : []
  })
  if (!groups.length) return null
  return (
    <dl className="mt-6 grid gap-3 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-4 lg:mt-1 lg:grid-cols-1 lg:content-start lg:border-l lg:border-white/[0.08] lg:pl-6">
      {groups.map((g) => (
        <div key={g.key} className="contents">
          <dt className={cx(eyebrow, 'pt-1 text-[0.68rem]')}>{g.label}</dt>
          <dd className="-mt-1 sm:mt-0 lg:-mt-1">
            <ul aria-label={g.label} className="flex flex-wrap gap-1.5">
              {g.items.map((t) => (
                <li key={t} className={cx('tag rounded-full px-2.5 py-1 text-xs', `tag-${g.key}`)}>
                  {t}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  )
}
