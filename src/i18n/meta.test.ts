import type { MetaDescriptor } from 'react-router'
import { describe, expect, it } from 'vitest'
import { sitemapXml } from '../routes/sitemap'
import { pageMeta } from './meta'

const find = (meta: MetaDescriptor[], key: string, value: string) =>
  meta.find((d) => (d as Record<string, unknown>)[key] === value) as Record<string, string> | undefined

const links = (meta: MetaDescriptor[], rel: string) =>
  meta.filter((d) => 'tagName' in d && d.rel === rel) as unknown as Record<string, string>[]

describe('metas por idioma', () => {
  it('inglês (sem prefixo): título, descrição e og como antes, canonical e alternates recíprocos', () => {
    const meta = pageMeta(undefined, 'journey')
    expect(find(meta, 'title', 'The full journey · Fael Caporali')).toBeDefined()
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
    expect(find(meta, 'title', 'Fael Caporali')).toBeDefined()
    expect(find(meta, 'name', 'description')?.content).toMatch(/desenvolvedor full-stack sênior/)
    expect(find(meta, 'property', 'og:locale')?.content).toBe('pt_BR')
    expect(links(meta, 'canonical').map((l) => l.href)).toEqual(['https://fael.caporali.dev/pt'])
    expect(links(meta, 'alternate').map((l) => l.hrefLang)).toEqual(['en', 'pt-BR', 'x-default'])
    const ld = meta.find((d) => 'script:ld+json' in d) as { 'script:ld+json': { inLanguage: string } } | undefined
    expect(ld?.['script:ld+json'].inLanguage).toBe('pt-BR')
  })

  it('segmento que não é idioma: sem metas (a página é "Page not found")', () => {
    expect(pageMeta('xx', 'home')).toEqual([])
  })

  it('sitemap: os 4 endereços, cada um com os 3 alternates', () => {
    const xml = sitemapXml()
    expect([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])).toEqual([
      'https://fael.caporali.dev/',
      'https://fael.caporali.dev/pt',
      'https://fael.caporali.dev/journey',
      'https://fael.caporali.dev/pt/journey',
    ])
    expect(xml.match(/<xhtml:link /g)).toHaveLength(12)
  })
})
