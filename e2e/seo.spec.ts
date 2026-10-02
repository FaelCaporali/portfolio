import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * SEO e GEO no HTML que o servidor entrega (sem JavaScript, como buscadores e robôs de IA leem): as metas da F1, o
 * @graph da F2, o robots, o sitemap, o llms.txt e as versões .md (.wai/seo-geo/04-plano.md). Só pedidos HTTP, sem abrir
 * página (rápido nos dois projetos).
 */

const SERVICES = [
  '/services/ai-agents',
  '/services/mvp-to-scalable-product',
  '/services/qa-and-test-automation',
  '/services/tech-leadership',
]
const PAGES = [
  '/',
  '/journey',
  '/mcp',
  '/privacy',
  '/pt',
  '/pt/journey',
  '/pt/mcp',
  '/pt/privacy',
  ...SERVICES,
  ...SERVICES.map((p) => `/pt${p}`),
]
const ORIGIN = 'https://fael.caporali.dev'

const attr = (html: string, re: RegExp) => re.exec(html)?.[1]
const meta = (html: string, key: 'name' | 'property', value: string) =>
  attr(html, new RegExp(`<meta ${key}="${value.replace(/[.:]/g, '\\$&')}" content="([^"]*)"`))
const decode = (s: string) =>
  s
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
/** O HTML sem os <script> (cortados pelo índice, sem regex de retrocesso). */
function withoutScripts(html: string) {
  let out = ''
  let at = 0
  for (let start = html.indexOf('<script', at); start !== -1; start = html.indexOf('<script', at)) {
    out += html.slice(at, start)
    const end = html.indexOf('</script>', start)
    at = end === -1 ? html.length : end + '</script>'.length
  }
  return out + html.slice(at)
}
/** Cada tag vira um espaço. */
function withoutTags(html: string) {
  let out = ''
  let inTag = false
  for (const ch of html) {
    if (ch === '<') inTag = true
    else if (ch === '>') {
      inTag = false
      out += ' '
    } else if (!inTag) out += ch
  }
  return out
}
/** O texto visível do corpo: sem scripts, sem tags. */
const bodyText = (html: string) =>
  decode(withoutTags(withoutScripts(html.split('<body')[1] ?? '')).replace(/\s+/g, ' '))

type GraphNode = Record<string, unknown>
function strings(v: unknown): string[] {
  if (typeof v === 'string') return [v]
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/**
 * O que o @graph afirma e a página tem de mostrar: da pessoa, cargos, stack e a descrição; da empresa, a descrição e
 * cada serviço (nome, descrição e tipos); da página de oferta, o serviço. Ficam de fora identificadores e endereços
 * (url, @id, imagem, e-mail e telefone, que a página mostra em outro formato).
 */
function visibleClaims(graph: GraphNode[]): string[] {
  const out: string[] = []
  const service = (s: GraphNode) => {
    out.push(...strings(s.name), ...strings(s.description))
    out.push(...strings(s.serviceType).flatMap((t) => t.split(', ')))
  }
  for (const n of graph) {
    if (n['@type'] === 'Person' && n.jobTitle) {
      out.push(...strings(n.jobTitle), ...strings(n.knowsAbout), ...strings(n.description))
      out.push(...strings((n.homeLocation as GraphNode | undefined)?.name))
    }
    if (n['@type'] === 'ProfessionalService') {
      out.push(...strings(n.name), ...strings(n.description))
      const catalog = n.hasOfferCatalog as { name: string; itemListElement: { itemOffered: GraphNode }[] }
      out.push(catalog.name)
      for (const o of catalog.itemListElement) service(o.itemOffered)
    }
    if (n['@type'] === 'Service') service(n)
  }
  return out.map(decode)
}

async function get(request: APIRequestContext, path: string) {
  const r = await request.get(path)
  expect(r.status(), path).toBe(200)
  return { text: await r.text(), type: r.headers()['content-type'] ?? '' }
}

test.describe('SEO no HTML entregue', () => {
  for (const path of PAGES) {
    test(`metas e dados estruturados de ${path}`, async ({ request }) => {
      const { text: html } = await get(request, path)
      const title = decode(attr(html, /<title>([^<]*)<\/title>/) ?? '')
      expect(title.length, 'title').toBeGreaterThan(10)
      expect(title.length, 'title ≤ 60').toBeLessThanOrEqual(60)
      const description = decode(meta(html, 'name', 'description') ?? '')
      expect(description.length, 'description ≤ 160').toBeLessThanOrEqual(160)
      expect(description.length).toBeGreaterThan(50)
      for (const name of ['keywords', 'author', 'robots', 'twitter:card', 'twitter:image', 'twitter:image:alt']) {
        expect(meta(html, 'name', name), name).toBeTruthy()
      }
      expect(meta(html, 'name', 'robots')).toContain('max-image-preview:large')
      for (const p of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'og:locale', 'og:type']) {
        expect(meta(html, 'property', p), p).toBeTruthy()
      }
      expect(meta(html, 'property', 'og:url')).toBe(`${ORIGIN}${path}`)
      expect(attr(html, /<link rel="canonical" href="([^"]*)"/)).toBe(`${ORIGIN}${path}`)
      expect(html.match(/<link rel="alternate" hrefLang=/g)).toHaveLength(3)
      expect(html).toMatch(/<link rel="alternate" type="text\/markdown"/)

      // Um h1, com conteúdo de verdade: nunca só "loading".
      const h1s = [...html.matchAll(/<h1[\s\S]*?<\/h1>/g)].map((m) => bodyText(`<body>${m[0]}`).trim())
      expect(h1s).toHaveLength(1)
      expect(h1s[0]).not.toMatch(/^(Today I am|Hoje estou) (loading|carregando)$/)

      // O @graph: JSON válido, com o site e a pessoa; o que ele afirma aparece no texto da página.
      const ld = attr(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
      const graph = (JSON.parse(ld ?? '{}') as { '@graph': Record<string, unknown>[] })['@graph']
      const types = graph.map((n) => n['@type'])
      expect(types).toContain('WebSite')
      expect(types).toContain('Person')
      const text = bodyText(html)
      expect(text).toContain('Fael Caporali')
      // A frase do herói no HTML é a vida de abertura (D-SEO7); o "loading" existe só na tela, desenhado pelo CSS.
      if (path === '/' || path === '/pt') {
        expect(text).toContain(path === '/' ? 'Today I am an AI Product Engineer' : 'Hoje sou AI Product Engineer')
        expect(text).not.toMatch(/Today I am loading|Hoje estou carregando/)
      }
      const faq = graph.find((n) => n['@type'] === 'FAQPage') as
        { mainEntity: { name: string; acceptedAnswer: { text: string } }[] } | undefined
      for (const q of faq?.mainEntity ?? []) {
        expect(text).toContain(q.name)
        expect(text).toContain(q.acceptedAnswer.text)
      }
      if (path === '/' || path === '/pt') expect(faq?.mainEntity.length).toBeGreaterThan(0)
      // Regra do Google: o que o dado estruturado afirma está no texto da página (F2).
      for (const claim of visibleClaims(graph)) expect(text, claim).toContain(claim)

      // A imagem de compartilhamento existe e é a do idioma.
      const image = meta(html, 'property', 'og:image') ?? ''
      expect(image).toMatch(path.startsWith('/pt') ? /-pt\.jpg$/ : /-en\.jpg$/)
      const img = await request.get(image.replace(ORIGIN, ''))
      expect(img.status(), image).toBe(200)
    })
  }

  test('robots.txt, sitemap.xml, llms.txt e as versões .md', async ({ request }) => {
    const robots = await get(request, '/robots.txt')
    expect(robots.text).toContain('User-agent: OAI-SearchBot')
    expect(robots.text).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`)
    const sitemap = await get(request, '/sitemap.xml')
    expect(sitemap.text.match(/<loc>/g)).toHaveLength(PAGES.length)
    const llms = await get(request, '/llms.txt')
    expect(llms.text.startsWith('# Fael Caporali\n')).toBe(true)
    const mds = ['/index.md', '/journey.md', '/mcp.md', '/pt/index.md', '/pt/journey.md', '/pt/mcp.md']
    for (const md of [...mds, ...PAGES.filter((p) => p.includes('/services/')).map((p) => `${p}.md`)]) {
      const page = await get(request, md)
      expect(page.type, md).toContain('text/markdown')
      expect(page.text.startsWith('# '), md).toBe(true)
      expect(llms.text).toContain(`${ORIGIN}${md}`)
    }
  })
})
