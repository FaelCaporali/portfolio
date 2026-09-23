import type { Ref } from 'react'
import type { Stage } from '../../content/journey'
import { journeyLink, profile, profileLinks } from '../../content/profile'
import { pill } from '../../ui/pill'
import { CopyContacts } from '../contact/CopyContacts'
import { ResumeMenu } from './ResumeMenu'
import { SlotWord } from './SlotWord'

interface HeroCopyProps {
  ref: Ref<HTMLDivElement>
  stage: Stage
  /** A vida está saindo (furacão): as letras saem girando. */
  leaving: boolean
}

/** Coluna de texto do herói: a vida atual, os títulos, os links e o contato direto. */
export function HeroCopy({ ref, stage, leaving }: HeroCopyProps) {
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-6 text-white sm:px-10 lg:inset-y-0 lg:right-auto lg:flex lg:w-1/2 lg:flex-col lg:justify-center lg:pb-0 lg:pl-[7vw]"
    >
      <h1>
        <span className="block text-xs tracking-[0.3em] text-white/60 uppercase lg:text-sm">
          {stage.past ? 'Yesterday I was' : 'Today I am'} a{/^[aeiou]/i.test(stage.slot) ? 'n' : ''}
        </span>{' '}
        {/* Duas linhas reservadas onde a vida mais longa quebra (celular e coluna do largo):
            a troca não empurra o resto. */}
        <span className="mt-2 block min-h-[2em] text-[2.6rem] leading-none font-semibold tracking-tight sm:min-h-[1em] lg:min-h-[2em] lg:text-[clamp(3rem,4.6vw,5rem)]">
          <SlotWord text={stage.slot} color={stage.accent} leaving={leaving} />
        </span>
      </h1>
      <ul
        aria-label="Títulos"
        className="mt-3 space-y-0.5 text-sm leading-snug text-white/70 lg:mt-6 lg:space-y-1 lg:text-lg"
      >
        {profile.titles.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <nav aria-label="Links" className="pointer-events-auto mt-5 flex flex-col items-start gap-3 lg:mt-10">
        <a
          href={journeyLink.href}
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {journeyLink.label} <span aria-hidden>→</span>
        </a>
        {/* Abaixo de 360 px os quatro não cabem numa linha: grade 2×2 em vez de um órfão. */}
        <ul className="grid w-full grid-cols-2 gap-1.5 min-[360px]:flex min-[360px]:w-auto min-[360px]:flex-wrap sm:gap-2">
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
      <CopyContacts className="pointer-events-auto mt-4 lg:mt-6" />
    </div>
  )
}
