/**
 * Mensagens no D1 e entrega por e-mail. A mensagem é gravada antes do envio; o cron reenvia o que ficou pendente.
 * Consultas sempre parametrizadas.
 */
import { asPhone } from './validate'

export const SENDER = { email: 'worker@mail.caporali.dev', name: 'Portfólio · contato' }
export const DESTINATION = 'fael@caporali.dev'
/** Tentativas de envio (a do formulário + as do cron) antes de desistir. */
export const MAX_ATTEMPTS = 5
export const RETENTION_MS = 90 * 24 * 60 * 60 * 1000
/** O cron só pega mensagens com mais de 5 minutos, para não disputar com o envio do próprio formulário. */
export const RETRY_AFTER_MS = 5 * 60 * 1000
/** Teto global por 24 h: segura uma enxurrada que passe pelo Turnstile. */
export const DAILY_CAP = 50

export interface Message {
  id: string
  created_at: number
  name: string
  contact: string
  reply_email: string | null
  body: string
  country: string | null
  attempts: number
}

const BRT = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })

/** Só texto puro: nada do visitante vira HTML. Assunto montado aqui, de campo já sem quebras de linha. */
export function compose(m: Message): EmailMessageBuilder {
  const phone = m.reply_email ? null : asPhone(m.contact)
  const lines = [
    `Nome: ${m.name}`,
    m.reply_email ? `E-mail: ${m.reply_email} (responda este e-mail)` : `Telefone: ${m.contact}`,
    ...(phone ? [`WhatsApp: https://wa.me/${phone}`] : []),
    `Recebida em: ${BRT.format(m.created_at)} (Brasília)${m.country ? ` · país: ${m.country}` : ''}`,
    '',
    m.body,
    '',
    '--',
    `Formulário de fael.caporali.dev · id ${m.id}`,
  ]
  return {
    from: SENDER,
    to: DESTINATION,
    ...(m.reply_email ? { replyTo: { email: m.reply_email, name: m.name } } : {}),
    subject: `Contato pelo portfólio: ${m.name}`,
    text: lines.join('\n'),
  }
}

/** Código do erro da binding (E_...), nunca a mensagem, que pode ecoar dados. */
export function errorCode(e: unknown): string {
  const code = (e as { code?: unknown })?.code
  if (typeof code === 'string' && /^E_[A-Z_]{1,40}$/.test(code)) return code
  const match = e instanceof Error ? /\bE_[A-Z_]{1,40}\b/.exec(e.message) : null
  return match?.[0] ?? 'E_UNKNOWN'
}

export type Delivery = { ok: true; messageId: string } | { ok: false; code: string }

export async function deliver(env: Env, m: Message): Promise<Delivery> {
  try {
    const { messageId } = await env.EMAIL.send(compose(m))
    return { ok: true, messageId }
  } catch (e) {
    return { ok: false, code: errorCode(e) }
  }
}

export async function insert(db: D1Database, m: Message): Promise<void> {
  await db
    .prepare('INSERT INTO messages (id, created_at, name, contact, reply_email, body, country, attempts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(m.id, m.created_at, m.name, m.contact, m.reply_email, m.body, m.country, m.attempts)
    .run()
}

/** Registra o resultado de uma tentativa (a contagem de tentativas já inclui esta). */
export async function record(db: D1Database, id: string, attempts: number, d: Delivery, now: number): Promise<void> {
  if (d.ok) {
    await db
      .prepare("UPDATE messages SET status = 'sent', attempts = ?, sent_at = ?, message_id = ?, last_error = NULL WHERE id = ?")
      .bind(attempts, now, d.messageId, id)
      .run()
  } else {
    await db
      .prepare('UPDATE messages SET status = ?, attempts = ?, last_error = ? WHERE id = ?')
      .bind(attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', attempts, d.code, id)
      .run()
  }
}

export async function countSince(db: D1Database, since: number): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM messages WHERE created_at >= ?').bind(since).first<{ n: number }>()
  return row?.n ?? 0
}

/** Cron: reenvia pendentes e apaga o que passou da retenção. */
export async function retryAndPurge(env: Env, now: number): Promise<{ retried: number; sent: number; purged: number }> {
  const { results } = await env.DB.prepare(
    "SELECT id, created_at, name, contact, reply_email, body, country, attempts FROM messages WHERE status = 'pending' AND created_at < ? ORDER BY created_at LIMIT 20",
  )
    .bind(now - RETRY_AFTER_MS)
    .all<Message>()
  let sent = 0
  for (const m of results) {
    const d = await deliver(env, m)
    await record(env.DB, m.id, m.attempts + 1, d, now)
    if (d.ok) sent++
    else console.warn(JSON.stringify({ event: 'contact_retry_failed', id: m.id, code: d.code, attempts: m.attempts + 1 }))
  }
  const purge = await env.DB.prepare('DELETE FROM messages WHERE created_at < ?').bind(now - RETENTION_MS).run()
  return { retried: results.length, sent, purged: purge.meta.changes }
}
