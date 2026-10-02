import { describe, expect, it } from 'vitest'
import { NAMED_BOTS } from '../../shared/bots'
import { LANGS, markdownPath } from '../../shared/i18n'
import { checkpoints } from '../content/journey-timeline'
import { mcp } from '../content/mcp'
import { overview } from '../content/overview'
import { privacy } from '../content/privacy'
import { robotsTxt } from '../routes/robots'
import { llmsTxt } from './llms'
import { homeMarkdown, journeyMarkdown, mcpMarkdown, privacyMarkdown } from './markdown'

describe('markdown das páginas (llmstxt.org)', () => {
  it('endereços: o mesmo da página com .md; a home é index.md', () => {
    expect(markdownPath('en', '/')).toBe('/index.md')
    expect(markdownPath('pt', '/')).toBe('/pt/index.md')
    expect(markdownPath('en', '/journey')).toBe('/journey.md')
    expect(markdownPath('pt', '/mcp')).toBe('/pt/mcp.md')
  })

  it.each(LANGS)('home em %s: ofertas com as provas, entregas, stack, FAQ e contatos', (lang) => {
    const md = homeMarkdown(lang)
    expect(md.startsWith('# Fael Caporali\n')).toBe(true)
    for (const o of overview.offers.items) {
      // O título leva à página da oferta: "### [título](…/services/….md)".
      expect(md).toContain(`### [${o.title[lang]}](`)
      for (const p of o.proof) expect(md).toContain(p[lang])
    }
    for (const e of overview.experience.items) for (const r of e.results[lang]) expect(md).toContain(r)
    for (const f of overview.faq.items) expect(md).toContain(f.a[lang])
    for (const g of overview.stack.groups) expect(md).toContain(g.items.join(', '))
    expect(md).toContain('fael@caporali.dev')
  })

  it.each(LANGS)('trajetória em %s: todos os marcos, com a história inteira e o link da âncora', (lang) => {
    const md = journeyMarkdown(lang)
    for (const c of checkpoints) {
      expect(md).toContain(`### ${c.title[lang]}`)
      for (const p of c.body[lang]) expect(md).toContain(p)
      expect(md).toContain(`#${c.life ?? c.id}\n`)
    }
  })

  it.each(LANGS)('/mcp em %s: endereço, ferramentas e o que fica registrado', (lang) => {
    const md = mcpMarkdown(lang)
    expect(md).toContain(mcp.address)
    for (const t of mcp.tools.items) expect(md).toContain(`\`${t.name}\`: ${t.text[lang]}`)
    for (const i of mcp.log.neverItems) expect(md).toContain(i[lang])
  })

  it.each(LANGS)('/privacy em %s: cada seção e cada item da página, com o endereço da /mcp', (lang) => {
    const md = privacyMarkdown(lang)
    for (const sec of privacy.sections) {
      expect(md).toContain(`## ${sec.title[lang]}`)
      for (const i of sec.items) expect(md).toContain(i[lang])
    }
    expect(md).toContain(`https://fael.caporali.dev${lang === 'pt' ? '/pt' : ''}/mcp`)
  })

  it('llms.txt no formato da spec: H1, resumo em citação, seções H2 com links "[nome](url): nota", Optional no fim', () => {
    const txt = llmsTxt()
    const lines = txt.split('\n')
    expect(lines[0]).toBe('# Fael Caporali')
    expect(lines[2]?.startsWith('> ')).toBe(true)
    // Nenhum outro H1, e nenhum título abaixo de H2 (a spec só tem H1 e as seções H2).
    expect(lines.filter((l) => l.startsWith('# '))).toHaveLength(1)
    expect(lines.some((l) => l.startsWith('###'))).toBe(false)
    const sections = lines.filter((l) => l.startsWith('## '))
    expect(sections.at(-1)).toBe('## Optional')
    for (const l of lines.filter((x) => x.startsWith('- ')))
      expect(l).toMatch(/^- \[[^\]]+\]\((https:\/\/|mailto:)[^)]+\)(: .+)?$/)
    for (const lang of LANGS) {
      for (const p of ['/', '/journey', '/mcp', '/privacy'])
        expect(txt).toContain(`https://fael.caporali.dev${markdownPath(lang, p)}`)
    }
    expect(txt).toContain(mcp.address)
  })
})

describe('robots.txt', () => {
  it('tudo liberado menos a API, cada robô de busca e de IA nomeado, o sitemap e só diretivas conhecidas', () => {
    const txt = robotsTxt()
    for (const bot of NAMED_BOTS) expect(txt).toContain(`User-agent: ${bot}\n`)
    expect(txt).not.toMatch(/Disallow: \/\s*$/m)
    expect(txt.match(/Disallow: \/api\//g)).toHaveLength(2)
    // Só o que o Lighthouse (e o Google) reconhecem: comentário, User-agent, Allow, Disallow e Sitemap.
    for (const line of txt.split('\n').filter((l) => l && !l.startsWith('#'))) {
      expect(line).toMatch(/^(User-agent|Allow|Disallow|Sitemap): /)
    }
    expect(txt).toContain('Sitemap: https://fael.caporali.dev/sitemap.xml')
  })
})
