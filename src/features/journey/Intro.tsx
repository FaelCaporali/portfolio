import { intro } from '../../content/journey-timeline'
import { eyebrow } from './parts'

export interface Part {
  id: string
  title: string
  span: string
}

/**
 * Abertura (J75, opção B do estudo 17): título e lede numa coluna, e o mapa começa logo abaixo. Sem sumário próprio: o
 * minimapa já é a navegação (J52), e o sumário no corpo repetia o minimapa e deixava a tela meio vazia (J69). O título
 * fica um nível acima do rótulo grande do mapa, não dois; sem o nome, que o cabeçalho já mostra.
 */
export function Intro() {
  return (
    <section aria-labelledby="journey-title" className="relative pt-28 pb-8 sm:pt-36 sm:pb-10">
      <div aria-hidden className="intro-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem]" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:pr-20 xl:pr-60">
        <h1
          id="journey-title"
          className="text-[clamp(2.75rem,6.2vw,5.5rem)] leading-[0.92] font-semibold tracking-[-0.05em] text-white"
        >
          The full <span className="journey-spectrum">journey</span>
        </h1>
        <p className="mt-7 max-w-[44ch] text-lg leading-relaxed text-white/70 sm:text-xl">{intro.lede.en}</p>
      </div>
    </section>
  )
}

/** Cabeçalho de parte, dentro da linha do tempo, em nível de seção: o rótulo grande do mapa é o ano e a vida (J61). */
export function PartHead({ part }: { part: Part }) {
  return (
    <header className="relative pt-2 pb-10 pl-10 lg:pb-14 lg:pl-0">
      <p className={eyebrow}>{part.span}</p>
      <h2
        id={`${part.id}-title`}
        className="mt-2 text-[clamp(1.75rem,3.2vw,2.5rem)] leading-tight font-semibold tracking-[-0.02em] text-white"
      >
        {part.title}
      </h2>
    </header>
  )
}
