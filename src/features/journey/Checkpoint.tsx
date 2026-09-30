import { memo, useMemo } from 'react'
import { periodLabel, type Checkpoint as Data } from '../../content/journey-timeline'
import { cx } from '../../lib/cx'
import type { Lane, Placed } from './layout'
import { useReading, type Reading } from './reading'
import { eyebrow } from './parts'

const TAG_GROUPS = [
  { key: 'tools', label: 'Tools' },
  { key: 'concepts', label: 'Concepts' },
  { key: 'skills', label: 'Skills' },
] as const

/* Classes inteiras por faixa (o Tailwind só gera o que lê no código). No celular, tudo numa coluna só. */
const CARD: Record<Lane, string> = {
  left: 'lg:col-start-1 lg:col-end-7 lg:row-start-1',
  right: 'lg:col-start-7 lg:col-end-13 lg:row-start-1',
  wide: 'lg:col-start-2 lg:col-end-12',
}
/* O nome da vida ocupa a metade que o cartão deixa vazia; no marco largo, vem na linha de cima, centrado como o ano. */
const LANDMARK: Record<Lane, string> = {
  left: 'lg:col-start-7 lg:col-end-13 lg:row-start-1 lg:self-center lg:pl-6',
  right: 'lg:col-start-1 lg:col-end-7 lg:row-start-1 lg:self-center lg:pr-6 lg:text-right',
  wide: 'lg:col-start-2 lg:col-end-12 lg:row-start-1 lg:text-center',
}
/*
 * O ponto por onde passa o caminho (useJourneyMotion lê [data-node]). No celular ondula na margem esquerda; no
 * desktop fica na borda de cima do cartão, perto do canto de fora, para o caminho cruzar a tela de um lado ao outro.
 */
const NODE: Record<Lane, string> = {
  left: '-left-[1.875rem] top-9 lg:top-0 lg:left-12',
  right: '-left-[1.125rem] top-9 lg:top-0 lg:right-12 lg:left-auto lg:translate-x-1/2',
  wide: '-left-[1.875rem] top-9 lg:top-0 lg:left-1/2',
}
/*
 * O mesmo tamanho e peso para os dois rótulos grandes do mapa, o nome da vida e o ano (J61: "mesmo estilo"). O tamanho
 * sai da palavra mais longa, "Entrepreneur" (≈7em neste peso): ela tem de caber inteira na coluna, sem quebrar no meio
 * (J70). No celular a coluna é a tela menos 5rem de margens; do lg para cima, meia grade (416px em 1024, 464px no
 * máximo), daí o teto de 3.875rem.
 */
const BIG =
  'text-[min(2.75rem,calc((100vw_-_5rem)/7.4))] lg:text-[min(5.6vw,3.875rem)] leading-[0.95] font-semibold tracking-[-0.045em]'

/**
 * Um marco do mapa, em duas camadas (J27): o que se lê de relance (data, título, papel, a frase, as conquistas e as
 * tags) e a história, que abre com um clique (`<details>`: funciona sem JavaScript). Quando uma vida do herói começa
 * aqui, o nome dela vem grande ao lado, na cor dela (J52: a tela ocupada); quando o ano muda, o ano vem antes, no
 * caminho (J61).
 */
interface Props {
  item: Placed
  /** Fora do filtro: a parada some da página e do caminho. */
  hidden: boolean
  /** A primeira parada à vista do ano: o ano grande vem antes dela. */
  yearFirst: boolean
  /** As tags do marco escolhidas no filtro, uma por linha: acendem no cartão. */
  matched: string
  /**
   * O que está em leitura: se é este o marco (o ponto enche e o cartão acende a borda) e a entrada dele na rolagem (só
   * com movimento liberado: esperando ou já entrou). Lido aqui, para a troca de marco redesenhar só os dois marcos.
   */
  reading: Reading
}

export const Checkpoint = memo(function Checkpoint({ item, hidden, yearFirst, matched, reading }: Props) {
  const { c, scope, life, lane, year } = item
  const id = life?.id ?? c.id
  const current = useReading(reading, (s) => s.mark === id)
  const reveal = useReading(reading, (s) => s.reveal.get(id))
  return (
    <li
      id={id}
      hidden={hidden}
      data-checkpoint
      data-scope={scope?.id}
      className={cx(
        scope && `life-${scope.id}`,
        yearFirst && 'year-first',
        'checkpoint relative scroll-mt-20 pb-12 pl-10 sm:pb-14 lg:pl-0',
        current && 'is-current',
        reveal !== undefined && 'reveal',
        reveal && 'is-in',
      )}
    >
      {year && <YearMark year={year} />}
      <div className={cx('lg:grid lg:grid-cols-12 lg:gap-x-8', lane === 'wide' && life && 'lg:gap-y-6')}>
        {life && <Landmark life={life} lane={lane} />}
        <Card item={item} matched={matched} />
      </div>
    </li>
  )
})

/**
 * O cartão do marco. À parte, com memo: o filtro e a leitura mudam o <li> (à vista, em leitura, entrada), e o cartão
 * só redesenha quando mudam as tags dele que o filtro escolheu (142).
 */
const Card = memo(function Card({ item, matched }: { item: Placed; matched: string }) {
  const { c, scope, life, lane } = item
  const period = periodLabel(c)
  const wide = lane === 'wide'
  const chosen = useMemo(() => new Set(matched ? matched.split('\n') : []), [matched])
  return (
    <article
      className={cx(
        'card relative rounded-3xl border border-white/[0.08] p-5 sm:p-7',
        CARD[lane],
        wide && 'lg:p-10',
        wide && life && 'lg:row-start-2',
      )}
    >
      <span
        aria-hidden
        data-node={scope?.id ?? ''}
        className={cx(
          'dot absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-(--accent) bg-[#0b0b0e]',
          NODE[lane],
        )}
      />
      <div>
        {period && <p className="ink text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{period}</p>}
        <h3
          className={cx(
            'mt-2 leading-tight font-semibold tracking-tight text-white',
            wide ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-xl sm:text-2xl',
          )}
        >
          {c.title.en}
        </h3>
        {c.subtitle && <p className="ink mt-1.5 text-base font-medium sm:text-lg">{c.subtitle.en}</p>}
        <p className={cx('mt-4 leading-relaxed text-white/85', wide ? 'text-lg lg:text-xl' : 'text-base sm:text-lg')}>
          {c.headline.en}
        </p>
        {c.highlights && <Highlights items={c.highlights.en} className="mt-5 hidden sm:block" />}
      </div>
      <Tags tags={c.tags} wide={wide} chosen={chosen} />
      <details className="group mt-6 border-t border-white/[0.08] pt-4">
        <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 text-sm font-medium text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden">
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
  )
})

/** A vida do herói que começa neste marco: o nome grande, na cor dela, sem numeração (J66). */
function Landmark({ life, lane }: { life: NonNullable<Placed['life']>; lane: Lane }) {
  return (
    <div className={cx('landmark relative mb-5 lg:mb-0', LANDMARK[lane])}>
      <p className={cx(BIG, 'text-(--accent)')}>{life.slot}</p>
    </div>
  )
}

/**
 * O ano, em contorno, no caminho entre a parada anterior e esta: o tempo marcado no mapa como um marco de estrada.
 * Só aparece na primeira parada do ano (`.year-first`, journey.css), para não repetir.
 */
function YearMark({ year }: { year: string }) {
  return (
    <p aria-hidden className={cx('year-mark pb-6 tabular-nums lg:pb-10 lg:text-center', BIG)}>
      {year}
    </p>
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

/**
 * Tags separadas em ferramentas, conceitos e habilidades (J26), num peso abaixo do texto: são o índice do que o marco
 * usou, não a história. No marco largo, três colunas lado a lado; nos outros, um grupo embaixo do outro.
 */
function Tags({ tags, wide, chosen }: { tags: Data['tags']; wide: boolean; chosen: ReadonlySet<string> }) {
  const groups = TAG_GROUPS.flatMap((g) => {
    const items = tags?.[g.key]
    return items?.length ? [{ ...g, items }] : []
  })
  if (!groups.length) return null
  return (
    <dl
      className={cx(
        'mt-6 grid gap-3 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-x-4',
        wide && 'lg:mt-8 lg:grid-flow-col lg:grid-cols-3 lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:gap-y-2',
      )}
    >
      {groups.map((g) => (
        <div key={g.key} className="contents">
          <dt className={cx(eyebrow, 'pt-1 text-[0.62rem] text-white/45')}>{g.label}</dt>
          <dd className={cx('-mt-1 sm:mt-0', wide && 'lg:-mt-1')}>
            <ul aria-label={g.label} className="flex flex-wrap gap-1.5">
              {g.items.map((t) => (
                <li
                  key={t}
                  className={cx(
                    'tag rounded-full px-2.5 py-0.5 text-[0.72rem]',
                    `tag-${g.key}`,
                    chosen.has(t) && 'is-match',
                  )}
                >
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
