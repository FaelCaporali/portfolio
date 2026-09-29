import { intro } from '../../content/journey-timeline'
import { profile } from '../../content/profile'
import { eyebrow } from './parts'

export interface Part {
  id: string
  title: string
  span: string
}

/** Abertura: o título, o lede aprovado (J22) e o índice das duas partes (J24: prólogo e a história). */
export function Intro({ parts }: { parts: Part[] }) {
  return (
    <section aria-labelledby="journey-title" className="relative pt-28 pb-16 sm:pt-36 sm:pb-24">
      <div aria-hidden className="intro-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem]" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:pr-20 xl:pr-60">
        <div>
          <p className={eyebrow}>{profile.name}</p>
          <h1
            id="journey-title"
            className="mt-5 text-[clamp(3rem,10vw,6.5rem)] leading-[0.92] font-semibold tracking-[-0.045em] text-white"
          >
            The full <span className="journey-spectrum">journey</span>
          </h1>
          <p className="mt-7 max-w-[40ch] text-lg leading-relaxed text-white/80 sm:text-2xl">{intro.lede.en}</p>
          <nav aria-label="Parts" className="mt-10">
            <ol className="flex flex-wrap gap-2 sm:gap-3">
              {parts.map((p) => (
                <li key={p.id}>
                  <a
                    href={`#${p.id}`}
                    className="flex min-h-12 flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 transition-colors hover:border-white/30 hover:bg-white/[0.06]"
                  >
                    <span className="text-sm font-semibold text-white sm:text-base">{p.title}</span>
                    <span className="text-xs text-white/60 sm:text-sm">{p.span}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>
    </section>
  )
}

/** Cabeçalho de parte, dentro da linha do tempo. */
export function PartHead({ part }: { part: Part }) {
  return (
    <header className="relative pt-6 pb-12 pl-10 lg:pb-16 lg:pl-0">
      <p className={eyebrow}>{part.span}</p>
      <h2
        id={`${part.id}-title`}
        className="mt-2 text-[clamp(2.5rem,7vw,5.5rem)] leading-none font-semibold tracking-[-0.045em] text-white"
      >
        {part.title}
      </h2>
    </header>
  )
}
