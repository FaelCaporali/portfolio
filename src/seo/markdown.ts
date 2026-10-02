/**
 * As páginas em markdown para assistentes de IA (llmstxt.org: "a clean markdown version of those pages at the same
 * URL", com .md) e o /llms.txt, gerados no build do mesmo conteúdo das páginas (overview.json, journey.json, mcp.ts,
 * as mensagens): nada escrito à mão aqui, nada que a página não mostre. Rotas de recurso pré-renderizadas
 * (src/routes/markdown.ts, src/routes/llms.ts).
 */
import { localePath, markdownPath, SITE_ORIGIN, type Lang, type SitePage } from '../../shared/i18n'
import { checkpoints, intro, periodLabel, type Checkpoint } from '../content/journey-timeline'
import { mcp } from '../content/mcp'
import { privacy } from '../content/privacy'
import { journeyHref, overview } from '../content/overview'
import { directContacts, journeyPath, profile, profileLinks, resumes, sourceHref } from '../content/profile'
import { serviceTools } from '../content/service-tools'
import { services, type Service } from '../content/services'
import { MESSAGES } from '../i18n/lang'
import { tagLabel } from '../i18n/tags'

const url = (lang: Lang, path: string) => `${SITE_ORIGIN}${localePath(lang, path)}`
export const abs = (href: string) => (href.startsWith('http') ? href : `${SITE_ORIGIN}${href}`)
export const mdUrl = (lang: Lang, path: string) => `${SITE_ORIGIN}${markdownPath(lang, path)}`
/** Os nomes de menu marcados com **negrito** no texto da /mcp já são markdown. */
const list = (items: string[]) => items.map((i) => `- ${i}`).join('\n')

/** O rodapé comum: contatos, perfis, currículos e a página HTML de origem. */
function contacts(lang: Lang, path: SitePage): string {
  const m = MESSAGES[lang]
  const pt = lang === 'pt'
  return [
    `## ${pt ? 'Contato' : 'Contact'}`,
    '',
    list([
      ...directContacts.map((c) => `${c.label}: [${c.value}](${c.href})`),
      ...profileLinks.map((l) => `[${l.label}](${l.href})`),
      ...resumes.map((r) => `${pt ? 'Currículo' : 'Résumé'} (${r.label}): ${abs(r.href)}`),
      `${m.hero.titlesLabel}: ${m.hero.titles.join(', ')}`,
      `${pt ? 'Código deste site' : 'Source of this site'}: ${sourceHref}`,
      `${pt ? 'Servidor MCP para assistentes de IA' : 'MCP server for AI assistants'}: ${mcp.address}`,
    ]),
    '',
    `${pt ? 'Página original' : 'Original page'}: ${url(lang, path)}`,
    '',
  ].join('\n')
}

/** A home: quem é, as ofertas com as provas, o que entregou, a stack e as perguntas frequentes. */
export function homeMarkdown(lang: Lang): string {
  const m = MESSAGES[lang]
  const { offers, experience, stack, faq, closing } = overview
  return [
    `# ${profile.name}`,
    '',
    `> ${m.meta.home.description}`,
    '',
    `${m.hero.slots.ai} · ${m.hero.titles.join(' · ')} · ${offers.facts[0]?.[lang] ?? ''}`,
    '',
    `## ${offers.title[lang]}`,
    '',
    offers.lede[lang],
    '',
    ...offers.items.flatMap((o, i) => [
      services[i] ? `### [${o.title[lang]}](${mdUrl(lang, services[i].path)})` : `### ${o.title[lang]}`,
      '',
      o.text[lang],
      '',
      list(
        o.proof.map(
          (p) => `${p[lang]} ([${lang === 'pt' ? 'a história' : 'the story'}](${abs(journeyHref(lang, p.journeyId))}))`,
        ),
      ),
      '',
    ]),
    list(offers.facts.map((f) => f[lang])),
    '',
    `## ${experience.title[lang]}`,
    '',
    ...experience.items.flatMap((e) => [
      `### ${e.context[lang]}`,
      '',
      `${e.role[lang]}. [${experience.story[lang]}](${abs(journeyHref(lang, e.journeyId))})`,
      '',
      list(e.results[lang]),
      '',
    ]),
    `## ${stack.title[lang]}`,
    '',
    list(stack.groups.map((g) => `${g.label[lang]}: ${g.items.join(', ')}`)),
    '',
    `## ${faq.title[lang]}`,
    '',
    ...faq.items.flatMap((f) => [`### ${f.q[lang]}`, '', f.a[lang], '']),
    `## ${closing.title[lang]}`,
    '',
    closing.text[lang],
    '',
    `[${m.hero.journeyLink} ${m.hero.journeyLinkTail}`.trimEnd() + `](${mdUrl(lang, journeyPath)})`,
    '',
    contacts(lang, '/'),
  ].join('\n')
}

/** O título da página da trajetória, como o h1 dela. */
const journeyTitle = (lang: Lang) => {
  const t = MESSAGES[lang].journey.title
  return `${t.before}${t.word}${t.after}`
}

function checkpointMarkdown(c: Checkpoint, lang: Lang): string {
  const m = MESSAGES[lang].journey
  const anchor = c.life ?? c.id
  const tags = (['tools', 'concepts', 'skills'] as const)
    .map((g) => {
      const items = c.tags?.[g] ?? []
      return items.length ? `${m.groups[g]}: ${items.map((t) => tagLabel(lang, g, t)).join(', ')}` : ''
    })
    .filter(Boolean)
  return [
    `### ${c.title[lang]}`,
    '',
    [periodLabel(c, lang), c.subtitle?.[lang]].filter(Boolean).join(' · '),
    '',
    `**${c.headline[lang]}**`,
    '',
    ...(c.highlights ? [list(c.highlights[lang]), ''] : []),
    ...c.body[lang].flatMap((p) => [p, '']),
    ...(tags.length ? [list(tags), ''] : []),
    ...(c.link ? [`[${c.link.label[lang]}](${c.link.href})`, ''] : []),
    `${lang === 'pt' ? 'Na página' : 'On the page'}: ${url(lang, journeyPath)}#${anchor}`,
    '',
  ].join('\n')
}

/** A trajetória inteira: a introdução e cada marco com período, papel, conquistas, a história e as tags. */
export function journeyMarkdown(lang: Lang): string {
  const m = MESSAGES[lang]
  const parts = ['prologue', 'story'] as const
  return [
    `# ${journeyTitle(lang)} · ${profile.name}`,
    '',
    `> ${m.meta.journey.description}`,
    '',
    intro.lede[lang],
    '',
    ...parts.flatMap((part) => [
      `## ${m.journey.parts[part]}`,
      '',
      ...checkpoints.filter((c) => c.part === part).map((c) => checkpointMarkdown(c, lang)),
    ]),
    contacts(lang, journeyPath),
  ].join('\n')
}

/** A /mcp: o endereço, exemplos, os passos de cada cliente, as ferramentas e o que fica registrado. */
/** O aviso de privacidade (/privacy): as seções da página, com o link da /mcp por extenso. */
export function privacyMarkdown(lang: Lang): string {
  return [
    `# ${privacy.title[lang]} · ${profile.name}`,
    '',
    `> ${MESSAGES[lang].meta.privacy.description}`,
    '',
    privacy.lede[lang],
    '',
    privacy.controller[lang],
    '',
    ...privacy.sections.flatMap((sec) => [
      `## ${sec.title[lang]}`,
      '',
      list(sec.items.map((i) => (i.link ? `${i[lang]} ${url(lang, i.link)}` : i[lang]))),
      '',
    ]),
    privacy.updated[lang],
    '',
  ].join('\n')
}

export function mcpMarkdown(lang: Lang): string {
  return [
    `# ${mcp.title[lang]} · ${profile.name}`,
    '',
    `> ${MESSAGES[lang].meta.mcp.description}`,
    '',
    mcp.lede[lang],
    '',
    `${mcp.addressLabel[lang]}: ${mcp.address}`,
    '',
    mcp.addressNote[lang],
    '',
    `## ${mcp.asks.title[lang]}`,
    '',
    list(mcp.asks.items.map((a) => `${a.q[lang]} (${a.tools.join(', ')})`)),
    '',
    `## ${mcp.clients.title[lang]}`,
    '',
    ...mcp.clients.items.flatMap((c) => [
      `### ${c.name}`,
      '',
      c.plans[lang],
      '',
      c.steps[lang].map((s, i) => `${i + 1}. ${s}`).join('\n'),
      '',
      `${mcp.clients.source[lang]}: ${c.source}`,
      '',
    ]),
    `## ${mcp.others.title[lang]}`,
    '',
    mcp.others.text[lang],
    '',
    ...mcp.others.items.flatMap((o) => [`### ${o.name} (${o.label})`, '', '```', o.code, '```', '']),
    `## ${mcp.tools.title[lang]}`,
    '',
    list(mcp.tools.items.map((t) => `\`${t.name}\`: ${t.text[lang]}`)),
    '',
    `## ${mcp.log.title[lang]}`,
    '',
    `${mcp.log.recorded[lang]}:`,
    '',
    list(mcp.log.items.map((i) => i[lang])),
    '',
    `${mcp.log.never[lang]}:`,
    '',
    list(mcp.log.neverItems.map((i) => i[lang])),
    '',
    contacts(lang, '/mcp'),
  ].join('\n')
}

/** Uma página de oferta: a oferta, as provas, o que foi entregue, as ferramentas, os fatos e as outras ofertas. */
function serviceMarkdown(service: Service, lang: Lang): string {
  const m = MESSAGES[lang]
  const { offer } = service
  const { experience, offers, closing } = overview
  const story = lang === 'pt' ? 'a história' : 'the story'
  return [
    `# ${offer.title[lang]} · ${profile.name}`,
    '',
    `> ${service.meta.description[lang]}`,
    '',
    offer.text[lang],
    '',
    list(offer.proof.map((p) => `${p[lang]} ([${story}](${abs(journeyHref(lang, p.journeyId))}))`)),
    '',
    ...(service.delivered.length
      ? [
          `## ${experience.title[lang]}`,
          '',
          ...service.delivered.flatMap((e) => [
            `### ${e.context[lang]}`,
            '',
            `${e.role[lang]}. [${experience.story[lang]}](${abs(journeyHref(lang, e.journeyId))})`,
            '',
            list(e.results[lang]),
            '',
          ]),
        ]
      : []),
    `## ${m.journey.groups.tools}`,
    '',
    serviceTools(service).join(', '),
    '',
    `## ${closing.title[lang]}`,
    '',
    closing.text[lang],
    '',
    list(offers.facts.map((f) => f[lang])),
    '',
    `## ${offers.title[lang]}`,
    '',
    list(
      services
        .filter((s) => s.path !== service.path)
        .map((s) => `[${s.offer.title[lang]}](${mdUrl(lang, s.path)}): ${s.offer.text[lang]}`),
    ),
    '',
    contacts(lang, service.path),
  ].join('\n')
}

const PAGES: Record<SitePage, (lang: Lang) => string> = {
  '/': homeMarkdown,
  '/journey': journeyMarkdown,
  '/mcp': mcpMarkdown,
  '/privacy': privacyMarkdown,
  ...(Object.fromEntries(services.map((s) => [s.path, (lang: Lang) => serviceMarkdown(s, lang)])) as Record<
    Service['path'],
    (lang: Lang) => string
  >),
}

/** O markdown de uma página num idioma (a rota /journey.md, /pt/index.md...). */
export const pageMarkdown = (lang: Lang, path: SitePage) => PAGES[path](lang)
