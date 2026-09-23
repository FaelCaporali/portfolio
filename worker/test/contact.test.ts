import { createScheduledController, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker from '../index'
import { DAILY_CAP, MAX_ATTEMPTS, RETENTION_MS, compose, type Message } from '../messages'

const ORIGIN = 'https://fael.caporali.dev'
const URL_ = `${ORIGIN}/api/contact`

let ipSeq = 0
/** IP novo por requisição (o limite por IP é testado à parte). */
const nextIp = () => `203.0.113.${++ipSeq % 250}`

const valid = { name: 'Maria Silva', contact: 'maria@example.com', message: 'Olá, Fael! Vamos conversar sobre uma vaga.', token: 'tok', website: '' }

function post(body: unknown, init: { headers?: Record<string, string>; raw?: string; ip?: string } = {}) {
  return new Request(URL_, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': init.ip ?? nextIp(), ...init.headers },
    body: init.raw ?? JSON.stringify(body),
    cf: { country: 'BR' },
  })
}

let send: ReturnType<typeof vi.fn>
let siteverify: Record<string, unknown>
let testEnv: Env

beforeEach(async () => {
  await env.DB.exec('DELETE FROM messages')
  send = vi.fn(async () => ({ messageId: 'msg-1' }))
  testEnv = { ...env, EMAIL: { send } as unknown as SendEmail }
  siteverify = { success: true, action: 'contact', hostname: 'fael.caporali.dev' }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url.startsWith('https://challenges.cloudflare.com/turnstile/v0/siteverify')) return Response.json(siteverify)
    throw new Error(`fetch inesperado: ${url}`)
  })
})
afterEach(() => vi.restoreAllMocks())

const call = (req: Request, e: Env = testEnv) => worker.fetch(req as Request<unknown, IncomingRequestCfProperties>, e)
const rows = () => env.DB.prepare('SELECT * FROM messages ORDER BY created_at').all<Message & { status: string; last_error: string | null }>().then((r) => r.results)

describe('rota e método', () => {
  it('só aceita POST', async () => {
    const r = await call(new Request(URL_, { headers: { Origin: ORIGIN } }))
    expect(r.status).toBe(405)
    expect(r.headers.get('Allow')).toBe('POST')
  })
  it('outras rotas da API dão 404 em JSON', async () => {
    const r = await call(new Request(`${ORIGIN}/api/admin`))
    expect(r.status).toBe(404)
    expect(r.headers.get('Content-Type')).toContain('application/json')
  })
  it('respostas da API: sem cache, nosniff, CSP fechada, nenhum cabeçalho CORS', async () => {
    const r = await call(post(valid))
    expect(r.headers.get('Cache-Control')).toBe('no-store')
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(r.headers.get('Content-Security-Policy')).toContain("default-src 'none'")
    expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})

describe('origem (CSRF)', () => {
  it.each([
    ['sem Origin', { Origin: '' }],
    ['outro site', { Origin: 'https://evil.example' }],
    ['subdomínio parecido', { Origin: 'https://fael.caporali.dev.evil.example' }],
    ['http em vez de https', { Origin: 'http://fael.caporali.dev' }],
    ['Sec-Fetch-Site cross-site', { 'Sec-Fetch-Site': 'cross-site' }],
  ])('%s → 403', async (_, headers) => {
    const r = await call(post(valid, { headers }))
    expect(r.status).toBe(403)
    expect(send).not.toHaveBeenCalled()
  })
})

describe('formato do corpo', () => {
  it.each(['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', ''])('Content-Type "%s" → 415', async (type) => {
    expect((await call(post(valid, { headers: { 'Content-Type': type } }))).status).toBe(415)
  })
  it('corpo acima de 16 KB → 413 (Content-Length declarado)', async () => {
    const r = await call(post({ ...valid, message: 'a'.repeat(17_000) }))
    expect(r.status).toBe(413)
  })
  it('corpo acima de 16 KB → 413 (sem Content-Length, em streaming)', async () => {
    const big = new TextEncoder().encode(JSON.stringify({ ...valid, message: 'a'.repeat(17_000) }))
    const stream = new ReadableStream({ start(c) { for (let i = 0; i < big.length; i += 1024) c.enqueue(big.slice(i, i + 1024)); c.close() } })
    const req = new Request(URL_, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: stream })
    expect((await call(req)).status).toBe(413)
  })
  it('JSON inválido → 400', async () => {
    expect((await call(post(null, { raw: '{"name": ' }))).status).toBe(400)
  })
  it('UTF-8 inválido → 400', async () => {
    const req = new Request(URL_, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]) })
    expect((await call(req)).status).toBe(400)
  })
  it.each([['array', []], ['string', 'x'], ['número', 1], ['null', null]])('JSON que não é objeto (%s) → 422', async (_, body) => {
    expect((await call(post(body))).status).toBe(422)
  })
})

describe('validação dos campos', () => {
  it.each([
    ['nome vazio', { name: '   ' }, 'name'],
    ['nome longo', { name: 'x'.repeat(101) }, 'name'],
    ['nome não string', { name: { $gt: '' } }, 'name'],
    ['contato vazio', { contact: '' }, 'contact'],
    ['contato que não é e-mail nem telefone', { contact: 'linkedin.com/in/maria' }, 'contact'],
    ['e-mail com quebra de linha (injeção de cabeçalho)', { contact: 'maria@example.com\r\nBcc: alvo@example.com' }, 'contact'],
    ['e-mail com dois arrobas', { contact: 'a@b@example.com' }, 'contact'],
    ['e-mail com pontos seguidos', { contact: 'a..b@example.com' }, 'contact'],
    ['telefone curto', { contact: '1234567' }, 'contact'],
    ['mensagem curta', { message: 'oi' }, 'message'],
    ['mensagem longa', { message: 'x'.repeat(4001) }, 'message'],
  ])('%s → 422 apontando o campo', async (_, patch, field) => {
    const r = await call(post({ ...valid, ...patch }))
    expect(r.status).toBe(422)
    expect(((await r.json()) as { fields: string[] }).fields).toContain(field)
    expect(send).not.toHaveBeenCalled()
  })
  it('a validação vem antes do Turnstile (token não é gasto à toa)', async () => {
    await call(post({ ...valid, message: 'oi' }))
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('robôs', () => {
  it('isca preenchida → 200 falso, sem envio, sem gravação, sem gastar o Turnstile', async () => {
    const r = await call(post({ ...valid, website: 'http://spam.example' }))
    expect(r.status).toBe(200)
    expect(send).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(await rows()).toHaveLength(0)
  })
  it.each([
    ['sem token', () => ({ token: '' }), () => {}],
    ['token gigante', () => ({ token: 'x'.repeat(2049) }), () => {}],
    ['siteverify recusa', () => ({}), () => { siteverify = { success: false, 'error-codes': ['invalid-input-response'] } }],
    ['ação errada', () => ({}), () => { siteverify = { success: true, action: 'login', hostname: 'fael.caporali.dev' } }],
    ['sem ação', () => ({}), () => { siteverify = { success: true, hostname: 'fael.caporali.dev' } }],
    ['hostname errado', () => ({}), () => { siteverify = { success: true, action: 'contact', hostname: 'evil.example' } }],
    ['chave de teste em produção', () => ({}), () => { siteverify = { success: true, hostname: 'example.com', metadata: { result_with_testing_key: true } } }],
  ])('Turnstile: %s → 403', async (_, patch, arrange) => {
    arrange()
    const r = await call(post({ ...valid, ...patch() }))
    expect(r.status).toBe(403)
    expect(send).not.toHaveBeenCalled()
  })
  it('Turnstile fora do ar → 403 (falha fechada)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network'))
    expect((await call(post(valid))).status).toBe(403)
  })
  it('manda o IP do visitante e o segredo para o siteverify', async () => {
    await call(post(valid, { ip: '198.51.100.7' }))
    const [, init] = vi.mocked(fetch).mock.calls[0]
    const body = new URLSearchParams(String(init?.body))
    expect(body.get('remoteip')).toBe('198.51.100.7')
    expect(body.get('secret')).toBe('test-secret')
  })
  it('limite por IP: a 4ª requisição no minuto → 429', async () => {
    const ip = '192.0.2.99'
    const status = []
    for (let i = 0; i < 4; i++) status.push((await call(post(valid, { ip }))).status)
    expect(status).toEqual([200, 200, 200, 429])
  })
  it(`teto de ${DAILY_CAP} mensagens em 24 h → 429`, async () => {
    const stmt = env.DB.prepare("INSERT INTO messages (id, created_at, name, contact, body, status) VALUES (?, ?, 'x', 'x', 'x', 'sent')")
    await env.DB.batch(Array.from({ length: DAILY_CAP }, (_, i) => stmt.bind(`old-${i}`, Date.now() - 1000)))
    const r = await call(post(valid))
    expect(r.status).toBe(429)
    expect(send).not.toHaveBeenCalled()
  })
})

describe('envio', () => {
  it('sucesso: grava, envia do remetente fixo para fael@caporali.dev, só texto, Reply-To do visitante', async () => {
    const r = await call(post(valid))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
    expect(send).toHaveBeenCalledOnce()
    const mail = send.mock.calls[0][0] as EmailMessageBuilder
    expect(mail.from).toEqual({ email: 'worker@mail.caporali.dev', name: 'Portfólio · contato' })
    expect(mail.to).toBe('fael@caporali.dev')
    expect(mail.replyTo).toEqual({ email: 'maria@example.com', name: 'Maria Silva' })
    expect(mail.html).toBeUndefined()
    expect(mail.subject).toBe('Contato pelo portfólio: Maria Silva')
    expect(mail.text).toContain(valid.message)
    expect(mail.text).toContain('país: BR')
    const [row] = await rows()
    expect(row).toMatchObject({ status: 'sent', attempts: 1, reply_email: 'maria@example.com', country: 'BR', message_id: 'msg-1' })
  })
  it('telefone: sem Reply-To, com link do WhatsApp (assume +55)', async () => {
    await call(post({ ...valid, contact: '(31) 99999-0000' }))
    const mail = send.mock.calls[0][0] as EmailMessageBuilder
    expect(mail.replyTo).toBeUndefined()
    expect(mail.text).toContain('https://wa.me/5531999990000')
  })
  it('telefone internacional mantém o código do país', async () => {
    await call(post({ ...valid, contact: '+1 415 555 0100' }))
    expect((send.mock.calls[0][0] as EmailMessageBuilder).text).toContain('https://wa.me/14155550100')
  })
  it('injeção de cabeçalho pelo nome: quebras viram espaço, assunto em uma linha', async () => {
    await call(post({ ...valid, name: 'Maria\r\nBcc: alvo@example.com' }))
    const mail = send.mock.calls[0][0] as EmailMessageBuilder
    expect(mail.subject).toBe('Contato pelo portfólio: Maria Bcc: alvo@example.com')
    expect(mail.subject).not.toMatch(/[\r\n]/)
    expect(mail.to).toBe('fael@caporali.dev')
    expect(mail.bcc).toBeUndefined()
  })
  it('remove marcas bidirecionais e caracteres de controle; mantém parágrafos e emoji', async () => {
    const rlo = String.fromCharCode(0x202e)
    const nul = String.fromCharCode(0)
    await call(post({ ...valid, name: `Maria${rlo}gpj.exe`, message: `Linha 1${nul}\r\n\r\n\r\n\r\nLinha 2 👩‍💻` }))
    const mail = send.mock.calls[0][0] as EmailMessageBuilder
    expect(mail.subject).toBe('Contato pelo portfólio: Mariagpj.exe')
    expect(mail.text).toContain('Linha 1\n\nLinha 2 👩‍💻')
  })
  it('HTML do visitante chega como texto, nunca como HTML', async () => {
    const message = '<img src=x onerror=alert(1)> <a href="https://phish.example">clique</a>'
    await call(post({ ...valid, message }))
    const mail = send.mock.calls[0][0] as EmailMessageBuilder
    expect(mail.html).toBeUndefined()
    expect(mail.text).toContain(message)
  })
  it('falha no envio: responde 200 (fica na fila), grava pendente com o código do erro', async () => {
    send.mockRejectedValue(Object.assign(new Error('E_RATE_LIMIT_EXCEEDED: slow down, maria@example.com'), { code: 'E_RATE_LIMIT_EXCEEDED' }))
    const r = await call(post(valid))
    expect(r.status).toBe(200)
    const [row] = await rows()
    expect(row).toMatchObject({ status: 'pending', attempts: 1, last_error: 'E_RATE_LIMIT_EXCEEDED' })
  })
  it('falha no envio e no banco: 503, visitante vê o erro', async () => {
    send.mockRejectedValue(new Error('boom'))
    const brokenDb = { prepare: () => { throw new Error('D1 down') } } as unknown as D1Database
    const r = await call(post(valid), { ...testEnv, DB: brokenDb })
    expect(r.status).toBe(503)
  })
  it('banco fora do ar não impede o envio', async () => {
    const brokenDb = { prepare: () => { throw new Error('D1 down') } } as unknown as D1Database
    const r = await call(post(valid), { ...testEnv, DB: brokenDb })
    expect(r.status).toBe(200)
    expect(send).toHaveBeenCalledOnce()
  })
  it('logs sem dado pessoal', async () => {
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...a) => void logs.push(a.join(' ')))
    vi.spyOn(console, 'warn').mockImplementation((...a) => void logs.push(a.join(' ')))
    send.mockRejectedValue(new Error('E_X maria@example.com'))
    await call(post(valid))
    const all = logs.join('\n')
    expect(all).not.toContain('maria@example.com')
    expect(all).not.toContain('Maria')
    expect(all).not.toContain('vaga')
  })
  it('a mensagem composta passa pela binding real de e-mail (simulada localmente)', async () => {
    const m: Message = { id: 'x', created_at: Date.now(), name: 'Maria', contact: 'maria@example.com', reply_email: 'maria@example.com', body: 'Olá, tudo bem? Teste.', country: 'BR', attempts: 0 }
    await expect(env.EMAIL.send(compose(m))).resolves.toHaveProperty('messageId')
  })
  // O simulador local registra a recusa como erro solto e um aviso de "hung" do próprio simulador; o resultado vale.
  it('a binding real recusa outro destino (destino fixo na configuração)', async () => {
    const m: Message = { id: 'x', created_at: Date.now(), name: 'Maria', contact: 'maria@example.com', reply_email: null, body: 'Olá, tudo bem? Teste.', country: null, attempts: 0 }
    await expect(env.EMAIL.send({ ...compose(m), to: 'alvo@example.com' })).rejects.toThrow()
    await expect(env.EMAIL.send({ ...compose(m), from: 'fael@caporali.dev' })).rejects.toThrow()
  })
})

describe('cron', () => {
  async function runCron(e: Env, at = Date.now()) {
    const ctx = createExecutionContext()
    await worker.scheduled(createScheduledController({ scheduledTime: at, cron: '*/15 * * * *' }), e, ctx)
    await waitOnExecutionContext(ctx)
  }
  const seed = (id: string, createdAt: number, status = 'pending', attempts = 1) =>
    env.DB.prepare("INSERT INTO messages (id, created_at, name, contact, reply_email, body, status, attempts) VALUES (?, ?, 'Maria', 'maria@example.com', 'maria@example.com', 'Olá, mensagem de teste.', ?, ?)")
      .bind(id, createdAt, status, attempts)
      .run()

  it('reenvia pendentes com mais de 5 min; ignora recentes e enviadas', async () => {
    const now = Date.now()
    await seed('old', now - 10 * 60_000)
    await seed('fresh', now - 60_000)
    await seed('done', now - 10 * 60_000, 'sent')
    await runCron(testEnv, now)
    expect(send).toHaveBeenCalledOnce()
    const byId = Object.fromEntries((await rows()).map((r) => [r.id, r]))
    expect(byId.old).toMatchObject({ status: 'sent', attempts: 2 })
    expect(byId.fresh).toMatchObject({ status: 'pending', attempts: 1 })
  })
  it(`desiste após ${MAX_ATTEMPTS} tentativas`, async () => {
    send.mockRejectedValue(new Error('E_INTERNAL_SERVER_ERROR'))
    await seed('tired', Date.now() - 10 * 60_000, 'pending', MAX_ATTEMPTS - 1)
    await runCron(testEnv)
    expect((await rows())[0]).toMatchObject({ status: 'failed', attempts: MAX_ATTEMPTS, last_error: 'E_INTERNAL_SERVER_ERROR' })
  })
  it('apaga mensagens com mais de 90 dias', async () => {
    const now = Date.now()
    await seed('ancient', now - RETENTION_MS - 60_000, 'sent')
    await seed('recent', now - RETENTION_MS + 60 * 60_000, 'sent')
    await runCron(testEnv, now)
    expect((await rows()).map((r) => r.id)).toEqual(['recent'])
  })
})
