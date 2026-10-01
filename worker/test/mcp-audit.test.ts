/**
 * Registro do MCP (T4 e T5 do plano): sem coluna de IP, cada chamada gravada com cliente, rede e país, texto livre
 * mascarado, teto diário do registro e limite por rede antes do servidor.
 */
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { DAILY, scrub, utcDay } from '../mcp/audit'
import { connect, fetchWorker, MCP_URL, network, open } from './mcp-client'
import { useWorkerDoubles } from './helpers'

useWorkerDoubles()

type CallRow = {
  tool: string
  args: string | null
  client: string | null
  protocol: string | null
  network: string | null
  country: string | null
  outcome: string
}
const calls = () =>
  env.DB.prepare('SELECT tool, args, client, protocol, network, country, outcome FROM mcp_calls ORDER BY id')
    .all<CallRow>()
    .then((r) => r.results)

describe('registro', () => {
  it('nenhuma coluna de IP nem de identificador da pessoa, no registro e nas mensagens', async () => {
    for (const table of ['mcp_calls', 'mcp_quota', 'messages']) {
      const { results } = await env.DB.prepare(`SELECT name FROM pragma_table_info('${table}')`).all<{ name: string }>()
      const names = results.map((c) => c.name).join(' ')
      expect(names, table).not.toMatch(/\bip\b|addr|remote|user_agent|session/i)
    }
  })

  it('cada chamada: ferramenta, argumentos, cliente declarado, protocolo, rede, país e resultado', async () => {
    const client = await connect()
    await client.callTool({ name: 'get_profile', arguments: { lang: 'pt' } })
    await client.callTool({ name: 'get_checkpoint', arguments: { id: 'nao-existe' } })
    expect(await calls()).toEqual([
      {
        tool: 'get_profile',
        args: '{"lang":"pt"}',
        client: 'teste-portfolio 1.0.0',
        protocol: '2026-07-28',
        network: 'Rede de Teste',
        country: 'BR',
        outcome: 'ok',
      },
      expect.objectContaining({ tool: 'get_checkpoint', args: '{"lang":"en","id":"nao-existe"}', outcome: 'error' }),
    ])
  })

  it('cliente de 2025 (sem estado): a chamada não traz clientInfo, fica só o produto do User-Agent', async () => {
    const client = new Client({ name: 'teste-portfolio', version: '1.0.0' }, { versionNegotiation: { mode: 'legacy' } })
    const withAgent = (url: string | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      headers.set('User-Agent', 'Claude-User/1.0 (Linux x86_64; +https://example.com/bot)')
      return fetchWorker(url, { ...init, headers })
    }
    await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL), { fetch: withAgent }))
    open.push(client)
    await client.callTool({ name: 'get_delivered' })
    expect((await calls())[0]?.client).toBe('UA Claude-User/1.0')
  })

  it('texto livre: e-mail e telefone mascarados antes de gravar; etiquetas ficam', async () => {
    const client = await connect()
    const text = 'maria@example.com +55 31 99999-8888'
    await client.callTool({ name: 'search_journey', arguments: { text, tools: ['React'] } })
    const args = JSON.parse((await calls())[0]?.args ?? '{}') as Record<string, unknown>
    expect(args).toMatchObject({ text: '[e-mail] [telefone]', tools: ['React'] })
  })

  it('máscara: anos e números curtos ficam; CPF, telefone, e-mail e perfil saem; corta no teto', () => {
    expect(scrub('React 18 desde 2019')).toBe('React 18 desde 2019')
    expect(scrub('de 2019 2020 a 2021-2023')).toBe('de 2019 2020 a 2021-2023')
    expect(scrub('maria@gmail ou @mariasilva')).toBe('[e-mail] ou [e-mail]')
    expect(scrub('cpf 123.456.789-09, fone (31) 3333-4444, a.b+c@d.co')).toBe(
      'cpf [telefone], fone [telefone], [e-mail]',
    )
    expect(scrub('x'.repeat(300))).toHaveLength(200)
  })

  it(`teto de ${DAILY.log} linhas por dia UTC: acima dele a chamada responde e nada é gravado`, async () => {
    await env.DB.prepare("INSERT INTO mcp_quota (day, kind, used) VALUES (?, 'log', ?)")
      .bind(utcDay(Date.now()), DAILY.log)
      .run()
    const client = await connect()
    const r = await client.callTool({ name: 'get_profile' })
    expect(r.isError).toBeFalsy()
    expect(await calls()).toEqual([])
  })

  it('limite por rede (ASN), antes do servidor: a 61ª requisição no minuto → 429 em JSON-RPC', async () => {
    const cf = network(64_496)
    const post = () =>
      fetchWorker(MCP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: '{}',
        cf,
      })
    const status = []
    for (let i = 0; i < 61; i++) status.push((await post()).status)
    expect(status.slice(0, 60)).not.toContain(429)
    const last = await post()
    expect(status[60]).toBe(429)
    expect(last.headers.get('Retry-After')).toBe('60')
    expect(await last.json()).toMatchObject({ jsonrpc: '2.0', error: { code: -32000 } })
  })
})
