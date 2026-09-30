import type { ReactNode, RefObject } from 'react'
import { Link } from 'react-router'
import { stages } from '../../content/journey'
import { profile } from '../../content/profile'
import { useReading, type Reading } from './reading'

/**
 * O que fica sempre à vista: brilho de fundo, barra de progresso e cabeçalho. Os três leem `--accent` do <body>, que
 * useJourneyMotion troca para a cor da vida em leitura (a transição da cor é do CSS, journey.css). `bar`: a barra, que
 * a rolagem estica. `reading`: a vida em leitura, que acende o ponto dela.
 */
export function Frame({
  menu,
  reading,
  bar,
}: {
  menu: ReactNode
  reading: Reading
  bar: RefObject<HTMLDivElement | null>
}) {
  return (
    <>
      <div aria-hidden className="page-glow pointer-events-none fixed inset-0 -z-backdrop" />
      <header className="fixed inset-x-0 top-0 z-header border-b border-fg/6 bg-page/70 backdrop-blur-md">
        <div
          ref={bar}
          aria-hidden
          className="progress absolute inset-x-0 bottom-[-1px] h-0.5 origin-left bg-(--accent)"
        />
        {/* Três colunas: a volta ao herói (pelo roteador, sem recarregar), os pontos das vidas no centro e, no
            celular, o menu do mapa. */}
        <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:gap-3 sm:px-8">
          <Link
            to="/"
            prefetch="intent"
            className="inline-flex min-h-6 shrink-0 items-center justify-self-start text-sm font-semibold text-fg/85 hover:text-fg"
          >
            <span aria-hidden>←</span>
            {/* Abaixo de 400 px só a seta: os nove pontos precisam da largura. */}
            <span className="sr-only phone-lg:not-sr-only phone-lg:ml-2">{profile.name}</span>
          </Link>
          <LifeDots reading={reading} />
          {menu}
        </div>
      </header>
    </>
  )
}

/** Os pontos das vidas, como no herói: cada um leva à vida na página; o da vida em leitura acende. */
function LifeDots({ reading }: { reading: Reading }) {
  const life = useReading(reading, (s) => s.life)
  return (
    <nav aria-label="Lives" className="relative">
      <span aria-hidden className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-fg/15" />
      <ol className="relative flex items-center phone:gap-0.5 sm:gap-2">
        {stages.map((s) => (
          <li key={s.id} className={`life-${s.id}`}>
            <a
              href={`#${s.id}`}
              data-dot
              aria-current={s.id === life ? 'step' : undefined}
              aria-label={s.slot}
              title={s.slot}
              className="group grid h-6 w-6 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-fg"
            >
              <span className="dot block h-2.5 w-2.5 rounded-full border-[1.5px] border-(--accent) bg-page opacity-55 transition-all duration-300 group-hover:scale-110 group-hover:opacity-100" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
