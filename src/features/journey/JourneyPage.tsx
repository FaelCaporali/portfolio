import { checkpoints, type Checkpoint as Data } from '../../content/journey-timeline'
import type { Stage } from '../../content/journey'
import { Checkpoint } from './Checkpoint'
import { Frame } from './Frame'
import { Intro, PartHead, type Part } from './Intro'
import { place } from './layout'
import { Minimap, type Row } from './Minimap'
import { byId } from './parts'

/**
 * A página da trajetória, renderizada para HTML estático no build (vite.config.ts, journeyPage): uma linha do tempo
 * em duas partes, o prólogo (antes da tecnologia e a virada) e a história (a carreira em tecnologia), como pediu o
 * Fael (J24), desenhada como um mapa: um caminho contínuo e sinuoso de marco em marco, com minimapa (J52). O conteúdo
 * vem de journey.json; sem estilo inline (a CSP só aceita CSS do site): a cor de cada marco é a classe `life-<id>`, e
 * o caminho e o movimento vêm de main.ts.
 */

/** O primeiro e o último ano de uma parte: as datas das partes saem do conteúdo, nunca escritas à mão (J41). */
function years(part: Data['part']): string {
  const dates = checkpoints
    .filter((c) => c.part === part)
    .flatMap((c) => [c.period?.start, c.period?.end])
    .filter((d): d is string => !!d)
  const ys = dates.filter((d) => d !== 'present').map((d) => Number(d.slice(0, 4)))
  if (!ys.length) throw new Error(`journey.json: a parte ${part} não tem marco datado`)
  const last = dates.includes('present') ? 'today' : String(Math.max(...ys))
  return `${String(Math.min(...ys))} – ${last}`
}

/** Cada parte vai do primeiro ao último ano dos seus marcos; o prólogo e a história se sobrepõem (J46). */
const PARTS: Record<Data['part'], Part> = {
  prologue: { id: 'prologue', title: 'Prologue', span: years('prologue') },
  story: { id: 'story', title: 'The story', span: years('story') },
}

/** Cada marco pertence à última vida que começou até ele: é a cor dele e a vida acesa nos pontos do cabeçalho. */
let current: Stage | undefined
const scoped = checkpoints.map((c) => {
  const life = c.life ? byId.get(c.life) : undefined
  current = life ?? current
  return { c, scope: current, life }
})
const groups = (['prologue', 'story'] as const).map((part) => ({
  part: PARTS[part],
  items: place(scoped.filter(({ c }) => c.part === part)),
}))
const rows: Row[] = groups.flatMap((g) => [
  { kind: 'part' as const, part: g.part },
  ...g.items.map((item) => ({ kind: 'mark' as const, item })),
])

export function JourneyPage() {
  return (
    <>
      <Frame />
      <main className="text-white">
        <Intro parts={groups.map((g) => g.part)} />
        <div className="timeline relative mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:pr-20 xl:pr-60">
          {/* Sem JavaScript: o eixo reto. Com ele, main.ts desenha o caminho sinuoso no SVG e esconde o eixo. */}
          <div
            aria-hidden
            className="rail absolute top-3 bottom-16 left-[1.5625rem] w-px bg-white/10 sm:left-[2.3125rem]"
          />
          <svg aria-hidden className="route pointer-events-none absolute inset-0 h-full w-full overflow-visible" />
          {groups.map((g) => (
            <section key={g.part.id} id={g.part.id} aria-labelledby={`${g.part.id}-title`} className="scroll-mt-20">
              <PartHead part={g.part} />
              <ol>
                {g.items.map((item) => (
                  <Checkpoint key={item.c.id} item={item} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      </main>
      <Minimap rows={rows} />
    </>
  )
}
