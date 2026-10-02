/**
 * A linha do tempo da página /journey: um checkpoint por marco, em inglês (o site) e em português, com camada de
 * "bater o olho" (datas, título, subtítulo, frase, conquistas e tags) e camada de detalhe (o corpo, que abre com um
 * clique). Conteúdo em journey.json; a fonte de cada checkpoint fica fora do repositório público
 * (.wai/trajetoria/fontes.json, pelo id). Requisitos J24–J37 em .wai/trajetoria/REQUISITOS.md.
 * Vai no pedaço da rota /journey (src/routes.ts) e no HTML dela, gerado no build: o herói não o baixa.
 */
import type { Lang } from '../../shared/i18n'
import { MESSAGES } from '../i18n/lang'
import { hasTagLabel } from '../i18n/tags'
import data from './journey.json'
import { stages, type StageId } from './journey'

export type Text = Record<Lang, string>
type TextList = Record<Lang, string[]>

export interface Checkpoint {
  id: string
  /** Posição na página (a ordem do JSON não vale; vale esta). */
  order: number
  part: 'prologue' | 'story'
  /** Marco de peso (J52): ocupa a largura do mapa e vem com mais destaque. */
  focus?: boolean
  /** Vida do herói que começa aqui: vira a âncora /journey#<vida> e dá a cor ao que vem depois. */
  life?: StageId
  /** Mês ("2023-06") ou ano ("2020"); "present" no fim. `text` quando nenhuma fonte dá a data exata. */
  period?: { start?: string; end?: string; text?: Text }
  /** Organização ou assunto. */
  title: Text
  /** Papel. */
  subtitle?: Text
  /** Uma frase: o que aconteceu. Quem só bate o olho lê isto. */
  headline: Text
  /** Conquistas, em poucas linhas. */
  highlights?: TextList
  /** A história, parágrafo a parágrafo: abre com um clique. */
  body: TextList
  tags?: { tools?: string[]; concepts?: string[]; skills?: string[] }
  link?: { label: Text; href: string }
}

const LIVES = new Set<string>(stages.map((s) => s.id))
const PARTS = new Set<string>(['prologue', 'story'])
const MONTH = /^\d{4}(-\d{2})?$/

/** Confere o JSON ao carregar: dado errado derruba o build e o teste (journey-timeline.test.ts), não sai na página. */
function check(c: Checkpoint): Checkpoint {
  const where = `journey.json, ${c.id}`
  if (!PARTS.has(c.part)) throw new Error(`${where}: part inválido`)
  if (c.life && !LIVES.has(c.life)) throw new Error(`${where}: vida desconhecida ${c.life}`)
  for (const d of [c.period?.start, c.period?.end]) {
    if (d && d !== 'present' && !MONTH.test(d)) throw new Error(`${where}: data inválida ${d}`)
  }
  for (const t of [c.title, c.headline, c.subtitle, c.period?.text, c.link?.label]) {
    if (t && (!t.en || !t.pt)) throw new Error(`${where}: falta en ou pt`)
  }
  if (!c.body.en.length || c.body.en.length !== c.body.pt.length) throw new Error(`${where}: corpo en/pt desigual`)
  if (c.highlights && c.highlights.en.length !== c.highlights.pt.length) {
    throw new Error(`${where}: conquistas en/pt desiguais`)
  }
  checkTags(c, where)
  return c
}

/** Conceito ou habilidade sem tradução em src/i18n/messages/pt-tags.ts derruba o build (a página em pt a mostraria). */
function checkTags(c: Checkpoint, where: string) {
  for (const group of ['tools', 'concepts', 'skills'] as const) {
    const missing = (c.tags?.[group] ?? []).filter((t) => !hasTagLabel(group, t))
    if (missing.length) throw new Error(`${where}: tag sem tradução em pt-tags.ts: ${missing.join(', ')}`)
  }
}

export const checkpoints: Checkpoint[] = (data.checkpoints as Checkpoint[]).map(check).sort((a, b) => a.order - b.order)

export const intro: { lede: Text } = data.intro

function when(d: string, lang: Lang): string {
  const { months, present } = MESSAGES[lang].journey
  if (d === 'present') return present
  const [year, month] = d.split('-')
  return month ? `${months[Number(month) - 1] ?? ''} ${year ?? ''}` : (year ?? '')
}

/** "Jun 2023 – present" ("jun 2023 – hoje"), "2013 – 2017", "2025"; o texto livre quando a data não é exata. */
export function periodLabel(c: Checkpoint, lang: Lang): string | undefined {
  const p = c.period
  if (!p) return undefined
  if (p.text) return p.text[lang]
  const start = p.start ? when(p.start, lang) : undefined
  const end = p.end ? when(p.end, lang) : undefined
  if (start && end && start !== end) return `${start} – ${end}`
  return start ?? end
}
