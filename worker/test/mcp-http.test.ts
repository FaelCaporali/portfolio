/**
 * O /mcp pelo lado HTTP: Origin de outra página, teto do corpo, o endereço workers.dev (fora do Bot Fight Mode) e as
 * requisições de navegador que vão para a página do site.
 */
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { createExecutionContext } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { mcp } from '../../src/content/mcp'
import worker from '../index'
import { fetchWorker, MCP_URL, open } from './mcp-client'

describe('HTTP', () => {
  /** O cliente oficial com uma Origin fixa em toda requisição (o que um navegador mandaria). */
  async function connectFrom(origin: string) {
    const client = new Client({ name: 'teste-portfolio', version: '1.0.0' })
    const withOrigin = (url: string | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      headers.set('Origin', origin)
      return fetchWorker(url, { ...init, headers })
    }
    await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL), { fetch: withOrigin }))
    open.push(client)
    return client
  }

  it('outra página no navegador (Origin de fora) é recusada; a do próprio site conecta e lista', async () => {
    await expect(connectFrom('https://evil.example')).rejects.toThrow(/403|Forbidden/)
    const site = await connectFrom('https://fael.caporali.dev')
    expect((await site.listTools()).tools).toHaveLength(7)
  })

  it('workers.dev: o MCP conecta lá; página, contato e o resto vão com 301 para o site', async () => {
    const dev = 'https://fael-caporali.rafaelhon.workers.dev'
    const client = new Client(
      { name: 'teste-portfolio', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    )
    await client.connect(new StreamableHTTPClientTransport(new URL(`${dev}/mcp`), { fetch: fetchWorker }))
    open.push(client)
    expect((await client.listTools()).tools).toHaveLength(7)

    for (const [path, init] of [
      ['/', {}],
      ['/pt/journey?tools=React', {}],
      ['/mcp', { headers: { Accept: 'text/html' } }],
      ['/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }],
    ] as const) {
      const r = await fetchWorker(`${dev}${path}`, { ...init, redirect: 'manual' })
      expect(r.status, path).toBe(301)
      expect(r.headers.get('Location'), path).toBe(`https://fael.caporali.dev${path}`)
      // O 301 vai para cache: em /mcp, separado pelo Accept do servidor MCP no mesmo endereço; no resto, sem Vary.
      expect(r.headers.get('Vary'), path).toBe(path === '/mcp' ? 'Accept' : null)
    }
  })

  it('corpo acima de 64 KiB é recusado antes de qualquer leitura (413), mesmo sem Content-Length', async () => {
    const big = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { pad: 'x'.repeat(65 * 1024) } })
    const stream = new Blob([big]).stream()
    const r = await fetchWorker(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: stream,
      duplex: 'half',
    } as RequestInit)
    expect(r.status).toBe(413)
  })

  it('navegador, prévia de link e HEAD em /mcp recebem a página do site, não o servidor MCP', async () => {
    const page = '<!doctype html><title>pagina</title>'
    const withPage = {
      ...env,
      ASSETS: { fetch: () => Promise.resolve(new Response(page, { headers: { 'Content-Type': 'text/html' } })) },
    } as unknown as Env
    for (const [method, accept] of [
      ['GET', 'text/html,application/xhtml+xml'],
      ['GET', '*/*'],
      ['HEAD', '*/*'],
    ] as const) {
      const r = await worker.fetch(
        new Request(MCP_URL, { method, headers: { Accept: accept } }),
        withPage,
        createExecutionContext(),
      )
      expect(r.status, `${method} ${accept}`).toBe(200)
      expect(r.headers.get('Content-Security-Policy'), `${method} ${accept}`).toContain('nonce-')
      // O mesmo endereço é o servidor para o cliente MCP: o cache precisa separar pelo Accept.
      expect(r.headers.get('Vary'), `${method} ${accept}`).toMatch(/\bAccept\b/)
      if (method === 'GET') expect(await r.text()).toContain('pagina')
    }
    // Navegador em português: o redirect para /pt/mcp também depende do Accept, além do idioma.
    const pt = await worker.fetch(
      new Request(MCP_URL, { headers: { Accept: 'text/html', 'Accept-Language': 'pt-BR' } }),
      withPage,
      createExecutionContext(),
    )
    expect(pt.status).toBe(302)
    expect(pt.headers.get('Location')).toBe('https://fael.caporali.dev/pt/mcp')
    expect(pt.headers.get('Vary')).toBe('Accept-Language, Cookie, Accept')
  })

  it('a página /mcp lista as mesmas ferramentas, na mesma ordem, que o servidor', async () => {
    const client = new Client({ name: 'teste-portfolio', version: '1.0.0' })
    await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL), { fetch: fetchWorker }))
    open.push(client)
    const served = (await client.listTools()).tools.map((t) => t.name)
    expect(mcp.tools.items.map((t) => t.name)).toEqual(served)
    for (const ask of mcp.asks.items) for (const tool of ask.tools) expect(served).toContain(tool)
  })
})
