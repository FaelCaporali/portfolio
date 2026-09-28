import { chapters, lede } from '../../content/journey-page'
import { directContacts, profile, resumes } from '../../content/profile'
import { cx } from '../../lib/cx'
import { Slot, byId, eyebrow, lifeLead } from './parts'

const pad = (n: number) => String(n).padStart(2, '0')

/** O busto do herói em retrato (900×1100, feito à parte). */
function Bust({ className, eager }: { className?: string; eager?: boolean }) {
  return (
    <img
      src="/journey/bust.webp"
      alt="3D portrait bust of Fael Caporali"
      width={900}
      height={1100}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      decoding="async"
      className={cx('mix-blend-lighten', className)}
    />
  )
}

/**
 * Abertura, uma tela: o título grande, o lede, o busto sobre um brilho que passeia pelas cores das vidas (main.ts) e
 * o índice dos capítulos. No celular o busto fica atrás do texto, apagado.
 */
export function Opening() {
  return (
    <section
      aria-labelledby="journey-title"
      className="opening relative isolate flex min-h-svh items-center overflow-hidden pt-20 pb-24"
    >
      <div aria-hidden className="opening-glow pointer-events-none absolute -z-10" />
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div data-opening-copy className="relative z-10">
          <p className={eyebrow}>{profile.name}</p>
          <h1
            id="journey-title"
            className="mt-5 text-[clamp(3.4rem,11vw,8rem)] leading-[0.9] font-semibold tracking-[-0.045em] text-white"
          >
            The full <span className="journey-spectrum">journey</span>
          </h1>
          <p className="mt-7 max-w-[34ch] text-lg leading-relaxed text-white/80 sm:text-2xl">{lede}</p>
          <nav aria-label="Chapters" className="mt-10">
            <ol className="grid grid-cols-3 gap-2 sm:gap-3">
              {chapters.map((c, i) => (
                <li key={c.id}>
                  <a
                    href={`#${c.id}`}
                    className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition-colors hover:border-white/30 hover:bg-white/[0.06] sm:px-4 sm:py-3"
                  >
                    <span className="text-xs font-medium text-white/60 tabular-nums">{pad(i + 1)}</span>
                    <span className="mt-0.5 text-sm leading-tight font-semibold text-white sm:text-base">
                      {c.title}
                    </span>
                    <span className="mt-0.5 text-xs text-white/60 sm:text-sm">{c.span}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
        <div
          data-opening-bust
          className="absolute inset-x-0 bottom-0 -z-10 flex justify-end opacity-30 lg:static lg:z-auto lg:justify-center lg:opacity-100"
        >
          <Bust eager className="h-[62svh] w-auto max-w-none lg:h-auto lg:max-h-[80svh] lg:w-full lg:object-contain" />
        </div>
      </div>
      <a
        href={`#${chapters[0]?.id ?? ''}`}
        className="scroll-cue absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs font-medium tracking-[0.2em] text-white/60 uppercase hover:text-white sm:flex"
      >
        Scroll
        <span aria-hidden className="relative block h-10 w-px overflow-hidden bg-white/15">
          <span className="scroll-cue-bead absolute inset-x-0 top-0 h-3 bg-white" />
        </span>
      </a>
    </section>
  )
}

/** Divisória de capítulo: largura total, título enorme e o período; main.ts dá o parallax. */
export function ChapterHead({ id, title, span, index }: { id: string; title: string; span: string; index: number }) {
  return (
    <header className="chapter-head relative flex min-h-[42svh] items-center overflow-hidden border-t border-white/[0.06] py-16 sm:min-h-[60svh] sm:py-20">
      <span
        aria-hidden
        data-chapter-num
        className="chapter-num pointer-events-none absolute top-[12%] right-[-1vw] text-[clamp(8rem,24vw,20rem)] leading-[0.8] font-semibold tracking-tighter"
      >
        {pad(index + 1)}
      </span>
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <p className={eyebrow}>
          Chapter {pad(index + 1)} <span aria-hidden>·</span> {span}
        </p>
        <h2
          id={`${id}-title`}
          data-chapter-title
          className="mt-4 text-[clamp(3rem,11vw,10rem)] leading-[0.9] font-semibold tracking-[-0.045em] text-white"
        >
          {title}
        </h2>
      </div>
    </header>
  )
}

/** Fechamento, uma tela: a vida de hoje em letra gigante, o busto e o contato. */
export function Closing() {
  const today = byId.get('ai')
  if (!today) return null
  return (
    <section
      id="today"
      data-scope={today.id}
      aria-labelledby="today-title"
      className={`life-${today.id} closing relative isolate flex min-h-svh scroll-mt-14 items-center overflow-hidden border-t border-white/[0.06] py-24`}
    >
      <div aria-hidden className="scene-ambient pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="relative z-10">
          <h2 id="today-title">
            <span className="block text-xl text-white/70 sm:text-3xl">{lifeLead(today)}</span>
            <Slot stage={today} className="mt-2 text-[clamp(3rem,9vw,8rem)] leading-[0.92] tracking-[-0.04em]" />
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
        <div className="relative mx-auto w-full max-w-md">
          <div aria-hidden className="scene-glow absolute inset-[10%] rounded-full" />
          <Bust className="relative h-auto w-full" />
        </div>
      </div>
    </section>
  )
}
