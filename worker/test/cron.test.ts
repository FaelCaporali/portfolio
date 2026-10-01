/** Cron: reenvio de pendentes, desistência e retenção das mensagens (o lado do MCP está em mcp-send.test.ts). */
import { createExecutionContext, createScheduledController, waitOnExecutionContext } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import worker from '../index'
import { MAX_ATTEMPTS, RETENTION_MS } from '../message'
import { rows, t, useWorkerDoubles } from './helpers'

useWorkerDoubles()

describe('cron', () => {
  async function runCron(e: Env, at = Date.now()) {
    const ctx = createExecutionContext()
    worker.scheduled(createScheduledController({ scheduledTime: at, cron: '*/15 * * * *' }), e, ctx)
    await waitOnExecutionContext(ctx)
  }
  const seed = (id: string, createdAt: number, status = 'pending', attempts = 1) =>
    env.DB.prepare(
      "INSERT INTO messages (id, created_at, name, contact, reply_email, body, status, attempts) VALUES (?, ?, 'Maria', 'maria@example.com', 'maria@example.com', 'Olá, mensagem de teste.', ?, ?)",
    )
      .bind(id, createdAt, status, attempts)
      .run()

  it('reenvia pendentes com mais de 5 min; ignora recentes e enviadas', async () => {
    const now = Date.now()
    await seed('old', now - 10 * 60_000)
    await seed('fresh', now - 60_000)
    await seed('done', now - 10 * 60_000, 'sent')
    await runCron(t.env, now)
    // O mesmo cron manda o resumo semanal do MCP; aqui só contam os e-mails de contato.
    const contact = t.send.mock.calls.filter(([mail]) => mail.subject.startsWith('Contato'))
    expect(contact).toHaveLength(1)
    const byId = Object.fromEntries((await rows()).map((r) => [r.id, r]))
    expect(byId.old).toMatchObject({ status: 'sent', attempts: 2 })
    expect(byId.fresh).toMatchObject({ status: 'pending', attempts: 1 })
  })
  it(`desiste após ${MAX_ATTEMPTS} tentativas`, async () => {
    t.send.mockRejectedValue(new Error('E_INTERNAL_SERVER_ERROR'))
    await seed('tired', Date.now() - 10 * 60_000, 'pending', MAX_ATTEMPTS - 1)
    await runCron(t.env)
    expect((await rows())[0]).toMatchObject({
      status: 'failed',
      attempts: MAX_ATTEMPTS,
      last_error: 'E_INTERNAL_SERVER_ERROR',
    })
  })
  it('apaga mensagens com mais de 90 dias', async () => {
    const now = Date.now()
    await seed('ancient', now - RETENTION_MS - 60_000, 'sent')
    await seed('recent', now - RETENTION_MS + 60 * 60_000, 'sent')
    await runCron(t.env, now)
    expect((await rows()).map((r) => r.id)).toEqual(['recent'])
  })
})
