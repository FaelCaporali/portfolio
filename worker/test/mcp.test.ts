/**
 * O servidor MCP em /mcp pelo cliente oficial (@modelcontextprotocol/client), dentro do runtime da Cloudflare: o
 * protocolo 2026-07-28 e o de 2025 na mesma rota, as cinco ferramentas de leitura em inglês e português, os filtros com
 * a regra da página da trajetória, os erros de argumento e a recusa de outra origem no navegador.
 */
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it } from 'vitest'
import journey from '../../src/content/journey.json'
import worker from '../index'

const MCP_URL = 'https://fael.caporali.dev/mcp'

const fetchWorker = (url: string | URL, init?: RequestInit) =>
  worker.fetch(new Request(url, init) as Request<unknown, IncomingRequestCfProperties>, env)

const open: Client[] = []
afterEach(async () => {
  await Promise.all(open.splice(0).map((c) => c.close()))
})

/**
 * Um cliente conectado ao Worker: o protocolo 2026-07-28 (envelope por requisição, sem initialize) fixado, ou o de
 * 2025 (initialize), que é o que o cliente oficial usa quando ninguém pede outro.
 */
async function connect(legacy = false) {
  const client = new Client(
    { name: 'teste-portfolio', version: '1.0.0' },
    { versionNegotiation: { mode: legacy ? 'legacy' : { pin: '2026-07-28' } } },
  )
  await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL), { fetch: fetchWorker }))
  open.push(client)
  return client
}

type Result = Awaited<ReturnType<Client['callTool']>>

/** O JSON da resposta de uma ferramenta. */
function data(r: Result): Record<string, unknown> {
  const first = (r.content as { type: string; text?: string }[])[0]
  if (first?.type !== 'text' || !first.text) throw new Error('resposta sem texto')
  return JSON.parse(first.text) as Record<string, unknown>
}

const call = (c: Client, name: string, args: Record<string, unknown> = {}) => c.callTool({ name, arguments: args })

type Summary = {
  id: string
  url: string
  title: string
  tags: Record<string, string[]>
}
type Search = {
  total: number
  page_url: string
  results: Summary[]
}

const withTag = (group: 'tools' | 'concepts' | 'skills', tag: string) =>
  journey.checkpoints
    .filter((c) => ((c.tags as Record<string, string[] | undefined> | undefined)?.[group] ?? []).includes(tag))
    .sort((a, b) => a.order - b.order)
    .map((c) => c.id)

describe('conexão', () => {
  it('protocolo atual: as cinco ferramentas, na ordem, só leitura, e as instruções', async () => {
    const client = await connect()
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name)).toEqual([
      'get_profile',
      'list_filters',
      'search_journey',
      'get_checkpoint',
      'get_delivered',
    ])
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true)
    expect(client.getInstructions()).toMatch(/get_profile/)
  })

  it('os seletores estão no tools/list: cada grupo de search_journey lista todos os valores de journey.json', async () => {
    const client = await connect()
    const search = (await client.listTools()).tools.find((t) => t.name === 'search_journey')
    const props = search?.inputSchema.properties as Record<string, { items?: { enum?: string[] } }>
    for (const group of ['tools', 'concepts', 'skills'] as const) {
      const all = new Set(
        journey.checkpoints.flatMap((c) => (c.tags as Record<string, string[] | undefined> | undefined)?.[group] ?? []),
      )
      expect(new Set(props[group]?.items?.enum), group).toEqual(all)
    }
  })

  it('cliente de 2025 na mesma rota: lista e chama', async () => {
    const client = await connect(true)
    expect((await client.listTools()).tools).toHaveLength(5)
    expect(data(await call(client, 'get_profile')).name).toBe('Fael Caporali')
  })
})

describe('ferramentas', () => {
  it('get_profile em inglês e em português, com endereços absolutos', async () => {
    const client = await connect()
    const en = data(await call(client, 'get_profile'))
    const pt = data(await call(client, 'get_profile', { lang: 'pt' }))
    expect(en).toMatchObject({
      name: 'Fael Caporali',
      titles: ['FullStack Dev', 'QA Analyst', 'TechLead'],
      pages: { home: 'https://fael.caporali.dev/', journey: 'https://fael.caporali.dev/journey' },
    })
    expect(pt).toMatchObject({
      titles: ['Dev FullStack', 'Analista de QA', 'TechLead'],
      pages: { home: 'https://fael.caporali.dev/pt', journey: 'https://fael.caporali.dev/pt/journey' },
    })
    expect(en.resumes).toEqual([
      { language: 'Português', url: 'https://fael.caporali.dev/cv/fael-caporali-cv-pt.pdf' },
      { language: 'English', url: 'https://fael.caporali.dev/cv/fael-caporali-cv-en.pdf' },
    ])
    expect(en.today).toContain('AI Product Engineer')
    expect(en.today).not.toContain('Uber Driver')
  })

  it('list_filters: cada valor com a contagem de marcos, rótulo em português e os anos', async () => {
    const client = await connect()
    const f = data(await call(client, 'list_filters', { lang: 'pt' })) as {
      tools: { value: string; count: number }[]
      skills: { value: string; label: string }[]
    }
    expect(f.tools[0]).toEqual({
      value: 'TypeScript',
      label: 'TypeScript',
      count: withTag('tools', 'TypeScript').length,
    })
    const skill = f.skills.find((s) => s.value === 'Entrepreneurship')
    expect(skill?.label).toBe('Empreendedorismo')
    expect(data(await call(client, 'list_filters'))).toMatchObject({
      parts: [
        { value: 'prologue', count: 5 },
        { value: 'story', count: 15 },
      ],
      years: { from: 2006, to: new Date().getUTCFullYear() },
    })
  })

  it('search_journey: qualquer valor dentro do grupo, todos entre grupos, e o link da página filtrada', async () => {
    const client = await connect()
    const one = data(await call(client, 'search_journey', { tools: ['React'] })) as Search
    expect(one.results.map((r) => r.id)).toEqual(withTag('tools', 'React'))
    expect(one.page_url).toBe('https://fael.caporali.dev/journey?tools=React')

    const either = data(await call(client, 'search_journey', { tools: ['React', 'n8n'] })) as Search
    const union = new Set([...withTag('tools', 'React'), ...withTag('tools', 'n8n')])
    expect(new Set(either.results.map((r) => r.id))).toEqual(union)

    const both = data(await call(client, 'search_journey', { tools: ['React'], skills: ['AI engineering'] })) as Search
    const ai = new Set(withTag('skills', 'AI engineering'))
    expect(both.results.map((r) => r.id)).toEqual(withTag('tools', 'React').filter((id) => ai.has(id)))
  })

  it('search_journey: resposta em português, parte, anos e texto livre sem caixa nem acento', async () => {
    const client = await connect()
    const args = { lang: 'pt', skills: ['Entrepreneurship'], part: 'prologue' }
    const pt = data(await call(client, 'search_journey', args)) as Search
    expect(pt.results.map((r) => r.id)).toEqual(
      withTag('skills', 'Entrepreneurship').filter(
        (id) => journey.checkpoints.find((c) => c.id === id)?.part === 'prologue',
      ),
    )
    expect(pt.results[0]?.url).toMatch(/^https:\/\/fael\.caporali\.dev\/pt\/journey#/)
    expect(pt.results[0]?.tags.skills).toContain('Empreendedorismo')

    const years = data(await call(client, 'search_journey', { from: 2006, to: 2012 })) as Search
    expect(years.results.map((r) => r.id)).toEqual(['first-business'])
    expect(years.page_url).toBe('https://fael.caporali.dev/journey?from=2006&to=2012')

    // "São João" sem acento e em minúsculas; "produtora" só existe no texto em português e acha na resposta em inglês.
    const text = data(await call(client, 'search_journey', { text: 'sao joao' })) as Search
    expect(text.results.map((r) => r.id)).toContain('first-business')
    const cross = data(await call(client, 'search_journey', { text: 'Produtora' })) as Search
    expect(cross.results.map((r) => r.id)).toEqual(['first-business'])
  })

  it('search_journey: palavra curta casa inteira ("ai" não acha "mais" nem "email"); longa casa o começo', async () => {
    const client = await connect()
    const ai = (data(await call(client, 'search_journey', { text: 'ai' })) as Search).results.map((r) => r.id)
    expect(ai).toContain('mpc')
    expect(ai).not.toContain('first-business')
    expect(ai.length).toBeLessThan(journey.checkpoints.length)
    // "agent" acha "agents"; as 10 primeiras palavras distintas valem, a repetição não pesa.
    const agent = data(await call(client, 'search_journey', { text: 'agent agent AGENT' })) as Search
    expect(agent.results.map((r) => r.id)).toContain('mpc')
  })

  it('search_journey: valor fora da lista é recusado, e a recusa cita os aceitos', async () => {
    const client = await connect()
    const r = await call(client, 'search_journey', { tools: ['COBOL'] })
    expect(r.isError).toBe(true)
    expect((r.content as { text: string }[])[0]?.text).toMatch(/TypeScript/)
  })

  it('get_checkpoint: pelo id, pela âncora da vida e id que não existe', async () => {
    const client = await connect()
    const c = data(await call(client, 'get_checkpoint', { id: 'brickup-lead', lang: 'pt' })) as Summary & {
      body: string[]
      highlights: string[]
    }
    const source = journey.checkpoints.find((x) => x.id === 'brickup-lead')
    expect(c.body).toEqual(source?.body.pt)
    expect(c.highlights).toEqual(source?.highlights?.pt)
    expect(c.url).toBe('https://fael.caporali.dev/pt/journey#brickup-lead')

    const ai = data(await call(client, 'get_checkpoint', { id: 'ai' })) as Summary
    expect(ai).toMatchObject({ id: 'mpc', url: 'https://fael.caporali.dev/journey#ai' })

    const missing = await call(client, 'get_checkpoint', { id: 'nao-existe' })
    expect(missing.isError).toBe(true)
    expect((missing.content as { text: string }[])[0]?.text).toMatch(/Unknown step "nao-existe".*first-business/)
  })

  it('get_delivered em português: entregas ligadas à trajetória, stack e perguntas', async () => {
    const client = await connect()
    const d = data(await call(client, 'get_delivered', { lang: 'pt' })) as {
      delivered: { url: string }[]
      stack: { group: string }[]
      faq: { question: string }[]
    }
    expect(d.delivered[0]?.url).toBe('https://fael.caporali.dev/pt/journey#ai')
    expect(d.stack[0]?.group).toBe('Linguagens')
    expect(d.faq[0]?.question).toBe('Para que posso contratar o Fael?')
  })

  it('argumento fora do contrato é recusado: idioma, tipo e tamanho', async () => {
    const client = await connect()
    for (const args of [{ lang: 'fr' }, { tools: 'React' }, { text: 'x'.repeat(201) }, { from: 'ontem' }]) {
      const r = await call(client, 'search_journey', args).catch((e: unknown) => e)
      expect(r instanceof Error || (r as Result).isError === true, JSON.stringify(args)).toBe(true)
    }
  })
})

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
    expect((await site.listTools()).tools).toHaveLength(5)
  })

  it('corpo acima de 16 KiB é recusado antes de qualquer leitura (413), mesmo sem Content-Length', async () => {
    const big = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { pad: 'x'.repeat(17 * 1024) } })
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
      const r = await worker.fetch(new Request(MCP_URL, { method, headers: { Accept: accept } }), withPage)
      expect(r.status, `${method} ${accept}`).toBe(200)
      expect(r.headers.get('Content-Security-Policy'), `${method} ${accept}`).toContain('nonce-')
      if (method === 'GET') expect(await r.text()).toContain('pagina')
    }
  })
})
