import { intro } from '../../content/journey-timeline'
import { useLang, useMessages } from '../../i18n/lang'
import type { Messages } from '../../i18n/messages/en'
import { eyebrow } from './parts'

/** Uma parte da trajetória: do primeiro ao último ano dos seus marcos (null: até hoje). */
export interface Part {
  id: 'prologue' | 'story'
  first: number
  last: number | null
}

/** "2009 – 2020", "2019 – today" ("2019 – hoje"). */
const partSpan = (m: Messages, part: Part) => `${String(part.first)} – ${part.last ?? m.journey.today}`

/**
 * Abertura (J75, opção B do estudo 17): título e lede numa coluna, e o mapa começa logo abaixo. Sem sumário próprio: o
 * minimapa já é a navegação (J52), e o sumário no corpo repetia o minimapa e deixava a tela meio vazia (J69). O título
 * fica um nível acima do rótulo grande do mapa, não dois; sem o nome, que o cabeçalho já mostra.
 */
export function Intro() {
  const lang = useLang()
  const { before, word, after } = useMessages().journey.title
  return (
    <section aria-labelledby="journey-title" className="relative pt-28 pb-8 sm:pt-36 sm:pb-10">
      <div aria-hidden className="intro-glow pointer-events-none absolute inset-x-0 top-0 -z-glow h-[34rem]" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:pr-20 xl:pr-60">
        <h1 id="journey-title" className="text-display leading-display font-semibold tracking-display text-fg">
          {before}
          <span className="journey-spectrum">{word}</span>
          {after || null}
        </h1>
        <p className="mt-7 max-w-[44ch] text-lg leading-relaxed text-fg/70 sm:text-xl">{intro.lede[lang]}</p>
      </div>
    </section>
  )
}

/** Cabeçalho de parte, dentro da linha do tempo, em nível de seção: o rótulo grande do mapa é o ano e a vida (J61). */
export function PartHead({ part }: { part: Part }) {
  const m = useMessages()
  return (
    <header className="relative pt-2 pb-10 pl-10 lg:pb-14 lg:pl-0">
      <p className={eyebrow}>{partSpan(m, part)}</p>
      <h2 id={`${part.id}-title`} className="mt-2 text-heading leading-tight font-semibold tracking-heading text-fg">
        {m.journey.parts[part.id]}
      </h2>
    </header>
  )
}
