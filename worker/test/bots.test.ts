/** Robôs: isca, Turnstile no servidor, limite por IP e teto diário. */
import { env } from 'cloudflare:workers'
import { describe, expect, it, vi } from 'vitest'
import { DAILY_CAP } from '../message'
import { call, post, rows, t, useWorkerDoubles, valid } from './helpers'

useWorkerDoubles()

describe('robôs', () => {
  it('isca preenchida → 200 falso, sem envio, sem gravação, sem gastar o Turnstile', async () => {
    const r = await call(post({ ...valid, website: 'http://spam.example' }))
    expect(r.status).toBe(200)
    expect(t.send).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(await rows()).toHaveLength(0)
  })
  it.each([
    ['sem token', () => ({ token: '' }), () => {}],
    ['token gigante', () => ({ token: 'x'.repeat(2049) }), () => {}],
    [
      'siteverify recusa',
      () => ({}),
      () => {
        t.siteverify = { success: false, 'error-codes': ['invalid-input-response'] }
      },
    ],
    [
      'ação errada',
      () => ({}),
      () => {
        t.siteverify = { success: true, action: 'login', hostname: 'fael.caporali.dev' }
      },
    ],
    [
      'sem ação',
      () => ({}),
      () => {
        t.siteverify = { success: true, hostname: 'fael.caporali.dev' }
      },
    ],
    [
      'hostname errado',
      () => ({}),
      () => {
        t.siteverify = { success: true, action: 'contact', hostname: 'evil.example' }
      },
    ],
    [
      'chave de teste em produção',
      () => ({}),
      () => {
        t.siteverify = { success: true, hostname: 'example.com', metadata: { result_with_testing_key: true } }
      },
    ],
  ])('Turnstile: %s → 403', async (_, patch, arrange) => {
    arrange()
    const r = await call(post({ ...valid, ...patch() }))
    expect(r.status).toBe(403)
    expect(t.send).not.toHaveBeenCalled()
  })
  it('Turnstile fora do ar → 403 (falha fechada)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network'))
    expect((await call(post(valid))).status).toBe(403)
  })
  it('manda o IP do visitante e o segredo para o siteverify', async () => {
    await call(post(valid, { ip: '198.51.100.7' }))
    const init = vi.mocked(fetch).mock.calls[0]?.[1]
    const body = new URLSearchParams(init?.body as URLSearchParams)
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
    const stmt = env.DB.prepare(
      "INSERT INTO messages (id, created_at, name, contact, body, status) VALUES (?, ?, 'x', 'x', 'x', 'sent')",
    )
    await env.DB.batch(Array.from({ length: DAILY_CAP }, (_, i) => stmt.bind(`old-${i}`, Date.now() - 1000)))
    const r = await call(post(valid))
    expect(r.status).toBe(429)
    expect(t.send).not.toHaveBeenCalled()
  })
})
