/**
 * Registro do MCP (T4 e T5 do plano): sem coluna de IP, cada chamada gravada com cliente, rede e país, texto livre
 * mascarado, teto diário do registro com a fila do excedente (D-MCP26) e limite por rede antes do servidor.
 */
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { createExecutionContext, createMessageBatch, getQueueResult } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, it, vi } from 'vitest'
import worker from '../index'
import { DAILY, drainLog, scrub, untilNextUtcDay, utcDay, type LogRow } from '../mcp/audit'
import { connect, fetchWorker, MCP_URL, network, open } from './mcp-client'
import { brokenDb, useWorkerDoubles } from './helpers'

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

const lost = () =>
  env.DB.prepare("SELECT COALESCE(SUM(used), 0) AS n FROM mcp_quota WHERE kind = 'log_lost'").first<number>('n')
const fillLog = (used: number) =>
  env.DB.prepare("INSERT INTO mcp_quota (day, kind, used) VALUES (?, 'log', ?)").bind(utcDay(Date.now()), used).run()

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

  it(`teto de ${DAILY.log} por dia UTC: acima dele a chamada responde e vai para a fila até o dia seguinte`, async () => {
    await fillLog(DAILY.log)
    const send = vi.fn((_row: LogRow, _options?: QueueSendOptions) => Promise.resolve())
    const client = await connect(false, { ...env, MCP_LOG: { send } as unknown as Queue })
    const before = untilNextUtcDay(Date.now())
    const r = await client.callTool({ name: 'get_profile', arguments: { lang: 'pt' } })
    expect(r.isError).toBeFalsy()
    expect(await calls()).toEqual([])
    expect(send).toHaveBeenCalledOnce()
    const [row, options] = send.mock.calls[0] ?? []
    expect(row).toMatchObject({ tool: 'get_profile', args: '{"lang":"pt"}', client: 'teste-portfolio 1.0.0' })
    expect(row).toMatchObject({ protocol: '2026-07-28', outcome: 'ok' })
    expect(options?.delaySeconds).toBeLessThanOrEqual(before)
    expect(options?.delaySeconds).toBeGreaterThan(before - 5)
  })

  it('banco fora do ar: a chamada responde e vai para a fila, de novo em 1 hora', async () => {
    const send = vi.fn((_row: LogRow, _options?: QueueSendOptions) => Promise.resolve())
    const client = await connect(false, { ...env, DB: brokenDb, MCP_LOG: { send } as unknown as Queue })
    expect((await client.callTool({ name: 'get_profile' })).isError).toBeFalsy()
    expect(send.mock.calls[0]?.[1]).toEqual({ delaySeconds: 3600 })
  })

  it('fila que recusa (cota de operações do dia): a chamada é contada como perdida', async () => {
    await fillLog(DAILY.log)
    const send = vi.fn(() => Promise.reject(new Error('Queue send failed')))
    const client = await connect(false, { ...env, MCP_LOG: { send } as unknown as Queue })
    expect((await client.callTool({ name: 'get_profile' })).isError).toBeFalsy()
    expect(await lost()).toBe(1)
  })

  it('espera até a meia-noite UTC, com um minuto de folga e no máximo as 24 h da fila', () => {
    expect(untilNextUtcDay(Date.UTC(2026, 9, 1, 23, 59, 30))).toBe(90)
    expect(untilNextUtcDay(Date.UTC(2026, 9, 2, 0, 0, 0))).toBe(24 * 3600)
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

describe('fila do registro (MCP_LOG)', () => {
  const row = (tool: string): LogRow => ({
    created_at: Date.UTC(2026, 9, 1, 23, 0),
    tool,
    args: null,
    client: 'Claude 1.0',
    protocol: '2026-07-28',
    network: 'Anthropic, PBC',
    country: 'US',
    outcome: 'ok',
    duration_ms: 3,
  })
  async function drain(messages: LogRow[], e: Env = env) {
    const batch = createMessageBatch<LogRow>(
      'fael-caporali-mcp-log',
      messages.map((body, i) => ({ id: `m${i}`, timestamp: new Date(), attempts: 1, body })),
    )
    // O consumidor não usa o ctx; o getQueueResult pede um para esperar os waitUntil.
    await worker.queue(batch, e)
    return getQueueResult(batch, createExecutionContext())
  }

  /** Mensagens que anotam ack e retry (o getQueueResult do pool não guarda o delaySeconds do retry). */
  function spied(bodies: LogRow[], sent = new Date()) {
    const messages = bodies.map((body) => ({ body, timestamp: sent, ack: vi.fn(), retry: vi.fn() }))
    return { batch: { messages } as unknown as MessageBatch<LogRow>, messages }
  }

  it('o Worker entrega o lote ao consumidor: o que cabe é gravado com a hora original, o resto volta', async () => {
    await fillLog(DAILY.log - 1)
    const result = await drain([row('get_profile'), row('search_journey')])
    expect(result.explicitAcks).toEqual(['m0'])
    expect(result.retryMessages.map((m) => m.msgId)).toEqual(['m1'])
    const saved = await env.DB.prepare('SELECT created_at, tool, client, network FROM mcp_calls').all()
    expect(saved.results).toEqual([
      { created_at: Date.UTC(2026, 9, 1, 23, 0), tool: 'get_profile', client: 'Claude 1.0', network: 'Anthropic, PBC' },
    ])
  })

  it('o que não cabe na cota espera até o dia seguinte; com o banco fora do ar, 1 hora', async () => {
    await fillLog(DAILY.log)
    const now = Date.now()
    const full = spied([row('get_profile')])
    await drainLog(full.batch, env.DB, now)
    expect(full.messages[0]?.ack).not.toHaveBeenCalled()
    expect(full.messages[0]?.retry).toHaveBeenCalledWith({ delaySeconds: untilNextUtcDay(now) })
    const down = spied([row('get_profile')])
    await drainLog(down.batch, brokenDb, now)
    expect(down.messages[0]?.retry).toHaveBeenCalledWith({ delaySeconds: 3600 })
    expect(await calls()).toEqual([])
  })

  it('o que não caberia mais nas 24 h da fila sai dela e é contado como perdido', async () => {
    await fillLog(DAILY.log)
    const now = Date.now()
    const old = spied([row('get_profile')], new Date(now - 24 * 3600_000 + 30_000))
    await drainLog(old.batch, env.DB, now)
    expect(old.messages[0]?.retry).not.toHaveBeenCalled()
    expect(old.messages[0]?.ack).toHaveBeenCalledOnce()
    expect(await lost()).toBe(1)
  })
})
