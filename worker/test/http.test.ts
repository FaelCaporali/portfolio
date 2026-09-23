/** Rota, cabeçalhos das respostas, origem (CSRF) e formato do corpo. */
import { describe, expect, it } from 'vitest'
import { call, CONTACT_URL, ORIGIN, post, t, useWorkerDoubles, valid } from './helpers'

useWorkerDoubles()

describe('rota e método', () => {
  it('só aceita POST', async () => {
    const r = await call(new Request(CONTACT_URL, { headers: { Origin: ORIGIN } }))
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
    expect(t.send).not.toHaveBeenCalled()
  })
})

describe('formato do corpo', () => {
  it.each(['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', ''])(
    'Content-Type "%s" → 415',
    async (type) => {
      expect((await call(post(valid, { headers: { 'Content-Type': type } }))).status).toBe(415)
    },
  )
  it('corpo acima de 16 KB → 413 (Content-Length declarado)', async () => {
    const r = await call(post({ ...valid, message: 'a'.repeat(17_000) }))
    expect(r.status).toBe(413)
  })
  it('corpo acima de 16 KB → 413 (sem Content-Length, em streaming)', async () => {
    const big = new TextEncoder().encode(JSON.stringify({ ...valid, message: 'a'.repeat(17_000) }))
    const stream = new ReadableStream({
      start(c) {
        for (let i = 0; i < big.length; i += 1024) c.enqueue(big.slice(i, i + 1024))
        c.close()
      },
    })
    const req = new Request(CONTACT_URL, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: stream,
    })
    expect((await call(req)).status).toBe(413)
  })
  it('JSON inválido → 400', async () => {
    expect((await call(post(null, { raw: '{"name": ' }))).status).toBe(400)
  })
  it('UTF-8 inválido → 400', async () => {
    const req = new Request(CONTACT_URL, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]),
    })
    expect((await call(req)).status).toBe(400)
  })
  it.each([
    ['array', []],
    ['string', 'x'],
    ['número', 1],
    ['null', null],
  ])('JSON que não é objeto (%s) → 422', async (_, body) => {
    expect((await call(post(body))).status).toBe(422)
  })
})
