/** Detecção de idioma na primeira visita: quem prefere português vai para /pt; o resto fica no inglês. */
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { call, ORIGIN } from './helpers'

/** Assets de mentira: toda página existe e é HTML (a detecção roda antes deles; o que passa, sai daqui). */
const withPages = {
  ...env,
  ASSETS: {
    fetch: () =>
      Promise.resolve(
        new Response('<!doctype html><html><body></body></html>', { headers: { 'Content-Type': 'text/html' } }),
      ),
  },
} as unknown as Env

const HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

function page(path: string, headers: Record<string, string> = {}) {
  return call(new Request(`${ORIGIN}${path}`, { headers: { Accept: HTML, ...headers } }), withPages)
}

describe('detecção de idioma (Worker)', () => {
  it('pt-BR sem cookie em / → 302 para /pt, com a query e o Vary', async () => {
    const r = await page('/?slot=vela', { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' })
    expect(r.status).toBe(302)
    expect(r.headers.get('Location')).toBe(`${ORIGIN}/pt?slot=vela`)
    expect(r.headers.get('Vary')).toBe('Accept-Language, Cookie')
  })

  it('pt-BR em /journey → /pt/journey, com os filtros', async () => {
    const r = await page('/journey?tools=React&from=2023', { 'Accept-Language': 'pt-BR' })
    expect(r.status).toBe(302)
    expect(r.headers.get('Location')).toBe(`${ORIGIN}/pt/journey?tools=React&from=2023`)
  })

  it('en → 200, a página em inglês, com o Vary', async () => {
    const r = await page('/', { 'Accept-Language': 'en-US,en;q=0.9' })
    expect(r.status).toBe(200)
    expect(r.headers.get('Location')).toBeNull()
    // Na home (só nela) o Vary também leva User-Agent (decisão 10, 03-plano-versao-robos.md): a resposta depende do
    // User-Agent desde que a variante dos robôs existe (worker/index.ts, sitePage).
    expect(r.headers.get('Vary')).toBe('Accept-Language, Cookie, User-Agent')
  })

  it('pt com cookie lang=en (a escolha manual) → 200', async () => {
    const r = await page('/journey', { 'Accept-Language': 'pt-BR', Cookie: 'outro=1; lang=en' })
    expect(r.status).toBe(200)
  })

  it('/pt com navegador em inglês → 200 (link compartilhado vale)', async () => {
    const r = await page('/pt', { 'Accept-Language': 'en-US' })
    expect(r.status).toBe(200)
    const j = await page('/pt/journey', { 'Accept-Language': 'en-US', Cookie: 'lang=en' })
    expect(j.status).toBe(200)
  })

  it('"fr, pt;q=0.5" → pt: o primeiro idioma suportado decide', async () => {
    const r = await page('/', { 'Accept-Language': 'fr, pt;q=0.5' })
    expect(r.headers.get('Location')).toBe(`${ORIGIN}/pt`)
  })

  it('q fora de ordem: "en;q=0.3, pt-BR;q=0.8" → pt; "pt;q=0.2, en" → en', async () => {
    expect((await page('/', { 'Accept-Language': 'en;q=0.3, pt-BR;q=0.8' })).status).toBe(302)
    expect((await page('/', { 'Accept-Language': 'pt;q=0.2, en' })).status).toBe(200)
  })

  it('vinda do próprio site (EN clicado antes da hidratação) → 200, sem redirect', async () => {
    const r = await page('/', { 'Accept-Language': 'pt-BR', 'Sec-Fetch-Site': 'same-origin' })
    expect(r.status).toBe(200)
  })

  it('robô sem Accept-Language → inglês', async () => {
    expect((await page('/')).status).toBe(200)
  })

  it('pedido que não é página HTML → sem redirect', async () => {
    const r = await call(
      new Request(`${ORIGIN}/`, { headers: { Accept: 'application/json', 'Accept-Language': 'pt-BR' } }),
      withPages,
    )
    expect(r.status).toBe(200)
    const post = await call(
      new Request(`${ORIGIN}/`, { method: 'POST', headers: { Accept: HTML, 'Accept-Language': 'pt-BR' } }),
      withPages,
    )
    expect(post.headers.get('Location')).toBeNull()
  })

  it('endereço fora das páginas (sitemap, 404) → sem redirect', async () => {
    const r = await page('/sitemap.xml', { 'Accept-Language': 'pt-BR' })
    expect(r.headers.get('Location')).toBeNull()
  })
})

describe('trajetória pedida com filtro (CLS)', () => {
  it.each(['/journey?tools=React', '/pt/journey?from=2023&skills=Mentoring'])(
    '%s: o <html> sai marcado para a lista esperar o filtro',
    async (path) => {
      const r = await page(path, { 'Accept-Language': path.startsWith('/pt') ? 'pt-BR' : 'en' })
      expect(r.status).toBe(200)
      expect(await r.text()).toContain('<html data-filtering="">')
    },
  )

  it.each(['/journey', '/journey?utm_source=x', '/?tools=React'])(
    '%s: sem filtro da trajetória, sem marca',
    async (p) => {
      const r = await page(p, { 'Accept-Language': 'en' })
      expect(await r.text()).not.toContain('data-filtering')
    },
  )
})
