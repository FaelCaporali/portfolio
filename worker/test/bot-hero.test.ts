/**
 * Camada 1 (03-plano-versao-robos.md, §2 e §4): o Worker troca a home por `/__hero-bot` (ou `/pt/__hero-bot`) para
 * quem não é pessoa, na MESMA URL; a rota interna nunca é um endereço navegável (404 em pedido direto, qualquer
 * User-Agent); o Vary leva User-Agent só onde há as duas variantes (a home).
 */
import { describe, expect, it } from 'vitest'
import { call, ORIGIN, t, useWorkerDoubles } from './helpers'

useWorkerDoubles()

const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36'

/** Assets de mentira: cada caminho entrega um corpo que diz quem ele é (não um build real). */
function envWithAssets(): Env {
  const fetch = (req: Request) => {
    const { pathname } = new URL(req.url)
    const robo = pathname === '/__hero-bot' || pathname === '/pt/__hero-bot'
    return Promise.resolve(
      new Response(`<!doctype html><html><body>${robo ? 'robo' : 'humano'}</body></html>`, {
        headers: { 'Content-Type': 'text/html' },
      }),
    )
  }
  return { ...t.env, ASSETS: { fetch } as unknown as Fetcher }
}

function page(path: string, ua: string) {
  return call(new Request(`${ORIGIN}${path}`, { headers: { Accept: 'text/html', 'User-Agent': ua } }), envWithAssets())
}

describe('variante dos robôs da home (camada 1)', () => {
  it('pedido direto à rota interna: 404, com UA humano ou de robô (nunca navegável, decisão 2)', async () => {
    for (const path of ['/__hero-bot', '/pt/__hero-bot']) {
      expect((await page(path, CHROME)).status).toBe(404)
      expect((await page(path, GOOGLEBOT)).status).toBe(404)
    }
  })

  it('UA de robô em / recebe a variante dos robôs, na mesma URL, com o Vary em User-Agent', async () => {
    const r = await page('/', GOOGLEBOT)
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('robo')
    expect(r.headers.get('Vary')).toContain('User-Agent')
  })

  it('UA de robô em /pt recebe a variante em português, na mesma URL', async () => {
    const r = await page('/pt', GOOGLEBOT)
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('robo')
  })

  it('UA humano em / e em /pt recebe a página de hoje, sem mudança', async () => {
    expect(await (await page('/', CHROME)).text()).toContain('humano')
    expect(await (await page('/pt', CHROME)).text()).toContain('humano')
  })

  it('/journey não tem variante: UA de robô recebe a mesma página, sem Vary em User-Agent', async () => {
    const r = await page('/journey', GOOGLEBOT)
    expect(await r.text()).toContain('humano')
    expect(r.headers.get('Vary')).not.toContain('User-Agent')
  })
})
