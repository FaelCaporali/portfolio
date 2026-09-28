import { chapters, lede, type Entry } from '../../content/journey-page'
import { stages, type Stage } from '../../content/journey'
import { directContacts, profile, resumes } from '../../content/profile'
import { cx } from '../../lib/cx'

/**
 * A página da trajetória inteira, renderizada para HTML estático no build (vite.config.ts, journeyPage). Sem estilo
 * inline: a CSP das páginas só aceita CSS do próprio site. A cor de cada vida vem da classe `life-<id>` (CSS gerado
 * de journey.ts) e a animação, de main.ts.
 */

const byId = new Map(stages.map((s) => [s.id, s]))

/** Cada entrada pertence à última vida que começou antes dela: é a cor do nó e a vida acesa nos pontos. */
let current: Stage | undefined
const scoped = chapters.map((c) => ({
  ...c,
  entries: c.entries.map((entry) => {
    if (entry.life) current = byId.get(entry.life)
    return { entry, scope: current }
  }),
}))

/** "Today I am a" / "Yesterday I was an", a mesma frase do herói. */
function lifeLead(stage: Stage): string {
  const article = /^[aeiou]/i.test(stage.slot) ? 'an' : 'a'
  return `${stage.past ? 'Yesterday I was' : 'Today I am'} ${article}`
}

/** A vida letra a letra (main.ts anima as letras ao entrar na tela); o leitor de tela recebe a frase inteira. */
function Slot({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <span className={cx('slot block font-semibold tracking-tight text-(--accent)', className)}>
      <span className="sr-only">{stage.slot}</span>
      <span aria-hidden>
        {stage.slot.split(' ').map((word, w) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- palavras fixas: a posição é a identidade
          <span key={`${w}-${word}`} className="whitespace-nowrap">
            {w > 0 && ' '}
            {Array.from(word).map((ch, k) => (
              // eslint-disable-next-line @eslint-react/no-array-index-key -- letras fixas, nunca reordenam
              <span key={`${k}-${ch}`} className="ch inline-block">
                {ch}
              </span>
            ))}
          </span>
        ))}
      </span>
    </span>
  )
}

function EntryItem({ entry, scope }: { entry: Entry; scope: Stage | undefined }) {
  const stage = entry.life ? byId.get(entry.life) : undefined
  return (
    <li
      id={stage?.id}
      data-scope={scope?.id}
      data-reveal
      className={cx(
        'relative scroll-mt-24 pb-12 last:pb-4',
        scope && `life-${scope.id}`,
        stage ? 'pt-2' : 'pt-0',
        entry.minor && 'pb-8',
      )}
    >
      {/* Nó no trilho: anel maior e brilhante nos marcos de vida, ponto discreto nas demais. */}
      <span
        aria-hidden
        className={cx(
          'node absolute top-1.5 -left-8 grid h-4 w-4 -translate-x-1/2 place-items-center sm:-left-12 lg:-left-16',
          stage && !entry.minor && 'top-3',
        )}
      >
        <span
          className={cx(
            'block rounded-full border-2 border-(--accent)',
            stage && !entry.minor
              ? 'h-4 w-4 bg-(--accent) shadow-[0_0_14px_var(--accent)]'
              : 'h-2.5 w-2.5 bg-[#0b0b0e] opacity-80',
          )}
        />
      </span>
      {stage && (
        <p className="mb-3">
          <span className="block text-sm text-white/55 sm:text-base">{lifeLead(stage)}</span>
          {/* Vida de passagem (o Uber): a mesma frase, sem destaque. */}
          <Slot
            stage={stage}
            className={cx(
              'mt-1 leading-tight',
              entry.minor ? 'text-xl sm:text-2xl' : 'text-3xl sm:text-4xl lg:text-5xl',
            )}
          />
        </p>
      )}
      {/* No largo, a data vai para a coluna à esquerda do trilho, alinhada com a organização: dá para correr o olho
          pelas datas. */}
      <div className="relative">
        {entry.when && (
          <p className="text-xs font-medium tracking-[0.14em] text-white/45 uppercase lg:absolute lg:top-1.5 lg:-left-[18rem] lg:w-[12.5rem] lg:text-right">
            {entry.when}
          </p>
        )}
        <h3 className={cx('mt-1 font-semibold text-white', entry.minor ? 'text-base' : 'text-lg sm:text-xl')}>
          {entry.title}
        </h3>
        {entry.role && <p className="text-sm text-(--accent) sm:text-base">{entry.role}</p>}
      </div>
      <p className={cx('mt-2 max-w-[62ch] leading-relaxed text-white/75', entry.minor && 'text-sm')}>{entry.summary}</p>
      {entry.carry && (
        <p className="mt-2 max-w-[62ch] text-sm text-white/55 italic">
          <span className="text-white/35 not-italic">What I carry: </span>
          {entry.carry}
        </p>
      )}
      {entry.details && (
        <details className="group mt-3 max-w-[70ch]">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/80 transition-colors hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden">
            What I did
            <span aria-hidden className="transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <ul className="mt-3 space-y-2 border-l border-white/10 pl-4 text-sm leading-relaxed text-white/70">
            {entry.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </details>
      )}
      {entry.stack && (
        <ul aria-label="Stack" className="mt-3 flex max-w-[70ch] flex-wrap gap-1.5">
          {entry.stack.map((t) => (
            <li key={t} className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-white/60">
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
          className="mt-3 inline-block text-sm text-white/80 underline decoration-white/30 underline-offset-4 hover:text-white"
        >
          {entry.link.label} <span aria-hidden>↗</span>
        </a>
      )}
    </li>
  )
}

/** Os pontos das vidas, como no herói: cada um leva à vida na página; main.ts acende o da vida em leitura. */
function LifeDots() {
  return (
    <nav aria-label="Lives" className="relative">
      <span aria-hidden className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-white/15" />
      <ol className="relative flex items-center gap-0.5 sm:gap-2">
        {stages.map((s) => (
          <li key={s.id} className={`life-${s.id}`}>
            <a
              href={`#${s.id}`}
              data-dot={s.id}
              aria-label={s.slot}
              title={s.slot}
              className="group grid h-6 w-6 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-white"
            >
              <span className="dot block h-2.5 w-2.5 rounded-full border-[1.5px] border-(--accent) bg-[#0b0b0e] opacity-55 transition-all duration-300 group-hover:scale-110 group-hover:opacity-100" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function JourneyPage() {
  const today = byId.get('ai')
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-white/5 bg-[#0b0b0e]/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-8">
          <a href="/" className="shrink-0 text-sm font-semibold text-white/85 hover:text-white">
            <span aria-hidden>←</span>
            {/* Abaixo de 400 px só a seta: os nove pontos precisam da largura. */}
            <span className="sr-only min-[400px]:not-sr-only min-[400px]:ml-1.5">{profile.name}</span>
          </a>
          <LifeDots />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-24 text-white sm:px-8">
        <div className="pt-14 pb-12 sm:pt-20 sm:pb-16">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">The full journey</h1>
          <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-white/70 sm:text-xl">{lede}</p>
        </div>
        <div className="timeline relative pl-8 sm:pl-12 lg:ml-56 lg:pl-16">
          {/* Trilho: a linha apagada é o caminho inteiro; a cheia cresce com a rolagem, na cor da vida em leitura. */}
          <span aria-hidden className="absolute top-0 bottom-0 left-0 w-px bg-white/10" />
          <span aria-hidden className="rail-fill absolute top-0 bottom-0 left-0 w-px origin-top bg-(--accent)" />
          {scoped.map((c) => (
            <section key={c.id} aria-labelledby={c.id} className="relative">
              <h2 id={c.id} data-reveal className="relative pt-4 pb-8">
                <span className="block text-xs font-medium tracking-[0.14em] text-white/40 uppercase lg:absolute lg:top-7 lg:-left-[18rem] lg:w-[12.5rem] lg:text-right">
                  {c.span}
                </span>
                <span className="mt-1 block text-2xl font-semibold tracking-tight sm:text-3xl">{c.title}</span>
              </h2>
              <ol>
                {c.entries.map(({ entry, scope }) => (
                  <EntryItem key={entry.title + (entry.when ?? '')} entry={entry} scope={scope} />
                ))}
              </ol>
            </section>
          ))}
        </div>
        {today && (
          <section
            aria-labelledby="today"
            data-reveal
            className={`life-${today.id} mt-8 border-t border-white/10 pt-14`}
          >
            <h2 id="today">
              <span className="block text-lg text-white/65 sm:text-2xl">{lifeLead(today)}</span>
              <Slot stage={today} className="mt-2 text-4xl leading-none sm:text-6xl" />
            </h2>
            <ul className="mt-8 flex flex-wrap gap-2">
              {directContacts.map((c) => (
                <li key={c.kind}>
                  <a
                    href={c.href}
                    className="inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-white/85"
                  >
                    {c.value}
                  </a>
                </li>
              ))}
              {resumes.map((r) => (
                <li key={r.href}>
                  <a
                    href={r.href}
                    download
                    className="inline-flex rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/85 hover:border-white/50"
                  >
                    CV · {r.label}
                  </a>
                </li>
              ))}
            </ul>
            <a href="/" className="mt-8 inline-block text-sm text-white/60 hover:text-white">
              <span aria-hidden>← </span>Back to the start
            </a>
          </section>
        )}
      </main>
    </>
  )
}
