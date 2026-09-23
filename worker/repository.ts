/** Mensagens no D1. Só acesso a dados, consultas sempre parametrizadas; as regras vêm de message.ts. */
import { statusAfter, type Delivery, type Message } from './message'

export async function insert(db: D1Database, m: Message): Promise<void> {
  await db
    .prepare(
      'INSERT INTO messages (id, created_at, name, contact, reply_email, body, country, attempts) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(m.id, m.created_at, m.name, m.contact, m.reply_email, m.body, m.country, m.attempts)
    .run()
}

/** Registra o resultado de uma tentativa (a contagem de tentativas já inclui esta). */
export async function record(db: D1Database, id: string, attempts: number, d: Delivery, now: number): Promise<void> {
  const status = statusAfter(attempts, d)
  if (d.ok) {
    await db
      .prepare(
        'UPDATE messages SET status = ?, attempts = ?, sent_at = ?, message_id = ?, last_error = NULL WHERE id = ?',
      )
      .bind(status, attempts, now, d.messageId, id)
      .run()
  } else {
    await db
      .prepare('UPDATE messages SET status = ?, attempts = ?, last_error = ? WHERE id = ?')
      .bind(status, attempts, d.code, id)
      .run()
  }
}

export async function countSince(db: D1Database, since: number): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM messages WHERE created_at >= ?')
    .bind(since)
    .first<{ n: number }>()
  return row?.n ?? 0
}

/** Pendentes criadas antes de `before`, das mais antigas para as mais novas. */
export async function pendingBefore(db: D1Database, before: number, limit: number): Promise<Message[]> {
  const { results } = await db
    .prepare(
      'SELECT id, created_at, name, contact, reply_email, body, country, attempts FROM messages ' +
        "WHERE status = 'pending' AND created_at < ? ORDER BY created_at LIMIT ?",
    )
    .bind(before, limit)
    .all<Message>()
  return results
}

/** Apaga as criadas antes de `before`; devolve quantas saíram. */
export async function deleteBefore(db: D1Database, before: number): Promise<number> {
  const { meta } = await db.prepare('DELETE FROM messages WHERE created_at < ?').bind(before).run()
  return meta.changes
}
