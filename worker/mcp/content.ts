/**
 * O que o MCP do portfólio responde: só o conteúdo público do site (journey.json, overview.json, profile.ts e os textos
 * do herói), em inglês ou português, cada item com o endereço da página onde ele está, para o assistente citar.
 * Funções puras, sem I/O: o servidor (server.ts) só as embrulha em ferramentas. Nada de .wai nem de fonte privada.
 */
import journey from '../../src/content/journey.json'
import overview from '../../src/content/overview.json'
import { directContacts, journeyPath, profile, profileLinks, resumes, sourceHref } from '../../src/content/profile'
import { stages } from '../../src/content/journey'
import { en } from '../../src/i18n/messages/en'
import { pt } from '../../src/i18n/messages/pt'
import { homeTagLabel, tagLabel, type TagGroup } from '../../src/i18n/tags'
import { localePath, SITE_ORIGIN, type Lang } from '../../shared/i18n'

type Text = Record<Lang, string>
type TextList = Record<Lang, string[]>

/** O marco como está em journey.json (o tipo da página, src/content/journey-timeline.ts, puxa o React junto). */
interface Checkpoint {
  id: string
  order: number
  part: string
  life?: string
  period?: { start?: string; end?: string; text?: Text }
  title: Text
  subtitle?: Text
  headline: Text
  highlights?: TextList
  body: TextList
  tags?: Partial<Record<TagGroup, string[]>>
  link?: { label: Text; href: string }
}

const TAG_GROUPS = ['tools', 'concepts', 'skills'] as const satisfies readonly TagGroup[]
export const PARTS = ['prologue', 'story'] as const
type Part = (typeof PARTS)[number]

const MESSAGES = { en, pt }
const checkpoints = (journey.checkpoints as Checkpoint[]).slice().sort((a, b) => a.order - b.order)

/** Quantos marcos têm cada etiqueta, por grupo, da mais citada para a menos (empate em ordem alfabética). */
const TAG_COUNTS = Object.fromEntries(
  TAG_GROUPS.map((g) => {
    const count = new Map<string, number>()
    for (const c of checkpoints) for (const t of c.tags?.[g] ?? []) count.set(t, (count.get(t) ?? 0) + 1)
    return [g, [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))]
  }),
) as Record<TagGroup, [string, number][]>

/**
 * Os valores que existem em cada filtro (a chave em inglês, como no endereço da página). Vão no esquema de
 * search_journey como lista fechada: o assistente vê os seletores já no tools/list, sem chamar nada antes.
 */
export const TAG_VALUES = Object.fromEntries(TAG_GROUPS.map((g) => [g, TAG_COUNTS[g].map(([t]) => t)])) as Record<
  TagGroup,
  string[]
>

const pageUrl = (lang: Lang, path: string) => `${SITE_ORIGIN}${localePath(lang, path)}`

/** O marco em que uma vida do herói começa tem o id da vida na página (/journey#qa); os outros, o próprio id. */
const checkpointUrl = (lang: Lang, c: Checkpoint) => `${pageUrl(lang, journeyPath)}#${c.life ?? c.id}`

/**
 * Um marco citado pela home, pelo id em journey.json (a mesma âncora de LIFE_ANCHORS em src/content/overview.ts, que
 * puxa o React e fica fora do Worker). Id que não existe cai no início da trajetória.
 */
function journeyIdUrl(lang: Lang, journeyId: string) {
  const c = checkpoints.find((x) => x.id === journeyId)
  return c ? checkpointUrl(lang, c) : pageUrl(lang, journeyPath)
}

/** Sem acento e em minúsculas: "Gestão" acha "gestao", "React" acha "react". */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * Os anos que cada marco cobre, para o filtro de período. A mesma regra de date() em src/features/journey/layout.ts
 * (a página): sem início conhecido, o marco começa onde o anterior começou; "present" é o ano corrente. O ano vem de
 * quem chama: no Worker, `new Date()` fora de uma requisição devolve 1970.
 */
export function yearRanges(year: number): Map<string, { from: number; to: number }> {
  const num = (d?: string) => (d && d !== 'present' ? Number(d.slice(0, 4)) : undefined)
  const ranges = new Map<string, { from: number; to: number }>()
  let prev = { from: year, to: year }
  for (const c of checkpoints) {
    const first = num(c.period?.start)
    const from = first ?? prev.from
    const end = c.period?.end === 'present' ? year : num(c.period?.end)
    const to = end ?? (first === undefined ? prev.to : from)
    prev = { from, to }
    ranges.set(c.id, prev)
  }
  return ranges
}

const period = (lang: Lang, c: Checkpoint) =>
  c.period && {
    start: c.period.start ?? null,
    end: c.period.end ?? null,
    ...(c.period.text ? { note: c.period.text[lang] } : {}),
  }

const tagsOf = (lang: Lang, c: Checkpoint) =>
  Object.fromEntries(TAG_GROUPS.map((g) => [g, (c.tags?.[g] ?? []).map((t) => tagLabel(lang, g, t))]))

/** O resumo de um marco: o que quem só bate o olho na página lê. */
function summary(lang: Lang, c: Checkpoint) {
  return {
    id: c.id,
    part: c.part,
    period: period(lang, c),
    title: c.title[lang],
    subtitle: c.subtitle?.[lang],
    headline: c.headline[lang],
    tags: tagsOf(lang, c),
    url: checkpointUrl(lang, c),
  }
}

/** Quem é o Fael: títulos, vidas de hoje, ofertas, contatos, links e currículos. */
export function getProfile(lang: Lang) {
  const m = MESSAGES[lang]
  return {
    name: profile.name,
    titles: m.hero.titles,
    today: stages.filter((s) => !s.past).map((s) => m.hero.slots[s.id]),
    summary: journey.intro.lede[lang],
    offers: overview.offers.items.map((o) => ({
      title: o.title[lang],
      text: o.text[lang],
      tags: o.tags.map((t) => homeTagLabel(lang, t)),
      proof: o.proof.map((p) => ({ text: p[lang], url: journeyIdUrl(lang, p.journeyId) })),
    })),
    facts: overview.offers.facts.map((f) => f[lang]),
    contacts: directContacts.map((c) => ({ kind: c.kind, value: c.value, url: c.href })),
    links: [...profileLinks, { label: 'Source code', href: sourceHref }].map((l) => ({ label: l.label, url: l.href })),
    resumes: resumes.map((r) => ({ language: r.label, url: `${SITE_ORIGIN}${r.href}` })),
    pages: { home: pageUrl(lang, '/'), journey: pageUrl(lang, journeyPath) },
  }
}

/** Os valores que search_journey aceita, com quantos marcos têm cada um, e os anos e partes da trajetória. */
export function listFilters(lang: Lang, year: number) {
  const ranges = [...yearRanges(year).values()]
  const groups = Object.fromEntries(
    TAG_GROUPS.map((g) => [
      g,
      TAG_COUNTS[g].map(([value, n]) => ({ value, label: tagLabel(lang, g, value), count: n })),
    ]),
  )
  return {
    ...groups,
    parts: PARTS.map((p) => ({ value: p, count: checkpoints.filter((c) => c.part === p).length })),
    years: { from: Math.min(...ranges.map((r) => r.from)), to: Math.max(...ranges.map((r) => r.to)) },
    page: pageUrl(lang, journeyPath),
  }
}

export interface SearchInput {
  lang: Lang
  tools?: string[]
  concepts?: string[]
  skills?: string[]
  from?: number
  to?: number
  part?: Part
  text?: string
}

/** Palavras sem acento e em minúsculas: "Gestão de QA" → gestao, de, qa. */
const wordsOf = (s: string) =>
  fold(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

/** Palavras da busca por texto: as 10 primeiras distintas (cada uma percorre as palavras de todos os marcos). */
export const MAX_TEXT_WORDS = 10

/**
 * As palavras de cada marco nos dois idiomas, sem repetição: quem pergunta em inglês sobre a página em português também
 * acha. Montadas na primeira busca do isolate e guardadas (dobrar ~80 KB de texto por chamada custava metade da CPU).
 */
const vocabularies = new Map<string, string[]>()
function vocabulary(c: Checkpoint): string[] {
  const cached = vocabularies.get(c.id)
  if (cached) return cached
  const words = [
    ...new Set(
      (['en', 'pt'] as const).flatMap((l) =>
        wordsOf(
          [
            c.title[l],
            c.subtitle?.[l] ?? '',
            c.headline[l],
            ...(c.highlights?.[l] ?? []),
            ...c.body[l],
            ...TAG_GROUPS.flatMap((g) => (c.tags?.[g] ?? []).map((t) => tagLabel(l, g, t))),
          ].join('\n'),
        ),
      ),
    ),
  ]
  vocabularies.set(c.id, words)
  return words
}

/**
 * Palavra curta (até 3 letras: ai, qa, go, ui) casa só inteira, senão "ai" acharia "mais", "said" e "email"; a partir
 * de 4 letras casa também o começo de palavra ("agent" acha "agents", "automat" acha "automation").
 */
const matchesWord = (vocab: string[], w: string) =>
  w.length < 4 ? vocab.includes(w) : vocab.some((v) => v.startsWith(w))

/**
 * Os marcos que passam no filtro, na ordem da trajetória. A regra da página (src/features/journey/useFilters.ts):
 * dentro de um grupo vale qualquer uma das etiquetas, entre grupos valem todos, e o período vale por sobreposição.
 * As etiquetas chegam exatas: o esquema da ferramenta só aceita os valores de TAG_VALUES.
 */
export function searchJourney(input: SearchInput, year: number) {
  const { lang } = input
  const chosen = Object.fromEntries(TAG_GROUPS.map((g) => [g, new Set(input[g])])) as Record<TagGroup, Set<string>>
  const ranges = yearRanges(year)
  const from = input.from ?? -Infinity
  const to = input.to ?? Infinity
  const words = [...new Set(wordsOf(input.text ?? ''))].slice(0, MAX_TEXT_WORDS)

  const results = checkpoints.filter((c) => {
    const r = ranges.get(c.id)
    if (r && (r.to < from || r.from > to)) return false
    if (input.part && c.part !== input.part) return false
    if (!TAG_GROUPS.every((g) => !chosen[g].size || (c.tags?.[g] ?? []).some((t) => chosen[g].has(t)))) return false
    if (!words.length) return true
    const vocab = vocabulary(c)
    return words.every((w) => matchesWord(vocab, w))
  })

  // A mesma busca na página, para mandar a quem pediu (o filtro da página não tem parte nem texto livre).
  const query = new URLSearchParams()
  if (input.from !== undefined) query.set('from', String(input.from))
  if (input.to !== undefined) query.set('to', String(input.to))
  for (const g of TAG_GROUPS) for (const t of chosen[g]) query.append(g, t)
  const search = query.size ? '?' + query.toString() : ''

  return {
    total: results.length,
    page_url: pageUrl(lang, journeyPath) + search,
    results: results.map((c) => summary(lang, c)),
  }
}

/** Um marco inteiro, pelo id do marco ou pela âncora de uma vida do herói (ai, qa, techlead…). */
export function getCheckpoint(lang: Lang, id: string) {
  const c = checkpoints.find((x) => x.id === id) ?? checkpoints.find((x) => x.life === id)
  if (!c) return undefined
  return {
    ...summary(lang, c),
    highlights: c.highlights?.[lang] ?? [],
    body: c.body[lang],
    ...(c.link ? { link: { label: c.link.label[lang], url: c.link.href } } : {}),
  }
}

/** Os ids existentes, para a mensagem de erro de um id que não existe. */
export const checkpointIds = () => checkpoints.map((c) => c.id)

/** O que a home mostra abaixo do herói: o que já entreguei, a stack resumida e as perguntas frequentes. */
export function getDelivered(lang: Lang) {
  return {
    story: overview.experience.story[lang],
    delivered: overview.experience.items.map((x) => ({
      context: x.context[lang],
      role: x.role[lang],
      results: x.results[lang],
      url: journeyIdUrl(lang, x.journeyId),
    })),
    stack: overview.stack.groups.map((g) => ({
      group: g.label[lang],
      items: g.items.map((t) => homeTagLabel(lang, t)),
    })),
    faq: overview.faq.items.map((f) => ({ question: f.q[lang], answer: f.a[lang] })),
    page: `${pageUrl(lang, '/')}#overview`,
  }
}
