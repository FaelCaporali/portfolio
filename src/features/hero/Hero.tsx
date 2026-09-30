import { Suspense, lazy, useCallback, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigation } from 'react-router'
import { OPENING, stages, type PropId } from '../../content/journey'
import { profile } from '../../content/profile'
import { cyclicAt } from '../../lib/array'
import { HeroCopy } from './HeroCopy'
import { LifeTimeline } from './LifeTimeline'
import { SourceLink } from './SourceLink'
import { useDragRotation } from './hooks/useDragRotation'
import { useFreeArea } from './hooks/useFreeArea'
import { usePointerGaze } from './hooks/usePointerGaze'
import type { Phase } from './model/carousel'
import { advance, candidates, createLineup, loadOrder, peek, skipFailed, type Lineup } from './model/lineup'
import { readHeroOptions, type HeroOptions } from './model/options'

const IDS = stages.map((s) => s.id)
/** Os adereços na ordem em que a cena deve carregá-los (a fila dos glb, scene/carga.ts) e o da próxima vida. */
const loadProps = (l: Lineup, chosen: number | null, failed?: ReadonlySet<number>) => ({
  order: loadOrder(l, chosen).map((i) => cyclicAt(stages, i).prop),
  next: cyclicAt(stages, peek(l, chosen)).prop,
  // Para onde a troca pode ir: só a escolhida no indicador ou, sem escolha, as seguintes da volta em ordem (nunca a
  // atual, nunca uma vida cujo glb falhou).
  candidates: candidates(l, chosen, failed).map((i) => cyclicAt(stages, i).prop),
})

/*
 * A cena 3D (three.js) só no navegador: o build pré-renderiza o texto do herói (react-router.config.ts) sem carregar
 * o three. O download começa quando esta página carrega, sem esperar a hidratação.
 */
const loadCanvas = () => import('./scene/HeroCanvas').then((m) => ({ default: m.HeroCanvas }))
const canvasModule = import.meta.env.SSR ? null : loadCanvas()
const HeroCanvas = lazy(() => canvasModule ?? loadCanvas())

/*
 * As opções da página (?slot, ?d, movimento reduzido). No build e na hidratação não há endereço: null, e o texto é o
 * da vida de abertura, igual ao HTML; logo depois, as do endereço. Guardadas por endereço: o React relê a cada render
 * e precisa do mesmo objeto enquanto nada mudou.
 */
let cached: { search: string; options: HeroOptions } | undefined
function clientOptions(): HeroOptions {
  const { search } = window.location
  if (cached?.search !== search) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    cached = { search, options: readHeroOptions(search, IDS, OPENING, reduced) }
  }
  return cached.options
}
const noSubscribe = () => () => undefined
const serverOptions = () => null
const OPENING_START = readHeroOptions('', IDS, OPENING, false).start

/**
 * Herói: "Today I am a [vida]" com o busto 3D que desintegra em furacão e volta com o adereço da próxima vida.
 * Com ?slot o carrossel começa em outra vida: o herói recomeça nela assim que o navegador lê o endereço.
 */
export function Hero() {
  const options = useSyncExternalStore(noSubscribe, clientOptions, serverOptions)
  const start = options?.start ?? OPENING_START
  return <HeroView key={start} start={start} options={options} />
}

/**
 * Aqui só o estado da página (vida atual e fase) e a composição; cena, texto e interação vivem nos módulos ao lado.
 * `options` é null até a hidratação (sem cena).
 */
function HeroView({ start, options }: { start: number; options: HeroOptions | null }) {
  const [index, setIndex] = useState(start)
  // A vida de abertura segura mais tempo só na chegada, não quando volta a aparecer.
  const [opening, setOpening] = useState(true)
  const [initialLineup] = useState(() => createLineup(stages.length, start))
  const lineup = useRef(initialLineup)
  const [carga, setCarga] = useState(() => loadProps(initialLineup, null))
  const [phase, setPhase] = useState<Phase>('hold')
  const { drag, handlers } = useDragRotation()
  const pointer = usePointerGaze()
  const header = useRef<HTMLElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const free = useFreeArea(header, text)
  // Vida escolhida no indicador: o ref é lido pelo relógio a cada quadro; o estado destaca o ponto na hora.
  const requested = useRef<number | null>(null)
  const [pending, setPending] = useState<number | null>(null)
  // Vidas cujo glb falhou (#138, a cena avisa): saem da volta e do indicador até o glb chegar.
  const failed = useRef<ReadonlySet<number>>(new Set())
  const next = useCallback((prop: PropId) => {
    // A vida para onde a cena troca (a escolhida no indicador ou a 1ª pronta da volta).
    const i = stages.findIndex((s) => s.prop === prop)
    const target = i < 0 ? requested.current : i
    requested.current = null
    setPending(null)
    lineup.current = advance(lineup.current, stages.length, target, Math.random, failed.current)
    setIndex(lineup.current.current)
    setCarga(loadProps(lineup.current, null, failed.current))
    setOpening(false)
  }, [])
  const onFailures = useCallback((props: ReadonlySet<PropId>) => {
    failed.current = new Set(stages.flatMap((s, i) => (props.has(s.prop) ? [i] : [])))
    // A escolha no indicador numa vida que falhou é descartada: o carrossel segue.
    if (requested.current !== null && failed.current.has(requested.current)) {
      requested.current = null
      setPending(null)
    }
    lineup.current = skipFailed(lineup.current, stages.length, failed.current)
    setCarga(loadProps(lineup.current, requested.current, failed.current))
  }, [])
  const stage = cyclicAt(stages, index)
  // Indo para outra página (o botão da trajetória): a cena para, e o quadro 3D não disputa o processador com ela.
  const leavingPage = useNavigation().state !== 'idle'
  const select = (id: string) => {
    const i = stages.findIndex((s) => s.id === id)
    // Vida cujo glb falhou: o clique é descartado e o carrossel segue (o aviso visual é da tarefa 143).
    if (failed.current.has(i)) return
    const target = i === index ? null : i
    requested.current = target
    setPending(target)
    setCarga(loadProps(lineup.current, target, failed.current))
  }

  return (
    <section className="relative h-svh overflow-hidden" aria-label="Apresentação">
      {options && (
        <Suspense fallback={null}>
          <HeroCanvas
            paused={leavingPage}
            stage={stage}
            first={opening}
            options={options}
            free={free}
            pointer={pointer}
            drag={drag}
            requested={requested}
            order={carga.order}
            next={carga.next}
            candidates={carga.candidates}
            onFailures={onFailures}
            dragHandlers={handlers}
            onPhase={setPhase}
            onNext={next}
          />
        </Suspense>
      )}

      {/* Cabeçalho na largura toda: o nome à esquerda e, abaixo dele, o indicador centralizado na página. A base do
          cabeçalho é o topo do espaço livre do busto no celular (useFreeArea). */}
      <header ref={header} className="pointer-events-none absolute inset-x-0 top-0 pt-5 pb-1">
        <div className="px-5 sm:px-10 wide:pl-[7vw]">
          <a
            href="/"
            className="pointer-events-auto text-sm font-medium tracking-wide text-white/90 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white lg:text-base"
          >
            {profile.name}
          </a>
        </div>
        <div className="mt-2 flex justify-center">
          <LifeTimeline currentId={cyclicAt(stages, pending ?? index).id} onSelect={select} />
        </div>
      </header>

      {/* Canto superior direito em todos os tamanhos (o contato fica embaixo). Alinhado ao nome; discreto: só o ícone
          apagado, sem contorno nem fundo, com área de toque de 44 px. */}
      <SourceLink
        className="absolute top-2.5 right-3 flex h-11 w-11 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-8"
        iconClassName="h-5 w-5"
      />

      <HeroCopy ref={text} stage={stage} leaving={phase === 'out'} />
    </section>
  )
}
