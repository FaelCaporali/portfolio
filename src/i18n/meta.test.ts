import type { MetaDescriptor } from 'react-router'
import { describe, expect, it } from 'vitest'
import { SERVICE_PAGES } from '../../shared/i18n'
import { sitemapXml } from '../routes/sitemap'
import { pageMeta } from './meta'

const find = (meta: MetaDescriptor[], key: string, value: string) =>
  meta.find((d) => (d as Record<string, unknown>)[key] === value) as Record<string, string> | undefined

/** Os links de um rel; em "alternate", só os de idioma (hreflang), sem o da versão em markdown. */
const links = (meta: MetaDescriptor[], rel: string) =>
  (meta.filter((d) => 'tagName' in d && d.rel === rel) as unknown as Record<string, string>[]).filter(
    (l) => rel !== 'alternate' || l.hrefLang,
  )

/** Um nó do @graph do JSON-LD pelo @type. */
function graphNode(meta: MetaDescriptor[], type: string) {
  const ld = meta.find((d) => 'script:ld+json' in d) as { 'script:ld+json': { '@graph': Record<string, unknown>[] } }
  return ld['script:ld+json']['@graph'].find((n) => n['@type'] === type)
}

describe('metas por idioma', () => {
  it('inglês (sem prefixo): título, descrição e og como antes, canonical e alternates recíprocos', () => {
    const meta = pageMeta(undefined, 'journey')
    expect(find(meta, 'title', 'The full journey · Fael Caporali, AI Product Engineer')).toBeDefined()
    expect(find(meta, 'property', 'og:url')?.content).toBe('https://fael.caporali.dev/journey')
    expect(find(meta, 'property', 'og:locale')?.content).toBe('en_US')
    expect(find(meta, 'property', 'og:locale:alternate')?.content).toBe('pt_BR')
    expect(links(meta, 'canonical').map((l) => l.href)).toEqual(['https://fael.caporali.dev/journey'])
    expect(links(meta, 'alternate').map((l) => [l.hrefLang, l.href])).toEqual([
      ['en', 'https://fael.caporali.dev/journey'],
      ['pt-BR', 'https://fael.caporali.dev/pt/journey'],
      ['x-default', 'https://fael.caporali.dev/journey'],
    ])
  })

  it('português (/pt): tudo no idioma, canonical próprio, os mesmos alternates', () => {
    const meta = pageMeta('pt', 'home')
    expect(find(meta, 'title', 'Fael Caporali · AI Product Engineer e Dev Full-Stack')).toBeDefined()
    expect(find(meta, 'name', 'description')?.content).toMatch(/agentes de IA em produção/)
    expect(find(meta, 'property', 'og:locale')?.content).toBe('pt_BR')
    expect(links(meta, 'canonical').map((l) => l.href)).toEqual(['https://fael.caporali.dev/pt'])
    expect(links(meta, 'alternate').map((l) => l.hrefLang)).toEqual(['en', 'pt-BR', 'x-default'])
    expect(graphNode(meta, 'ProfilePage')?.inLanguage).toBe('pt-BR')
  })

  it('segmento que não é idioma: sem metas (a página é "Page not found")', () => {
    expect(pageMeta('xx', 'home')).toEqual([])
  })

  it('sitemap: as 7 páginas nos dois idiomas, cada uma com os 3 alternates e a imagem do idioma', () => {
    const xml = sitemapXml()
    expect([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])).toEqual([
      'https://fael.caporali.dev/',
      'https://fael.caporali.dev/pt',
      'https://fael.caporali.dev/journey',
      'https://fael.caporali.dev/pt/journey',
      'https://fael.caporali.dev/mcp',
      'https://fael.caporali.dev/pt/mcp',
      ...SERVICE_PAGES.flatMap((p) => [`https://fael.caporali.dev${p}`, `https://fael.caporali.dev/pt${p}`]),
    ])
    expect(xml.match(/<xhtml:link /g)).toHaveLength(42)
    expect(xml).not.toContain('<lastmod>')
    expect(xml).toContain('<image:loc>https://fael.caporali.dev/og/fael-caporali-pt.jpg</image:loc>')
  })

  it('/mcp: página sobre a pessoa (WebPage), não o perfil, com canonical e alternates próprios', () => {
    const meta = pageMeta('pt', 'mcp')
    expect(find(meta, 'title', 'Pergunte ao seu assistente de IA · Fael Caporali')).toBeDefined()
    expect(links(meta, 'canonical').map((l) => l.href)).toEqual(['https://fael.caporali.dev/pt/mcp'])
    expect(graphNode(meta, 'WebPage')).toBeDefined()
    expect(graphNode(meta, 'ProfilePage')).toBeUndefined()
  })

  it('página de oferta: título com a busca principal, descrição própria ≤ 160, WebPage com o serviço e o caminho de volta', () => {
    const meta = pageMeta('pt', '/services/ai-agents')
    expect(find(meta, 'title', 'Agentes de IA e consultoria de IA em BH · Fael Caporali')).toBeDefined()
    expect(find(meta, 'name', 'description')?.content?.length).toBeLessThanOrEqual(160)
    expect(links(meta, 'canonical').map((l) => l.href)).toEqual(['https://fael.caporali.dev/pt/services/ai-agents'])
    expect(graphNode(meta, 'Service')?.name).toBe('Produtos e agentes de IA em produção')
    expect(graphNode(meta, 'BreadcrumbList')).toBeDefined()
  })

  it.each(SERVICE_PAGES.flatMap((p) => [['en', p] as const, ['pt', p] as const]))(
    '%s %s: título ≤ 60 e descrição ≤ 160',
    (lang, page) => {
      const meta = pageMeta(lang === 'en' ? undefined : lang, page)
      const title = meta.find((d) => 'title' in d) as { title: string } | undefined
      expect(title?.title.length).toBeLessThanOrEqual(60)
      expect(find(meta, 'name', 'description')?.content?.length).toBeLessThanOrEqual(160)
    },
  )
})
