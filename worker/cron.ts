/**
 * Tarefa agendada: reenvia o que ficou pendente, apaga o que passou da retenção e manda o resumo semanal do site e do
 * MCP.
 */
import { deliver } from './mail'
import { purge } from './mcp/audit'
import { weeklySummary } from './mcp/notify'
import { RETENTION_MS, RETRY_AFTER_MS } from './message'
import { deleteBefore, pendingBefore, record } from './repository'

/** Por execução: o cron roda a cada 15 minutos, 20 por vez cobre com folga o teto diário. */
const BATCH = 20

export async function retryAndPurge(env: Env, now: number): Promise<{ retried: number; sent: number; purged: number }> {
  const pending = await pendingBefore(env.DB, now - RETRY_AFTER_MS, BATCH)
  let sent = 0
  for (const m of pending) {
    const attempts = m.attempts + 1
    const d = await deliver(env, m)
    await record(env.DB, m.id, attempts, d, now)
    if (d.ok) sent++
    else console.warn(JSON.stringify({ event: 'contact_retry_failed', id: m.id, code: d.code, attempts }))
  }
  const purged = await deleteBefore(env.DB, now - RETENTION_MS)
  return { retried: pending.length, sent, purged }
}

/**
 * O MCP no mesmo cron: retenção do registro (90 dias, como as mensagens) e o resumo semanal quando for a hora. Cada
 * etapa falha sozinha: um erro na limpeza não impede o resumo, e o erro vai para o log.
 */
export async function mcpHousekeeping(env: Env, now: number): Promise<{ purged: number | 'failed'; summary: string }> {
  const purged = await purge(env.DB, now - RETENTION_MS).catch(() => 'failed' as const)
  const summary = await weeklySummary(env, now).catch(() => 'failed')
  return { purged, summary }
}
