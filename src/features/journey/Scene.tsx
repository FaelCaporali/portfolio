import type { Entry } from '../../content/journey-page'
import type { Stage } from '../../content/journey'
import { cx } from '../../lib/cx'
import { EntryExtras, Slot, eyebrow, lifeLead } from './parts'

/**
 * Marco de uma vida: seção de largura total. De um lado a imagem do adereço sobre o brilho da vida; do outro a frase
 * do herói, a vida em letra grande e a entrada. main.ts dá o foco com a rolagem (a cena fica nítida quando cruza o
 * meio da tela) e o parallax da imagem; sem JavaScript ou com movimento reduzido, a cena fica inteira e parada.
 * Antes da tecnologia a cena é mais curta (J19).
 */
export function Scene({ entry, stage, flip }: { entry: Entry; stage: Stage; flip: boolean }) {
  const tech = stage.track === 'tech'
  return (
    <article
      id={stage.id}
      data-scope={stage.id}
      aria-labelledby={`${stage.id}-title`}
      className={cx(
        `life-${stage.id} scene relative isolate flex scroll-mt-14 items-center overflow-hidden`,
        tech ? 'min-h-svh py-16 sm:py-28' : 'min-h-[75svh] py-14 sm:py-20',
      )}
    >
      <div aria-hidden className="scene-ambient pointer-events-none absolute inset-0 -z-10" />
      <div
        data-focus
        className="mx-auto grid w-full max-w-7xl items-center gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16"
      >
        <figure
          className={cx(
            'relative mx-auto w-full',
            tech ? 'max-w-64 sm:max-w-sm lg:max-w-xl' : 'max-w-52 sm:max-w-72 lg:max-w-md',
            flip && 'lg:order-2',
          )}
        >
          <div data-parallax className="relative aspect-square">
            <div aria-hidden className="scene-glow absolute inset-[8%] rounded-full" />
            <div aria-hidden className="absolute inset-[4%] rounded-full border border-(--accent)/25" />
            <div aria-hidden className="absolute inset-[18%] rounded-full border border-dashed border-white/10" />
            <img
              src={`/journey/${stage.id}.webp`}
              alt={`3D bust of Fael Caporali as ${/^[aeiou]/i.test(stage.slot) ? 'an' : 'a'} ${stage.slot}`}
              width={900}
              height={1100}
              loading="lazy"
              decoding="async"
              className="relative h-full w-full object-contain mix-blend-lighten"
            />
          </div>
        </figure>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span aria-hidden className="h-2 w-2 rounded-full bg-(--accent) shadow-[0_0_10px_var(--accent)]" />
            {entry.when && <span className={eyebrow}>{entry.when}</span>}
          </p>
          <p className="mt-5">
            <span className="block text-lg text-white/65 sm:text-2xl">{lifeLead(stage)}</span>
            <Slot
              stage={stage}
              className={cx(
                'mt-1 leading-[0.95] tracking-[-0.03em]',
                tech ? 'text-[clamp(2.6rem,7vw,6.5rem)]' : 'text-[clamp(2.3rem,5.6vw,5rem)]',
              )}
            />
          </p>
          <div className="mt-8 max-w-2xl rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-7">
            <h3 id={`${stage.id}-title`} className="text-lg font-semibold text-white sm:text-xl">
              {entry.title}
            </h3>
            {entry.role && <p className="ink mt-1 text-sm font-medium sm:text-base">{entry.role}</p>}
            <p className="mt-3 leading-relaxed text-white/80 sm:text-lg">{entry.summary}</p>
            {entry.carry && (
              <p className="mt-5 border-l-2 border-(--accent) pl-4">
                <span className={cx(eyebrow, 'block')}>What I carry</span>
                <span className="mt-1 block text-lg font-medium text-white sm:text-xl">{entry.carry}</span>
              </p>
            )}
            <EntryExtras entry={entry} />
          </div>
        </div>
      </div>
    </article>
  )
}
