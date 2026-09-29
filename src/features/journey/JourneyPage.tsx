import { checkpoints, type Checkpoint as Data } from '../../content/journey-timeline'
import type { Stage } from '../../content/journey'
import { Checkpoint } from './Checkpoint'
import { Frame } from './Frame'
import { Closing, Intro, PartHead, type Part } from './Intro'
import { byId } from './parts'

/**
 * A página da trajetória, renderizada para HTML estático no build (vite.config.ts, journeyPage): uma linha do tempo
 * institucional em duas partes, o prólogo (antes da tecnologia e a virada) e a história (a carreira em tecnologia),
 * como pediu o Fael (J24). O conteúdo vem de journey.json; sem estilo inline (a CSP só aceita CSS do site): a cor de
 * cada marco é a classe `life-<id>` e o movimento, de main.ts.
 */

/** O ano do primeiro marco datado da parte: as datas das partes saem do conteúdo, nunca escritas à mão (J41). */
function firstYear(part: Data['part']): string {
  const year = checkpoints.find((c) => c.part === part && c.period?.start)?.period?.start?.slice(0, 4)
  if (!year) throw new Error(`journey.json: a parte ${part} não tem marco datado`)
  return year
}

/** O prólogo vai até a história começar (com o estudo, J30 e J41); a história vai até hoje. */
const PARTS: Record<Data['part'], Part> = {
  prologue: { id: 'prologue', title: 'Prologue', span: `${firstYear('prologue')} – ${firstYear('story')}` },
  story: { id: 'story', title: 'The story', span: `${firstYear('story')} – today` },
}

/** Cada marco pertence à última vida que começou até ele: é a cor dele e a vida acesa nos pontos do cabeçalho. */
let current: Stage | undefined
const scoped = checkpoints.map((c) => {
  current = (c.life && byId.get(c.life)) || current
  return { c, scope: current }
})
const groups = (['prologue', 'story'] as const).map((part) => ({
  part: PARTS[part],
  items: scoped.filter(({ c }) => c.part === part),
}))

export function JourneyPage() {
  return (
    <>
      <Frame />
      <main className="text-white">
        <Intro parts={groups.map((g) => g.part)} />
        <div className="timeline relative mx-auto max-w-6xl px-5 pb-16 sm:px-8">
          {/* O eixo: linha apagada e, por cima, a parte já lida, que main.ts estica com a rolagem. */}
          <div
            aria-hidden
            className="rail absolute top-3 bottom-16 left-[1.5625rem] w-px bg-white/10 sm:left-[2.3125rem] lg:left-[14.5rem]"
          >
            <div className="rail-fill absolute inset-0 origin-top bg-(--accent)" />
          </div>
          {groups.map((g) => (
            <section key={g.part.id} id={g.part.id} aria-labelledby={`${g.part.id}-title`} className="scroll-mt-20">
              <PartHead part={g.part} />
              <ol>
                {g.items.map(({ c, scope }) => (
                  <Checkpoint key={c.id} c={c} scope={scope} />
                ))}
              </ol>
            </section>
          ))}
        </div>
        <Closing />
      </main>
    </>
  )
}
