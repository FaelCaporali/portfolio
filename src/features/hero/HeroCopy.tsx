import type { Ref } from 'react'
import type { Stage } from '../../content/journey'
import { journeyLink, profile, profileLinks } from '../../content/profile'
import { pill } from '../../ui/pill'
import { CopyContacts } from '../contact/CopyContacts'
import { ResumeMenu } from './ResumeMenu'
import { SourceLink } from './SourceLink'
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
        <span className="block text-sm tracking-[0.3em] text-white/60 uppercase lg:text-base">
          {stage.past ? 'Yesterday I was' : 'Today I am'} a{/^[aeiou]/i.test(stage.slot) ? 'n' : ''}
        </span>{' '}
        {/* Altura reservada para a troca não empurrar o resto: duas linhas no celular (a vida mais longa quebra), uma
            a partir de sm. No largo a fonte segue a coluna (3,6vw): "AI software developer" mede 10,1em e cabe numa
            linha de 1024 a 1920 px, sem vão embaixo das vidas curtas. */}
        <span className="mt-2 block min-h-[2em] text-[2.6rem] leading-none font-semibold tracking-tight sm:min-h-[1em] lg:text-[clamp(2.25rem,3.6vw,5rem)]">
          <SlotWord text={stage.slot} color={stage.accent} leaving={leaving} />
        </span>
      </h1>
      {/* Celular: um título por linha. A partir de sm: numa linha só, separados por um ponto apagado. */}
      <ul
        aria-label="Títulos"
        className="mt-4 flex flex-col gap-0.5 text-sm leading-snug font-medium text-white/75 sm:mt-5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-y-1 sm:text-[15px] lg:mt-6 lg:text-lg"
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
        className="pointer-events-auto mt-6 flex flex-col items-start gap-3 sm:mt-7 lg:mt-8 lg:gap-4"
      >
        <a
          href={journeyLink.href}
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {journeyLink.label} <span aria-hidden>→</span>
        </a>
        {/* Abaixo de 360 px os quatro não cabem numa linha: grade 2×2 em vez de um órfão. O atalho do código fica aqui
            até o largo; lá ele vai para o canto superior direito (Hero). */}
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
          <li className="lg:hidden">
            <SourceLink
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              iconClassName="h-4.5 w-4.5"
            />
          </li>
        </ul>
      </nav>
      {/* Contato direto sempre à vista; clique copia (o formulário e os links ficam no botão flutuante). */}
      <CopyContacts className="pointer-events-auto mt-5 lg:mt-6" />
    </div>
  )
}
