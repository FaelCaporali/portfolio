import { LANGS, SITE_PAGES, type Lang } from '../../shared/i18n'
import { mcp } from '../content/mcp'
import { overview } from '../content/overview'
import { directContacts, profile, profileLinks, resumes, sourceHref } from '../content/profile'
import { MESSAGES } from '../i18n/lang'
import { pageText } from '../i18n/meta'
import { abs, mdUrl } from './markdown'

/**
 * O /llms.txt (llmstxt.org): H1 com o nome, o resumo em citação, quem é e como contratar, e as listas de links com
 * nota; "Optional" com o que o agente pode pular (as versões em português).
 */
export function llmsTxt(): string {
  const lang: Lang = 'en'
  const m = MESSAGES[lang]
  const pages = (l: Lang) =>
    SITE_PAGES.map((p) => `- [${pageText(l, p).title}](${mdUrl(l, p)}): ${pageText(l, p).description}`)
  return [
    `# ${profile.name}`,
    '',
    `> ${m.meta.home.description}`,
    '',
    `${m.hero.slots.ai} · ${m.hero.titles.join(' · ')} · ${overview.offers.facts[0]?.en ?? ''}`,
    overview.offers.lede[lang],
    overview.faq.items.map((f) => `${f.q[lang]} ${f.a[lang]}`).join(' '),
    '',
    '## Pages (markdown)',
    '',
    ...pages('en'),
    '',
    '## Hire or contact',
    '',
    ...directContacts.map((c) => `- [${c.label}](${c.href}): ${c.value}`),
    ...profileLinks.map((l) => `- [${l.label}](${l.href}): profile`),
    ...resumes.map((r) => `- [Résumé, ${r.label}](${abs(r.href)}): PDF`),
    '',
    '## MCP server',
    '',
    `- [${mcp.address}](${mcp.address}): Model Context Protocol server (Streamable HTTP, no sign-in) with ${mcp.tools.items.map((t) => t.name).join(', ')}`,
    `- [Connection guide](${mdUrl(lang, '/mcp')}): Claude, ChatGPT, Claude Code, Cursor and VS Code`,
    '',
    '## Optional',
    '',
    ...LANGS.filter((l) => l !== 'en').flatMap((l) => pages(l).map((p) => `${p} (Portuguese)`)),
    `- [Source code of this site](${sourceHref}): React Router, Cloudflare Workers, open source`,
    '',
  ].join('\n')
}
