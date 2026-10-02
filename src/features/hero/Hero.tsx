import { Suspense, lazy, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { useNavigation } from 'react-router'
import { OPENING, stages, type PropId } from '../../content/journey'
import { profile } from '../../content/profile'
import { LangSwitch } from '../../i18n/LangSwitch'
import { localePath, useLang, useMessages } from '../../i18n/lang'
import { cyclicAt } from '../../lib/array'
import { HeroCopy } from './HeroCopy'
import { HeroFallbackImage } from './HeroFallbackImage'
import { LifeTimeline } from './LifeTimeline'
import { SceneBoundary } from './SceneBoundary'
import { SourceLink } from './SourceLink'
import { useDragRotation } from './hooks/useDragRotation'
import { useFreeArea } from './hooks/useFreeArea'
import { useOnScreen } from './hooks/useOnScreen'
import { usePointerGaze } from './hooks/usePointerGaze'
import { hasAcceleration } from './model/acceleration'
import { TIMING, type Phase } from './model/carousel'
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
 * A cena 3D (three.js) só no navegador, e só com aceleração de GPU real (R1, camada 2 de 03-plano-versao-robos.md):
 * o build pré-renderiza o texto do herói (react-router.config.ts) sem carregar o three; sem GPU (Googlebot, uma
 * pessoa com hardware antigo ou VM), o chunk da cena nunca é importado — nem o download, nem o WebGL acontecem.
 */
const loadCanvas = () => import('./scene/HeroCanvas').then((m) => ({ default: m.HeroCanvas }))
/**
 * Escape de desenvolvimento (R5): existe só dentro de `import.meta.env.DEV`, no mesmo padrão de
 * `scene/HeroCanvas.tsx` (DebugHook) — `import.meta.env.DEV` é substituído por `false` em tempo de build, e o bloco
 * inteiro sai do bundle de produção (vite.dev/guide/env-and-mode; prova por grep no build, Fase 3 do plano). Nunca
 * aparece como string reconhecível fora deste `if`.
 */
function forcedByTooling(search: string): boolean {
  if (!import.meta.env.DEV) return false
  return new URLSearchParams(search).has('labAceleracao')
}
// SSR (pré-render): nunca acelera. No navegador: GPU real (hasAcceleration) ou, só em dev, o escape acima.
const canAccelerate = !import.meta.env.SSR && (hasAcceleration() || forcedByTooling(window.location.search))
// O download começa quando esta página carrega, sem esperar a hidratação — mas só quando pode acelerar.
const canvasModule = canAccelerate ? loadCanvas() : null
const HeroCanvas = canvasModule && lazy(() => canvasModule)

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
 * Até o 1º quadro da cena, "Today I am loading" (U2, D-143a), também no HTML do build.
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
  // A cena caiu (SceneBoundary): quem troca a vida é o clique no indicador, direto, sem desintegração. Sem aceleração
  // de GPU (camada 2), HeroCanvas é null e a cena nunca chega a montar: começa direto neste MESMO estado, sem
  // "loading" (R3), em vez de esperar um onFail que nunca vem.
  const [sceneFailed, setSceneFailed] = useState(!HeroCanvas)
  // "Today I am loading" até o 1º quadro com o busto (U2), sem prazo (D-U2a: "loading sem limites faz sentido contanto
  // que quando busto carregado, troque o texto"): no HTML, na hidratação e a cada montagem (a volta da trajetória
  // também). Cena que cai sai do "loading" na hora, para a vida de abertura.
  const [sceneReady, setSceneReady] = useState(false)
  const onSceneReady = useCallback(() => {
    // Vem do commit do R3F (Bust.tsx, junto da marca 'cena'), outro renderizador: o flushSync troca o texto nesse
    // mesmo instante, e o texto e o busto pintam no mesmo quadro.
    // eslint-disable-next-line @eslint-react/dom-no-flush-sync -- uma vez por montagem: a troca não vai a outra tarefa
    flushSync(() => {
      setSceneReady(true)
    })
  }, [])
  const loading = !sceneReady && !sceneFailed
  const next = useCallback((prop: PropId) => {
    // A vida para onde a cena troca (a escolhida no indicador ou a 1ª pronta da volta).
    const i = stages.findIndex((s) => s.prop === prop)
    const target = i < 0 ? requested.current : i
    requested.current = null
    setPending(null)
    lineup.current = advance(lineup.current, stages.length, target, failed.current)
    setIndex(lineup.current.current)
    setCarga(loadProps(lineup.current, null, failed.current))
    setOpening(false)
  }, [])
  const onSceneFail = useCallback(() => {
    setSceneFailed(true)
    setPhase('hold')
    // A escolha no indicador que esperava a cena (feita no "loading" ou no meio da volta) vale agora, direto: o ponto e
    // o texto ficam juntos.
    if (requested.current === null) setPending(null)
    else next(cyclicAt(stages, requested.current).prop)
  }, [next])
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
  // Sem aceleração de GPU real (sceneFailed, inclusive a cena que caiu depois de montada), o lugar do busto é uma
  // imagem parada (HeroFallbackImage), e o relógio do carrossel segue sozinho — o MESMO tempo do 3D (TIMING), sem
  // desintegração. Fala do Fael (Capítulo 11 do plano, 03-plano-versao-robos.md): "ausência de GPU não impede render
  // 3d [...] deveria ter imagens". O clique no indicador já troca na hora (select, abaixo); este efeito só cobre a
  // passagem do tempo. `carga.next` é a mesma vida que a cena real usaria como `onNext` (loadProps, acima).
  useEffect(() => {
    if (!sceneFailed) return
    const holdMs = (opening ? TIMING.holdFirst : TIMING.hold) * 1000
    const id = window.setTimeout(() => next(carga.next), holdMs)
    return () => window.clearTimeout(id)
  }, [sceneFailed, opening, index, carga.next, next])
  const nextStage = sceneFailed ? (stages.find((s) => s.prop === carga.next) ?? null) : null
  const lang = useLang()
  const m = useMessages()
  // Indo para outra página (o botão da trajetória): a cena para, e o quadro 3D não disputa o processador com ela.
  const leavingPage = useNavigation().state !== 'idle'
  // Fora da vista (o conteúdo abaixo do herói, 05-contrato O3): a cena para de desenhar e volta ao entrar, sem novo
  // "loading". O relógio do carrossel anda no quadro da cena (Director): parada, nenhuma vida troca escondida, e
  // texto e busto voltam juntos de onde estavam.
  const section = useRef<HTMLElement>(null)
  const onScreen = useOnScreen(section)
  const select = (id: string) => {
    const i = stages.findIndex((s) => s.id === id)
    // Vida cujo glb falhou: o clique é descartado e o carrossel segue (o aviso visual é da tarefa 143).
    if (failed.current.has(i)) return
    if (sceneFailed) {
      if (i >= 0 && i !== index) next(cyclicAt(stages, i).prop)
      return
    }
    const target = i === index ? null : i
    requested.current = target
    setPending(target)
    setCarga(loadProps(lineup.current, target, failed.current))
  }

  return (
    <section ref={section} className="relative h-svh overflow-hidden" aria-label={m.hero.section}>
      {/* Se a cena falha (import, render, WebGL), sai só ela: SceneBoundary. Sem aceleração de GPU (camada 2),
          HeroCanvas é null: nem monta, nem importa o chunk. */}
      {options && HeroCanvas && (
        <SceneBoundary onFail={onSceneFail}>
          <Suspense fallback={null}>
            <HeroCanvas
              paused={leavingPage || !onScreen}
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
              onScene={onSceneReady}
            />
          </Suspense>
        </SceneBoundary>
      )}

      {/* Sem aceleração (a sonda falhou, ou a cena caiu): a imagem da vida atual no lugar do busto, nunca vazio. Só
          depois da hidratação (options não nulo) — o servidor não sabe da GPU, e a 1ª renderização do cliente tem de
          bater com o HTML dele (nem canvas, nem imagem) até esse ponto. */}
      {options && sceneFailed && <HeroFallbackImage stage={stage} nextStage={nextStage} alt={m.hero.slots[stage.id]} />}

      {/* Cabeçalho na largura toda: o nome à esquerda e, abaixo dele, o indicador centralizado na página. A base do
          cabeçalho é o topo do espaço livre do busto no celular (useFreeArea). */}
      <header ref={header} className="pointer-events-none absolute inset-x-0 top-0 pt-5 pb-1">
        <div className="px-5 sm:px-10 wide:pl-hero">
          {/* O nome é o h1 da home (buscadores e leitores de tela); na tela, o mesmo link de sempre. */}
          <h1>
            <a
              href={localePath(lang, '/')}
              className="pointer-events-auto text-sm font-medium tracking-wide text-fg/90 transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fg lg:text-base"
            >
              {profile.name}
            </a>
          </h1>
        </div>
        <div className="mt-2 flex justify-center">
          {/* No "loading" nenhuma vida está na tela: nenhum ponto atual, só a escolha feita nele (vale na chegada). */}
          <LifeTimeline
            currentId={loading && pending === null ? null : cyclicAt(stages, pending ?? index).id}
            onSelect={select}
          />
        </div>
      </header>

      {/* Canto superior direito em todos os tamanhos (o contato fica embaixo). Alinhado ao nome; discreto: só o ícone
          apagado, sem contorno nem fundo, com área de toque de 44 px. */}
      <SourceLink
        className="absolute top-2.5 right-3 flex h-11 w-11 items-center justify-center rounded-full text-fg/50 transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg sm:right-8"
        iconClassName="h-5 w-5"
      />

      <HeroCopy ref={text} stage={stage} leaving={phase === 'out'} loading={loading} />

      {/* PT/EN: à esquerda do ícone do código, no mesmo estilo apagado e com a mesma área de toque de 44 px. Último
          da seção, absoluto: não desloca nada do que já estava na página. */}
      <LangSwitch className="absolute top-2 right-14 flex h-11 min-w-11 items-center justify-center rounded-full text-sm font-medium tracking-wide text-fg/50 transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg sm:top-2.5 sm:right-19" />
    </section>
  )
}
