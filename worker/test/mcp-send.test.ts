/**
 * O que o MCP manda para fora (D-MCP1, D-MCP4, D-MCP5): send_message pelo canal do formulário com teto próprio, o
 * beacon por e-mail na hora, e no cron a retenção do registro e o resumo semanal.
 */
import type { Client } from '@modelcontextprotocol/client'
import { createExecutionContext, createScheduledController, waitOnExecutionContext } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import worker from '../index'
import { DAILY, utcDay } from '../mcp/audit'
import { lastDue } from '../mcp/notify'
import { DAILY_CAP, RETENTION_MS } from '../message'
import { brokenDb, call, post, rows, sentMail, t, useWorkerDoubles, valid } from './helpers'
import { connect } from './mcp-client'

useWorkerDoubles()

const text = (r: Awaited<ReturnType<Client['callTool']>>) => (r.content as { text: string }[])[0]?.text ?? ''
const loggedArgs = () =>
  env.DB.prepare('SELECT tool, args, outcome FROM mcp_calls ORDER BY id')
    .all<{ tool: string; args: string; outcome: string }>()
    .then((r) => r.results)
const fillQuota = (kind: string, used: number) =>
  env.DB.prepare('INSERT INTO mcp_quota (day, kind, used) VALUES (?, ?, ?)').bind(utcDay(Date.now()), kind, used).run()

const message = {
  name: 'Maria Silva',
  contact: 'maria@example.com',
  message: 'Olá, Fael! Vi seu portfólio pelo assistente.',
  subject: 'Staff Engineer na ACME',
}

describe('send_message', () => {
  it('vai pelo envio do formulário, marcada com o cliente; o registro não guarda nome, contato nem texto', async () => {
    const client = await connect(false, t.env)
    const r = await client.callTool({ name: 'send_message', arguments: message })
    expect(r.isError).toBeFalsy()
    const mail = sentMail()
    expect(mail.subject).toBe('Contato pelo MCP do portfólio: Maria Silva')
    expect(mail.replyTo).toEqual({ email: 'maria@example.com', name: 'Maria Silva' })
    expect(mail.text).toContain('[About: Staff Engineer na ACME]\n\nOlá, Fael!')
    expect(mail.text).toContain('MCP do portfólio (teste-portfolio 1.0.0)')
    expect((await rows())[0]).toMatchObject({ status: 'sent', via: 'teste-portfolio 1.0.0', country: 'BR' })
    const logged = JSON.stringify(await loggedArgs())
    expect(logged).toContain('"outcome":"sent"')
    for (const secret of ['Maria', 'maria@example.com', 'portfólio pelo', 'ACME']) expect(logged).not.toContain(secret)
  })

  it('contato inválido: nada é enviado nem gasta a cota', async () => {
    const client = await connect(false, t.env)
    const r = await client.callTool({ name: 'send_message', arguments: { ...message, contact: 'me ache no linkedin' } })
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/contact/)
    expect(t.send).not.toHaveBeenCalled()
    expect(await env.DB.prepare("SELECT * FROM mcp_quota WHERE kind = 'message'").first()).toBeNull()
  })

  it(`teto de ${DAILY.message} por dia: a próxima é recusada, aponta os contatos e não envia`, async () => {
    await fillQuota('message', DAILY.message)
    const client = await connect(false, t.env)
    const r = await client.callTool({ name: 'send_message', arguments: message })
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/get_profile/)
    expect(t.send).not.toHaveBeenCalled()
    expect((await loggedArgs())[0]?.outcome).toBe('limited')
  })

  it('banco fora do ar: nada é enviado, e a resposta não finge que é o teto', async () => {
    const client = await connect(false, { ...t.env, DB: brokenDb })
    const r = await client.callTool({ name: 'send_message', arguments: message })
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/could not check/)
    expect(t.send).not.toHaveBeenCalled()
  })

  it('mensagens do MCP não gastam o teto do formulário', async () => {
    const stmt = env.DB.prepare(
      "INSERT INTO messages (id, created_at, name, contact, body, status, via) VALUES (?, ?, 'x', 'x', 'x', 'sent', 'mcp')",
    )
    await env.DB.batch(Array.from({ length: DAILY_CAP }, (_, i) => stmt.bind(`mcp-${i}`, Date.now() - 1000)))
    expect((await call(post(valid))).status).toBe(200)
  })
})

describe('beacon', () => {
  it('e-mail na hora com cargo, empresa, nota, cliente e rede; o registro mascara a nota', async () => {
    const client = await connect(false, t.env)
    const note = 'Falar com a Ana: ana@acme.example'
    const r = await client.callTool({
      name: 'beacon',
      arguments: { lang: 'pt', role: 'Staff Engineer', company: 'ACME', note },
    })
    const answer = JSON.parse(text(r)) as { sent: boolean; message: string }
    expect(answer.sent).toBe(true)
    expect(answer.message).toMatch(/^Sinal enviado/)
    const mail = sentMail()
    expect(mail.subject).toBe('Beacon do MCP: ACME · Staff Engineer')
    expect(mail.text).toContain(`Nota: ${note}`)
    expect(mail.text).toContain('Cliente: teste-portfolio 1.0.0 · rede: Rede de Teste · país: BR')
    const [row] = await loggedArgs()
    expect(row).toMatchObject({ tool: 'beacon', outcome: 'ok' })
    expect(JSON.parse(row?.args ?? '{}')).toEqual({
      role: 'Staff Engineer',
      company: 'ACME',
      note: 'Falar com a Ana: [e-mail]',
    })
  })

  it('sem nenhum campo também vai: nenhum dado é necessário', async () => {
    const client = await connect(false, t.env)
    expect((await client.callTool({ name: 'beacon' })).isError).toBeFalsy()
    expect(sentMail().subject).toBe('Beacon do MCP: sem cargo nem empresa')
  })

  it(`teto de ${DAILY.beacon} por dia; e-mail que falha fica no registro`, async () => {
    const client = await connect(false, t.env)
    t.send.mockRejectedValueOnce(new Error('E_INTERNAL_SERVER_ERROR'))
    expect((await client.callTool({ name: 'beacon' })).isError).toBe(true)
    await env.DB.prepare("UPDATE mcp_quota SET used = ? WHERE kind = 'beacon'").bind(DAILY.beacon).run()
    const limited = await client.callTool({ name: 'beacon' })
    expect(text(limited)).toMatch(/not sent/)
    expect(t.send).toHaveBeenCalledOnce()
    expect((await loggedArgs()).map((r) => r.outcome)).toEqual(['email_failed', 'limited'])
  })
})

describe('cron do MCP', () => {
  async function runCron(at: number) {
    const ctx = createExecutionContext()
    worker.scheduled(createScheduledController({ scheduledTime: at, cron: '*/15 * * * *' }), t.env, ctx)
    await waitOnExecutionContext(ctx)
  }
  const seed = (at: number, tool: string, args: unknown, outcome = 'ok') =>
    env.DB.prepare(
      "INSERT INTO mcp_calls (created_at, tool, args, client, network, country, outcome, duration_ms) VALUES (?, ?, ?, 'Claude 1.0', 'Anthropic, PBC', 'US', ?, 0)",
    )
      .bind(at, tool, JSON.stringify(args), outcome)
      .run()

  it('a hora do resumo: a segunda-feira 11h UTC mais recente', () => {
    const monday = Date.UTC(2026, 9, 5, 11)
    expect(lastDue(monday)).toBe(monday)
    expect(lastDue(monday - 60_000)).toBe(monday - 7 * 24 * 3600_000)
    expect(lastDue(Date.UTC(2026, 9, 11, 23))).toBe(monday)
  })

  /** Uma quarta-feira fixa: o teste não depende de rodar perto da virada da semana. */
  const WEDNESDAY = Date.UTC(2026, 9, 7, 12)

  it('resumo semanal uma vez: contagens por ferramenta, cliente, rede, país e o que mais pediram', async () => {
    const due = lastDue(WEDNESDAY)
    await seed(due - 3600_000, 'search_journey', { lang: 'en', tools: ['React', 'n8n'], text: 'agents' })
    await seed(due - 7200_000, 'search_journey', { lang: 'en', tools: ['React'] })
    await seed(due - 7200_000, 'get_checkpoint', { lang: 'pt', id: 'mpc' })
    await seed(due - 7200_000, 'beacon', {}, 'email_failed')
    await seed(due - 8 * 24 * 3600_000, 'get_profile', { lang: 'en' }) // semana anterior: fora
    await runCron(WEDNESDAY)
    const mail = sentMail()
    expect(mail.subject).toBe('Resumo semanal do MCP: 4 chamadas')
    expect(mail.text).toContain('Por ferramenta: search_journey 2 · beacon 1 · get_checkpoint 1')
    expect(mail.text).toContain('Por cliente: Claude 1.0 4')
    expect(mail.text).toContain('Por rede: Anthropic, PBC 4')
    expect(mail.text).toContain('Stack: React 2 · n8n 1')
    expect(mail.text).toContain('Textos buscados: agents 1')
    expect(mail.text).toContain('Marcos abertos: mpc 1')
    expect(mail.text).toContain('Falhas e limites: beacon: email_failed 1')
    await runCron(WEDNESDAY + 15 * 60_000)
    expect(t.send).toHaveBeenCalledOnce()
  })

  it('resumo que falha é tentado de novo, no máximo 3 vezes na semana; depois do envio, nenhuma', async () => {
    t.send.mockRejectedValueOnce(new Error('E_INTERNAL_SERVER_ERROR'))
    for (let i = 0; i < 3; i++) await runCron(WEDNESDAY + i * 15 * 60_000)
    expect(t.send).toHaveBeenCalledTimes(2)
    t.send.mockRejectedValue(new Error('E_INTERNAL_SERVER_ERROR'))
    const nextWeek = WEDNESDAY + 7 * 24 * 3600_000
    for (let i = 0; i < 5; i++) await runCron(nextWeek + i * 15 * 60_000)
    expect(t.send).toHaveBeenCalledTimes(5)
  })

  it('apaga registro e cotas com mais de 90 dias', async () => {
    const now = Date.now()
    await seed(now - RETENTION_MS - 60_000, 'get_profile', {})
    await seed(now - RETENTION_MS + 3600_000, 'get_profile', {})
    await env.DB.prepare("INSERT INTO mcp_quota (day, kind, used) VALUES (?, 'log', 1), (?, 'log', 1)")
      .bind(utcDay(now - RETENTION_MS - 2 * 24 * 3600_000), utcDay(now))
      .run()
    await runCron(now)
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM mcp_calls').first('n')).toBe(1)
    const days = await env.DB.prepare("SELECT day FROM mcp_quota WHERE kind = 'log'").all<{ day: string }>()
    expect(days.results.map((d) => d.day)).toEqual([utcDay(now)])
  })
})
