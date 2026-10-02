import { memo, useDeferredValue, useEffect, useLayoutEffect, useMemo } from 'react'
import { LANGS } from '../../../shared/i18n'
import { FILTERING_ATTR } from '../../../shared/journey-filters'
import { checkpoints, periodLabel, type Checkpoint as Data } from '../../content/journey-timeline'
import type { Stage } from '../../content/journey'
import { restorePlace } from '../../i18n/keepPlace'
import { useLang, useMessages, type Lang } from '../../i18n/lang'
import { ContactWidget } from '../contact/ContactWidget'
import { Checkpoint } from './Checkpoint'
import { Frame } from './Frame'
import { Intro, PartHead, type Part } from './Intro'
import { Filters } from './Filters'
import { date, place } from './layout'
import { IndexSheet, markId, Minimap, type Row } from './Minimap'
import { byId } from './parts'
import { useReading, type Reading } from './reading'
import { matches, summary, useFilters, type Group } from './useFilters'
import { useJourneyMotion } from './useJourneyMotion'
import './journey.css'

/**
 * A página da trajetória: uma linha do tempo em duas partes, o prólogo (antes da tecnologia e a virada) e a história
 * (a carreira em tecnologia), como pediu o Fael (J24), desenhada como um mapa: um caminho contínuo e sinuoso de marco
 * em marco, com minimapa (J52). É a rota /journey (src/routes/journey.tsx): o build a renderiza em HTML e o navegador a
 * hidrata. O conteúdo vem de journey.json; sem estilo inline (a CSP só aceita CSS do site): a cor de cada marco é a
 * classe `life-<id>`.
 */

/**
 * O primeiro e o último ano de uma parte (null: até hoje): as datas das partes saem do conteúdo, nunca escritas à mão
 * (J41).
 */
function years(part: Data['part']): Part {
  const dates = checkpoints
    .filter((c) => c.part === part)
    .flatMap((c) => [c.period?.start, c.period?.end])
    .filter((d): d is string => !!d)
  const ys = dates.filter((d) => d !== 'present').map((d) => Number(d.slice(0, 4)))
  if (!ys.length) throw new Error(`journey.json: a parte ${part} não tem marco datado`)
  return { id: part, first: Math.min(...ys), last: dates.includes('present') ? null : Math.max(...ys) }
}

/** Cada parte vai do primeiro ao último ano dos seus marcos; o prólogo e a história se sobrepõem (J46). */
const PARTS: Record<Data['part'], Part> = { prologue: years('prologue'), story: years('story') }

/** Cada marco pertence à última vida que começou até ele: é a cor dele e a vida acesa nos pontos do cabeçalho. */
let current: Stage | undefined
const scoped = date(
  checkpoints.map((c) => {
    const life = c.life ? byId.get(c.life) : undefined
    current = life ?? current
    return { c, scope: current, life }
  }),
)
const groups = (['prologue', 'story'] as const).map((part) => ({
  part: PARTS[part],
  items: place(scoped.filter(({ c }) => c.part === part)),
}))
/** As paradas na ordem da página. */
const placed = groups.flatMap((g) => g.items)
const rows: Row[] = groups.flatMap((g) => [
  { kind: 'part' as const, part: g.part },
  ...g.items.map((item) => ({ kind: 'mark' as const, item })),
])

/** O que o filtro aceita: os anos da jornada e as tags que existem nela. */
const BOUNDS = { min: Math.min(...scoped.map((i) => i.from)), max: Math.max(...scoped.map((i) => i.to)) }
const tagsIn = (g: Group) => new Set(scoped.flatMap((i) => i.c.tags?.[g] ?? []))
const KNOWN = { tools: tagsIn('tools'), concepts: tagsIn('concepts'), skills: tagsIn('skills') }
/** O rótulo de cada marco no topo do menu do mapa (celular), em cada idioma. */
const LABELS = Object.fromEntries(
  LANGS.map((l) => [
    l,
    new Map(placed.map((i) => [markId(i), [periodLabel(i.c, l), i.c.title[l]].filter(Boolean).join(' · ')])),
  ]),
) as Record<Lang, Map<string, string>>

/** As tags do marco que o filtro escolheu, numa chave de texto: o cartão só redesenha quando ela muda. */
const matchedIn = (item: (typeof placed)[number], chosen: ReadonlySet<string>) =>
  chosen.size
    ? Object.values(item.c.tags ?? {})
        .flatMap((ts) => ts.filter((t) => chosen.has(t)))
        .join('\n')
    : ''

/* O mapa e o índice leem o marco em leitura sozinhos: a troca de marco não refaz a página (142). */
const LiveMinimap = memo(function LiveMinimap({ reading, out }: { reading: Reading; out: ReadonlySet<string> }) {
  const mark = useReading(reading, (s) => s.mark)
  return <Minimap rows={rows} out={out} current={mark} />
})
const LiveIndex = memo(function LiveIndex({ reading, out }: { reading: Reading; out: ReadonlySet<string> }) {
  const mark = useReading(reading, (s) => s.mark)
  const labels = LABELS[useLang()]
  return <IndexSheet rows={rows} out={out} current={mark} label={labels.get(mark ?? '')} />
})

export function JourneyPage() {
  useEffect(() => {
    // Link direto a um marco (/journey#vela): o navegador rola até ele ao abrir, com a rolagem suave da página, e o
    // ScrollTrigger (useJourneyMotion) a interrompe quando mede a página. Aqui a ida é num salto.
    const id = decodeURIComponent(location.hash.slice(1))
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'instant' })
  }, [])
  const filters = useFilters(BOUNDS, KNOWN)
  /*
   * O toque numa tag responde já na barra (Filters lê o estado novo); o mapa filtrado vem no render adiado logo depois
   * (142). O caminho continua refeito no mesmo commit em que as paradas somem ou voltam, antes da pintura (J68).
   */
  const state = useDeferredValue(filters.state)
  const { active, chosen } = useMemo(() => summary(state, BOUNDS), [state])
  /** As paradas fora do filtro. */
  const out = useMemo(() => new Set(placed.filter((i) => !matches(i, state)).map(markId)), [state])
  /**
   * Com filtro, o ano grande passa para a primeira parada à vista de cada ano (na ordem da página); sem filtro, é o
   * do layout (layout.ts).
   */
  const firsts = useMemo(() => {
    const ids = new Set<string>()
    let last: string | undefined
    for (const i of placed) {
      if (out.has(markId(i)) || !i.year) continue
      if (i.year !== last) ids.add(markId(i))
      last = i.year
    }
    return ids
  }, [out])
  const lang = useLang()
  const m = useMessages().journey
  const { timeline, route, bar, reading } = useJourneyMotion(out, lang)
  // O idioma trocou (o controle PT/EN): o marco que estava à vista volta ao mesmo ponto da tela, antes da pintura.
  useLayoutEffect(restorePlace, [lang])
  // Endereço com filtro: a lista está invisível (marca do Worker, shared/journey-filters.ts) até o mapa filtrado entrar
  // na página; então ela aparece de uma vez, antes da pintura, sem o salto dos marcos que somem.
  useLayoutEffect(() => {
    if (state === filters.state && filters.search === location.search) {
      document.documentElement.removeAttribute(FILTERING_ATTR)
    }
  }, [state, filters.state, filters.search])

  return (
    <>
      <Frame reading={reading} bar={bar} menu={<LiveIndex reading={reading} out={out} />} />
      <main className="text-fg">
        <Intro />
        <Filters items={scoped} filters={filters} />
        <div ref={timeline} className="timeline relative mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:pr-20 xl:pr-60">
          {/* Sem JavaScript: o eixo reto. Com ele, o caminho sinuoso no SVG (useJourneyMotion), e o eixo some. */}
          <div
            aria-hidden
            className="rail absolute top-3 bottom-16 left-[1.5625rem] w-px bg-fg/10 sm:left-[2.3125rem]"
          />
          <svg ref={route} aria-hidden className="route pointer-events-none absolute top-0 left-0 overflow-visible" />
          <p hidden={out.size < placed.length} className="py-24 text-center text-lg text-fg/70">
            {m.empty}{' '}
            <button type="button" onClick={filters.clear} className="underline underline-offset-4 hover:text-fg">
              {m.clearAll}
            </button>
          </p>
          {groups.map((g) => (
            <section
              key={g.part.id}
              id={g.part.id}
              hidden={g.items.every((i) => out.has(markId(i)))}
              aria-labelledby={`${g.part.id}-title`}
              className="scroll-mt-32"
            >
              <PartHead part={g.part} />
              <ol>
                {g.items.map((item) => (
                  <Checkpoint
                    key={item.c.id}
                    item={item}
                    hidden={out.has(markId(item))}
                    yearFirst={active ? firsts.has(markId(item)) : item.yearFirst}
                    matched={matchedIn(item, chosen)}
                    reading={reading}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      </main>
      <LiveMinimap reading={reading} out={out} />
      <ContactWidget />
    </>
  )
}
