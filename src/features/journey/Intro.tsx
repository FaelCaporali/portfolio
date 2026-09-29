import { checkpoints, intro } from '../../content/journey-timeline'
import { stages } from '../../content/journey'
import { directContacts, profile, resumes } from '../../content/profile'
import { article, byId, eyebrow } from './parts'

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
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12 lg:pr-20 xl:pr-60">
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
        <Glance />
      </div>
    </section>
  )
}

/** A jornada em três números, tirados do próprio conteúdo: a metade direita da abertura não fica vazia (J52). */
function Glance() {
  const first = checkpoints.find((c) => c.period?.start)?.period?.start?.slice(0, 4)
  const facts = [
    { n: String(stages.length), label: 'lives in the hero' },
    { n: String(checkpoints.length), label: 'stops on the map' },
    { n: first ?? '', label: 'where it starts' },
  ]
  return (
    <dl className="mt-12 grid grid-cols-3 gap-4 lg:mt-0 lg:grid-cols-1 lg:gap-6 lg:text-right">
      {facts.map((f) => (
        <div key={f.label}>
          <dt className={`${eyebrow} text-[0.62rem] lg:text-xs`}>{f.label}</dt>
          <dd className="journey-spectrum mt-1 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl lg:text-7xl">
            {f.n}
          </dd>
        </div>
      ))}
    </dl>
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

/** Fechamento: a vida de hoje, o contato e os currículos. */
export function Closing() {
  const today = byId.get('ai')
  if (!today) return null
  return (
    <section
      id="today"
      data-scope={today.id}
      aria-labelledby="today-title"
      className={`life-${today.id} relative scroll-mt-14 border-t border-white/[0.06] pt-24 pb-32 sm:pt-32 lg:pb-32`}
    >
      <div aria-hidden className="intro-glow pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:pr-20 xl:pr-60">
        <h2 id="today-title">
          <span className="block text-xl text-white/70 sm:text-3xl">Today I am {article(today.slot)}</span>
          <span className="mt-2 block text-[clamp(2.75rem,8vw,6rem)] leading-[0.95] font-semibold tracking-[-0.04em] text-(--accent)">
            {today.slot}
          </span>
        </h2>
        <ul className="mt-10 flex flex-wrap gap-3">
          {directContacts.map((c) => (
            <li key={c.kind}>
              <a
                href={c.href}
                className="inline-flex min-h-12 flex-col justify-center rounded-2xl bg-white px-5 py-2 text-neutral-950 transition-colors hover:bg-(--accent)"
              >
                <span className="text-xs font-medium text-neutral-600">{c.label}</span>
                <span className="text-sm font-semibold sm:text-base">{c.value}</span>
              </a>
            </li>
          ))}
        </ul>
        <ul className="mt-3 flex flex-wrap gap-2">
          {resumes.map((r) => (
            <li key={r.href}>
              <a
                href={r.href}
                download
                className="inline-flex min-h-10 items-center rounded-full border border-white/20 px-5 text-sm text-white/85 transition-colors hover:border-(--accent) hover:text-white"
              >
                CV · {r.label}
              </a>
            </li>
          ))}
        </ul>
        <a href="/" className="mt-10 inline-flex min-h-6 items-center text-sm text-white/65 hover:text-white">
          <span aria-hidden>←&nbsp;</span>Back to the start
        </a>
      </div>
    </section>
  )
}
