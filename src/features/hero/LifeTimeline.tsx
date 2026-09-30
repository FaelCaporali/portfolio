import { stages } from '../../content/journey'
import { cx } from '../../lib/cx'
import { useHydrated } from '../../lib/useHydrated'

interface LifeTimelineProps {
  /** Vida em destaque: a atual, ou a escolhida enquanto a troca acontece; null = nenhuma (o "loading" do herói). */
  currentId: string | null
  onSelect: (id: string) => void
}

/**
 * Indicador das vidas em ordem cronológica, mesmo com o carrossel rodando fora de ordem: quem assiste vê onde cada
 * vida cai no tempo. Anéis finos na cor de cada vida sobre uma linha do tempo; a atual fica preenchida e com brilho.
 * Cada ponto é um botão (alvo de 24 px) que leva àquela vida.
 */
export function LifeTimeline({ currentId, onSelect }: LifeTimelineProps) {
  // Desligados até a hidratação (a página sai pronta do build): antes disso o clique não troca a vida.
  const hydrated = useHydrated()
  return (
    <nav aria-label="Timeline" className="pointer-events-auto relative">
      <span aria-hidden className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-white/15" />
      <ol className="relative flex items-center gap-1 sm:gap-2.5">
        {stages.map((s) => {
          const on = s.id === currentId
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!hydrated}
                aria-label={s.slot}
                aria-current={on ? 'step' : undefined}
                title={s.slot}
                onClick={() => {
                  onSelect(s.id)
                }}
                className="group grid h-6 w-6 cursor-pointer place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-white"
              >
                {/* A cor é a da vida (life-<id>, index.css: .life-dot), por classe: a CSP não aceita estilo inline. */}
                <span
                  data-on={on || undefined}
                  className={cx(
                    `life-dot life-${s.id} block h-2.5 w-2.5 rounded-full border-[1.5px] bg-[#0b0b0e]`,
                    'transition-all duration-300',
                    on ? 'scale-125' : 'opacity-55 group-hover:scale-110 group-hover:opacity-100',
                  )}
                />
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
