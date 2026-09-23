import { useRef, type Ref } from 'react'
import { stages, type Stage } from '../../content/journey'
import { journeyLink, profile, profileLinks } from '../../content/profile'
import { pill } from '../../ui/pill'
import { CopyContacts } from '../contact/CopyContacts'
import { useFitFontSize } from './hooks/useFitFontSize'
import { WIDE_QUERY } from './model/layout'
import { ResumeMenu } from './ResumeMenu'
import { SlotWord } from './SlotWord'

interface HeroCopyProps {
  ref: Ref<HTMLDivElement>
  stage: Stage
  /** A vida está saindo (furacão): as letras saem girando. */
  leaving: boolean
}

const SLOTS = stages.map((s) => s.slot)

/** Coluna de texto do herói: a vida atual, os títulos, os links e o contato direto. */
export function HeroCopy({ ref, stage, leaving }: HeroCopyProps) {
  const slotRef = useRef<HTMLSpanElement>(null)
  // Largo (lg): a vida mais longa sempre numa linha, com a fonte do visitante. Abaixo, reserva de duas linhas.
  const slotSize = useFitFontSize(slotRef, SLOTS, WIDE_QUERY)
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-6 text-white sm:px-10 wide:inset-y-0 wide:right-auto wide:flex wide:w-[56%] wide:flex-col wide:justify-center wide:pr-6 wide:pb-0 wide:pl-[7vw] wide:short:pt-20 wide:short:pb-3"
    >
      <h1>
        <span className="block text-lg text-white/65 lg:text-2xl">
          {stage.past ? 'Yesterday I was' : 'Today I am'} a{/^[aeiou]/i.test(stage.slot) ? 'n' : ''}
        </span>{' '}
        {/* Altura reservada para a troca não empurrar o resto: duas linhas no celular (a vida mais longa quebra),
            uma a partir de sm. No largo, useFitFontSize escolhe a maior fonte (até 4,4vw) em que todas cabem numa
            linha, sem vão embaixo das vidas curtas. */}
        <span
          ref={slotRef}
          style={slotSize ? { fontSize: slotSize } : undefined}
          className="mt-2 block min-h-[2em] text-[2.75rem] leading-none font-semibold tracking-tight min-[360px]:text-[3rem] sm:min-h-[1em] lg:text-[clamp(2.75rem,4.4vw,5.5rem)]"
        >
          <SlotWord text={stage.slot} color={stage.accent} leaving={leaving} />
        </span>
      </h1>
      {/* Celular: um título por linha. A partir de sm: numa linha só, separados por um ponto apagado. */}
      <ul
        aria-label="Títulos"
        className="mt-4 flex flex-col gap-0.5 text-sm leading-snug font-medium text-white/75 sm:mt-5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-y-1 sm:text-[15px] lg:mt-6 lg:text-lg short:mt-2"
      >
        {profile.titles.map((t, i) => (
          <li key={t} className="flex items-baseline">
            {i > 0 && (
              <span aria-hidden className="mx-2 hidden text-white/25 sm:inline lg:mx-3">
                •
              </span>
            )}
            {t}
          </li>
        ))}
      </ul>
      <nav
        aria-label="Links"
        className="pointer-events-auto mt-6 flex flex-col items-start gap-3 sm:mt-7 lg:mt-8 lg:gap-4 short:mt-3 short:gap-2"
      >
        <a
          href={journeyLink.href}
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white short:py-2"
        >
          {journeyLink.label} <span aria-hidden>→</span>
        </a>
        {/* Três pílulas: cabem numa linha desde 320 px. */}
        <ul className="flex flex-wrap gap-1.5 sm:gap-2">
          <li>
            <ResumeMenu className={pill} />
          </li>
          {profileLinks.map((l) => (
            <li key={l.label}>
              <a href={l.href} target="_blank" rel="noopener noreferrer" className={pill}>
                {l.label}{' '}
                <span aria-hidden className="hidden text-white/45 xl:inline">
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {/* Contato direto sempre à vista; clique copia (o formulário e os links ficam no botão flutuante). */}
      <CopyContacts className="pointer-events-auto mt-5 lg:mt-6 short:mt-2" />
    </div>
  )
}
