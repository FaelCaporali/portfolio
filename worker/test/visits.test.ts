/**
 * Registro de visitas (worker/visits.ts, .wai/monitoramento/02-plano.md): o ponto 'view' de cada página HTML, o POST
 * /api/e do navegador e a seção do site no resumo semanal.
 */
import { createExecutionContext, createScheduledController, waitOnExecutionContext } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyAgent } from '../../shared/bots'
import { VISITS_PATH } from '../../shared/visits'
import worker from '../index'
import { lastDue } from '../mcp/notify'
import { parseBeat } from '../visits'
import { call, ORIGIN, sentMail, t, useWorkerDoubles } from './helpers'

useWorkerDoubles()

const write = vi.fn<(point: AnalyticsEngineDataPoint) => void>()
/** Os pontos gravados, na ordem. */
const written = () => write.mock.calls.map((c) => c[0])
const html = () =>
  Promise.resolve(
    new Response('<!doctype html><html><body></body></html>', { headers: { 'Content-Type': 'text/html' } }),
  )
let pageEnv: Env

beforeEach(() => {
  write.mockReset()
  pageEnv = {
    ...t.env,
    VISITS: { writeDataPoint: write },
    ASSETS: { fetch: html } as unknown as Fetcher,
  }
})

const CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36'

function page(path: string, headers: Record<string, string> = {}) {
  const request = new Request(`${ORIGIN}${path}`, {
    headers: { Accept: 'text/html', 'Accept-Language': 'en', 'User-Agent': CHROME, ...headers },
    cf: { country: 'BR', region: 'Minas Gerais', city: 'Belo Horizonte', asOrganization: 'Acme Ltda', asn: 64500 },
  })
  return call(request, pageEnv)
}

const beat = (body: unknown, headers: Record<string, string> = {}) =>
  call(
    new Request(`${ORIGIN}${VISITS_PATH}`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'User-Agent': CHROME, ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
      cf: { country: 'BR', region: 'Minas Gerais', city: 'Belo Horizonte' },
    }),
    pageEnv,
  )

const valid = { v: 'abc123def456', p: '/pt/journey', t: 12_345.6, e: [['journey_filter', 'TypeScript']] }

describe('quem pediu, pelo User-Agent', () => {
  it.each([
    [CHROME, 'human', ''],
    ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'search', 'Googlebot'],
    ['Mozilla/5.0 AppleWebKit/537.36; compatible; OAI-SearchBot/1.3', 'search', 'OAI-SearchBot'],
    ['Mozilla/5.0 AppleWebKit/537.36; compatible; ChatGPT-User/1.0', 'assistant', 'ChatGPT-User'],
    ['Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)', 'assistant', 'Claude-User'],
    ['Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'training', 'ClaudeBot'],
    ['Mozilla/5.0 AppleWebKit/537.36; compatible; GPTBot/1.2', 'training', 'GPTBot'],
    ['Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)', 'search', 'Google-InspectionTool'],
    [
      'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome-Lighthouse',
      'search',
      'Chrome-Lighthouse',
    ],
    ['curl/8.5.0', 'bot', ''],
    ['', 'bot', ''],
  ])('%s → %s', (ua, client, bot) => {
    expect(classifyAgent(ua)).toEqual({ client, bot })
  })
})

describe('página HTML entregue → ponto view', () => {
  it('caminho sem idioma, origem, UTM, lugar, rede, quem pediu, dispositivo e status; nunca o IP', async () => {
    const r = await page('/pt/journey?utm_source=chatgpt.com&utm_medium=ai', {
      Referer: 'https://chatgpt.com/',
      'CF-Connecting-IP': '203.0.113.9',
    })
    expect(r.status).toBe(200)
    expect(write).toHaveBeenCalledOnce()
    const [point] = written()
    if (!point) throw new Error('nenhum ponto gravado')
    expect(point.indexes).toEqual(['view'])
    expect(point.blobs).toEqual([
      'view',
      '/journey',
      'pt',
      'chatgpt.com',
      'chatgpt.com',
      'ai',
      '',
      'BR',
      'Minas Gerais',
      'Belo Horizonte',
      'Acme Ltda',
      'human',
      '',
      'mobile',
      '200',
    ])
    expect(point.doubles).toEqual([64500])
    expect(JSON.stringify(point)).not.toContain('203.0.113.9')
  })

  it('robô de busca conta, com o nome; navegação vinda do próprio site não tem origem', async () => {
    await page('/', { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)', Referer: `${ORIGIN}/journey` })
    const blobs = written()[0]?.blobs ?? []
    expect([blobs[3], blobs[11], blobs[12]]).toEqual(['', 'search', 'Googlebot'])
  })

  it('não conta o que não é página: POST, prefetch, redirect de idioma, resposta que não é HTML', async () => {
    await call(new Request(`${ORIGIN}/`, { method: 'POST', headers: { Accept: 'text/html' } }), pageEnv)
    await page('/', { 'Sec-Purpose': 'prefetch' })
    await page('/', { 'Accept-Language': 'pt-BR' }) // 302 para /pt
    pageEnv.ASSETS = {
      fetch: () => Promise.resolve(new Response('{}', { headers: { 'Content-Type': 'application/json' } })),
    } as unknown as Fetcher
    await page('/journey.data')
    expect(write).not.toHaveBeenCalled()
  })

  it('caminho que não é página do site vira (outra); UTM com e-mail vira (outro)', async () => {
    pageEnv.ASSETS = {
      fetch: () => Promise.resolve(new Response('x', { status: 404, headers: { 'Content-Type': 'text/html' } })),
    } as unknown as Fetcher
    await page('/wp-login.php?utm_source=maria%40example.com&utm_medium=email')
    const blobs = written()[0]?.blobs ?? []
    expect([blobs[1], blobs[4], blobs[5], blobs[14]]).toEqual(['(outra)', '(outro)', 'email', '404'])
  })

  it('Analytics Engine fora do ar: a página sai mesmo assim', async () => {
    write.mockImplementation(() => {
      throw new Error('AE down')
    })
    expect((await page('/')).status).toBe(200)
  })
})

describe('POST /api/e', () => {
  it('grava a página (tempo visível, eventos) e cada evento, com o lugar e sem o IP', async () => {
    const r = await beat(valid, { 'CF-Connecting-IP': '203.0.113.9' })
    expect(r.status).toBe(204)
    expect(write).toHaveBeenCalledTimes(2)
    const [pagePoint, eventPoint] = written()
    expect(pagePoint).toEqual({
      indexes: ['page'],
      blobs: ['page', '/journey', 'pt', 'abc123def456', 'BR', 'Minas Gerais', 'Belo Horizonte', 'human', 'mobile'],
      doubles: [12_346, 1],
    })
    expect(eventPoint).toEqual({
      indexes: ['event'],
      blobs: [
        'event',
        '/journey',
        'pt',
        'abc123def456',
        'BR',
        'Minas Gerais',
        'Belo Horizonte',
        'journey_filter',
        'TypeScript',
      ],
    })
    expect(JSON.stringify(write.mock.calls)).not.toContain('203.0.113.9')
  })

  it('outra origem ou chamada de outro site: 403, nada gravado', async () => {
    expect((await beat(valid, { Origin: 'https://evil.example' })).status).toBe(403)
    expect((await beat(valid, { 'Sec-Fetch-Site': 'cross-site' })).status).toBe(403)
    expect(write).not.toHaveBeenCalled()
  })

  it('GET: 405', async () => {
    const r = await call(new Request(`${ORIGIN}${VISITS_PATH}`), pageEnv)
    expect(r.status).toBe(405)
  })

  it('corpo fora do contrato: 204 e nada gravado', async () => {
    for (const body of ['{', 'x'.repeat(5000), { ...valid, e: [['outro', '']] }, { ...valid, v: 'curto' }])
      expect((await beat(body)).status).toBe(204)
    expect(write).not.toHaveBeenCalled()
  })
})

describe('contrato do corpo', () => {
  it('aceita o válido; recusa evento fora da lista, detalhe com marcação, tempo absurdo e eventos demais', () => {
    expect(parseBeat(valid)).toEqual({ ...valid, t: 12_346 })
    expect(parseBeat({ ...valid, e: [['resume', '<script>']] })).toBeNull()
    expect(parseBeat({ ...valid, e: [['resume', 'x'.repeat(61)]] })).toBeNull()
    expect(parseBeat({ ...valid, t: -1 })).toBeNull()
    expect(parseBeat({ ...valid, t: 2 * 24 * 3600_000 })).toBeNull()
    expect(parseBeat({ ...valid, p: 'https://evil.example/' })).toBeNull()
    expect(parseBeat({ ...valid, e: Array.from({ length: 31 }, () => ['bust_drag', '']) })).toBeNull()
  })
})

describe('resumo semanal: a seção do site', () => {
  const WEDNESDAY = Date.UTC(2026, 9, 7, 12)
  async function runCron(e: Env) {
    const ctx = createExecutionContext()
    worker.scheduled(createScheduledController({ scheduledTime: WEDNESDAY, cron: '*/15 * * * *' }), e, ctx)
    await waitOnExecutionContext(ctx)
  }

  it('sem o token: o resumo diz que falta, e o do MCP segue', async () => {
    await runCron(t.env)
    const mail = sentMail()
    expect(mail.subject).toBe('Resumo semanal do site e do MCP: 0 chamadas do MCP')
    expect(mail.text).toContain('Visitas: falta o token da API')
    expect(mail.text).toContain('Chamadas registradas: 0')
  })

  it('com o token: as consultas da semana na API SQL, com a janela certa', async () => {
    const sql: string[] = []
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      expect(url).toBe(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`)
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tok')
      sql.push(typeof init?.body === 'string' ? init.body : '')
      const data =
        sql.length === 1
          ? [
              { k: 'human', n: '7' },
              { k: 'search', n: '3' },
            ]
          : [{ k: 'x', n: 1 }]
      return Promise.resolve(Response.json({ meta: [], data }))
    })
    await runCron({ ...t.env, CF_API_TOKEN: 'tok' })
    const to = lastDue(WEDNESDAY)
    const day = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
    expect(sql[0]).toContain(`timestamp >= toDateTime('${day(to - 7 * 24 * 3600_000)}')`)
    expect(sql[0]).toContain(`timestamp < toDateTime('${day(to)}')`)
    expect(sentMail().text).toContain('Páginas entregues: pessoas 7 · busca 3')
  })

  it('uma consulta recusada: só a linha dela diz que falhou, o resto do resumo vem', async () => {
    let calls = 0
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        ++calls === 2 ? new Response('bad', { status: 422 }) : Response.json({ data: [{ k: 'human', n: 4 }] }),
      ),
    )
    await runCron({ ...t.env, CF_API_TOKEN: 'tok' })
    const text = sentMail().text ?? ''
    expect(text).toContain('Páginas mais vistas por pessoas: consulta falhou')
    expect(text).toContain('Páginas entregues: pessoas 4')
  })

  it('API fora: o resumo diz que a consulta falhou', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('no', { status: 500 }))
    await runCron({ ...t.env, CF_API_TOKEN: 'tok' })
    expect(sentMail().text).toContain('Visitas: a consulta ao Analytics Engine falhou')
  })
})
