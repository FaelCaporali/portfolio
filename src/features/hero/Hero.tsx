import { useCallback, useRef, useState } from 'react'
import { stages } from '../../content/journey'
import { profile } from '../../content/profile'
import { cyclicAt } from '../../lib/array'
import { HeroCopy } from './HeroCopy'
import { SourceLink } from './SourceLink'
import { useDragRotation } from './hooks/useDragRotation'
import { useFreeArea } from './hooks/useFreeArea'
import { usePointerGaze } from './hooks/usePointerGaze'
import type { Phase } from './model/carousel'
import { readHeroOptions } from './model/options'
import { HeroCanvas } from './scene/HeroCanvas'

const readOptions = () =>
  readHeroOptions(
    window.location.search,
    stages.map((s) => s.id),
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

/**
 * Herói: "Today I am a [vida]" com o busto 3D que desintegra em furacão e volta com o adereço da próxima vida.
 * Aqui só o estado da página (vida atual e fase) e a composição; cena, texto e interação vivem nos módulos ao lado.
 */
export function Hero() {
  const [options] = useState(readOptions)
  const [index, setIndex] = useState(options.start)
  const [phase, setPhase] = useState<Phase>('hold')
  const { drag, handlers } = useDragRotation()
  const pointer = usePointerGaze()
  const header = useRef<HTMLElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const free = useFreeArea(header, text)
  const next = useCallback(() => {
    setIndex((i) => (i + 1) % stages.length)
  }, [])
  const stage = cyclicAt(stages, index)

  return (
    <section className="relative h-svh overflow-hidden" aria-label="Apresentação">
      <HeroCanvas
        stage={stage}
        first={index === 0}
        options={options}
        free={free}
        pointer={pointer}
        drag={drag}
        dragHandlers={handlers}
        onPhase={setPhase}
        onNext={next}
      />

      <header ref={header} className="absolute top-0 left-0 px-5 py-5 sm:px-10 lg:pl-[7vw]">
        <a
          href="/"
          className="text-sm font-medium tracking-wide text-white/90 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white lg:text-base"
        >
          {profile.name}
        </a>
      </header>

      {/* Largo: o canto superior direito está livre (o botão de contato fica embaixo). Alinhado ao nome; discreto:
          só o ícone apagado, sem contorno nem fundo, com área de toque de 44 px. */}
      <SourceLink
        className="absolute top-2.5 right-8 hidden h-11 w-11 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:flex"
        iconClassName="h-5 w-5"
      />

      <HeroCopy ref={text} stage={stage} leaving={phase === 'out'} />
    </section>
  )
}
