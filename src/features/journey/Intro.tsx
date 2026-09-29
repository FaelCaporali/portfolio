import { intro } from '../../content/journey-timeline'
import { profile } from '../../content/profile'
import { eyebrow } from './parts'

export interface Part {
  id: string
  title: string
  span: string
}

/**
 * Abertura: à esquerda o título e o lede (J22); à direita, o sumário das duas partes (J24), como o sumário de um livro,
 * com fios em vez de botões (J63: as pílulas pareciam chamadas para ação). No celular, um embaixo do outro.
 */
export function Intro({ parts }: { parts: Part[] }) {
  return (
    <section aria-labelledby="journey-title" className="relative pt-28 pb-14 sm:pt-36 sm:pb-20">
      <div aria-hidden className="intro-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem]" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:grid lg:grid-cols-12 lg:items-end lg:gap-x-8 lg:pr-20 xl:pr-60">
        <div className="lg:col-span-7">
          <p className={eyebrow}>{profile.name}</p>
          <h1
            id="journey-title"
            className="mt-5 text-[clamp(3.25rem,9vw,7rem)] leading-[0.9] font-semibold tracking-[-0.05em] text-white"
          >
            The full <span className="journey-spectrum">journey</span>
          </h1>
          <p className="mt-7 max-w-[36ch] text-lg leading-relaxed text-white/70 sm:text-xl">{intro.lede.en}</p>
        </div>
        <nav aria-label="Parts" className="mt-12 lg:col-span-5 lg:mt-0 lg:pb-2">
          <ol className="border-t border-white/10">
            {parts.map((p) => (
              <li key={p.id} className="border-b border-white/10">
                <a
                  href={`#${p.id}`}
                  className="group flex min-h-16 items-baseline gap-4 py-4 focus-visible:outline-2 focus-visible:outline-white"
                >
                  <span className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{p.title}</span>
                  <span className="ml-auto text-sm text-white/55 tabular-nums">{p.span}</span>
                  <span
                    aria-hidden
                    className="text-white/40 transition-transform duration-300 group-hover:translate-y-1 group-hover:text-white"
                  >
                    ↓
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
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
