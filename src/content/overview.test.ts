import { describe, expect, it } from 'vitest'
import type { StageId } from './journey'
import { homeTagLabel, tagDictionaries } from '../i18n/tags'
import { checkpoints } from './journey-timeline'
import { journeyHref, journeyStartHref, LIFE_ANCHORS, LIFE_OF, overview, prologueHref } from './overview'

/** As etiquetas da home: as das ofertas e os itens da stack (sem idioma no JSON; tags.ts: homeTagLabel). */
const tags = [...overview.offers.items.flatMap((o) => o.tags), ...overview.stack.groups.flatMap((g) => g.items)]

const ids = [
  ...overview.offers.items.flatMap((o) => o.proof.map((p) => p.journeyId)),
  ...overview.experience.items.map((e) => e.journeyId),
]

/** Todo texto {en, pt} do JSON, onde estiver. */
function texts(node: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) for (const n of node) texts(n, out)
  else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>
    if ('en' in o || 'pt' in o) out.push(o)
    else for (const v of Object.values(o)) texts(v, out)
  }
  return out
}

/** A vida em que cada marco pousa na trajetória: a última que começou até ele, na ordem da página (JourneyPage.tsx). */
function scopes(): Map<string, StageId | undefined> {
  const out = new Map<string, StageId | undefined>()
  let current: StageId | undefined
  for (const c of checkpoints) {
    current = c.life ?? current
    out.set(c.id, current)
  }
  return out
}

/**
 * Nomes de empregador, cliente e contrato e o tom que desqualifica quem contrata (06-requisitos-v2.md, R2 e R7): a
 * home não os cita; a trajetória, sim.
 */
const PROIBIDOS = [
  /cart[óo]rio|notary|D-Rocket|Fabrique|Brickup|Beamble|Dalegig|Everywhr|Pr[ée]via|Constructo/i,
  /Trybe|SEBRAE|fr[áa]gil|shaky/i,
  /\b(BID|PHD|CNJ|Uber|UPS|DHL)\b/i,
]

describe('overview.json', () => {
  it('cada link leva a um marco que existe na trajetória, pelo id que ele tem na página', () => {
    for (const id of ids) {
      const c = checkpoints.find((x) => x.id === id)
      expect(c, `marco ${id}`).toBeDefined()
      // Checkpoint.tsx: o marco em que uma vida começa leva o id da vida.
      expect(journeyHref('en', id)).toBe(`/journey#${c?.life ?? id}`)
      expect(journeyHref('pt', id)).toBe(`/pt/journey#${c?.life ?? id}`)
    }
    // Nenhuma âncora sobrando de marco que saiu do texto.
    expect(Object.keys(LIFE_ANCHORS).filter((id) => !ids.includes(id))).toEqual([])
    expect(prologueHref('pt')).toBe('/pt/journey#prologue')
    expect(journeyStartHref('en')).toBe('/journey')
    expect(journeyStartHref('pt')).toBe('/pt/journey')
  })

  it('a cor de cada link é a da vida em que o marco pousa na trajetória', () => {
    const scope = scopes()
    const byName = (a: string, b: string) => a.localeCompare(b)
    expect(Object.keys(LIFE_OF).sort(byName)).toEqual([...new Set(ids)].sort(byName))
    for (const id of ids) expect(LIFE_OF[id], id).toBe(scope.get(id))
  })

  it('todo texto existe nos dois idiomas; listas com o mesmo tamanho', () => {
    const all = texts(overview)
    expect(all.length).toBeGreaterThan(40)
    for (const t of all) {
      const { en, pt } = t
      if (Array.isArray(en)) expect((pt as unknown[]).length, JSON.stringify(en)).toBe(en.length)
      else {
        expect(typeof en === 'string' && en.length > 0, JSON.stringify(t)).toBe(true)
        expect(typeof pt === 'string' && pt.length > 0, JSON.stringify(t)).toBe(true)
      }
    }
  })

  it('nenhum nome de empresa, cliente ou contrato, nem tom que desqualifica quem contrata', () => {
    // Todo texto {en, pt} e as etiquetas, que não têm idioma no JSON (11-contrato-v3, c): as das ofertas e as da stack.
    const all = [
      ...texts(overview).flatMap((t) => [t.en, t.pt].flat()),
      ...tags,
      ...tags.map((t) => homeTagLabel('pt', t)),
    ].map(String)
    expect(all.length).toBeGreaterThan(80)
    expect(all.filter((s) => PROIBIDOS.some((re) => re.test(s)))).toEqual([])
  })

  it('as etiquetas da home em português: nenhuma em inglês, e nenhuma tradução sobrando ou repetida', () => {
    // Nome de ferramenta fica como está; conceito e habilidade traduzem (A9: "RAG and embeddings" e "Evals" ficavam).
    const ingles = /\b(and|testing|leadership|observability|evals|hiring|mentoring|agents?)\b/i
    expect(tags.map((t) => homeTagLabel('pt', t)).filter((l) => ingles.test(l))).toEqual([])
    const home = Object.keys(tagDictionaries.home)
    expect(home.filter((t) => !tags.includes(t))).toEqual([])
    // A tradução de uma etiqueta que a trajetória também usa mora no dicionário dela, a mesma nas duas páginas.
    expect(home.filter((t) => t in tagDictionaries.concepts || t in tagDictionaries.skills)).toEqual([])
  })
})
