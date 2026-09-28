import { chapters, type Entry } from '../../content/journey-page'
import type { Stage } from '../../content/journey'
import { Cards, type Scoped } from './Cards'
import { Frame } from './Frame'
import { ChapterHead, Closing, Opening } from './Opening'
import { byId } from './parts'
import { Scene } from './Scene'

/**
 * A página da trajetória inteira, renderizada para HTML estático no build (vite.config.ts, journeyPage). Sem estilo
 * inline: a CSP das páginas só aceita CSS do próprio site. A cor de cada vida vem da classe `life-<id>` (CSS gerado
 * de journey.ts) e a animação, de main.ts. Estrutura em .wai/trajetoria/DESIGN.md: abertura, capítulos, uma cena
 * por vida (o Uber, de passagem, fica entre os cartões), os causos em cartões e o fechamento.
 */

type Block =
  { kind: 'scene'; entry: Entry; stage: Stage; flip: boolean } | { kind: 'cards'; key: string; items: Scoped[] }

/** Cada entrada pertence à última vida que começou antes dela: é a cor do nó e a vida acesa nos pontos. */
let current: Stage | undefined
let scenes = 0
const blocked = chapters.map((c) => {
  const blocks: Block[] = []
  for (const entry of c.entries) {
    const stage = entry.life ? byId.get(entry.life) : undefined
    if (stage) current = stage
    const last = blocks.at(-1)
    if (stage && !entry.minor) {
      blocks.push({ kind: 'scene', entry, stage, flip: scenes++ % 2 === 1 })
    } else if (last?.kind === 'cards') {
      last.items.push({ entry, scope: current })
    } else {
      blocks.push({ kind: 'cards', key: entry.title, items: [{ entry, scope: current }] })
    }
  }
  return { ...c, blocks }
})

export function JourneyPage() {
  return (
    <>
      <Frame />
      <main className="text-white">
        <Opening />
        {blocked.map((c, i) => (
          <section key={c.id} id={c.id} aria-labelledby={`${c.id}-title`} className="scroll-mt-14">
            <ChapterHead id={c.id} title={c.title} span={c.span} index={i} />
            {c.blocks.map((b) =>
              b.kind === 'scene' ? (
                <Scene key={b.stage.id} entry={b.entry} stage={b.stage} flip={b.flip} />
              ) : (
                <Cards key={b.key} items={b.items} />
              ),
            )}
          </section>
        ))}
        <Closing />
      </main>
    </>
  )
}
