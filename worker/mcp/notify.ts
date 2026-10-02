/**
 * E-mails do MCP para o Fael (D-MCP4 e D-MCP5): o beacon na hora e o resumo semanal. Sem o SDK: o resumo sai do cron.
 * Pela mesma binding do formulário (destino e remetente fixos no wrangler.jsonc); só texto puro.
 */
import { cleanLine, cleanText } from '../../shared/contact/validation'
import { MCP_URL } from '../../shared/mcp'
import { BRT, DESTINATION, send, SENDER } from '../mail'
import type { Delivery } from '../message'
import { bump, DAILY, utcDay } from './audit'

const FROM = { ...SENDER, name: 'Portfólio · MCP' }
const FOOTER = ['', '--', `MCP do portfólio · ${MCP_URL}`]

/** O que o agente contou no beacon, já limpo (uma linha, ou parágrafos na nota) e com os tetos do esquema. */
export interface Beacon {
  role?: string
  company?: string
  note?: string
}

/** De onde veio a chamada, como o registro guarda. */
export interface Caller {
  client: string | null
  network: string | null
  country: string | null
}

const orNot = (v: string | null | undefined) => v || 'não informado'

/** O beacon vai como o agente mandou (sem máscara: é o recado para o Fael); assunto montado de campos sem quebra. */
function composeBeacon(b: Beacon, caller: Caller, now: number): EmailMessageBuilder {
  const company = b.company ? cleanLine(b.company) : ''
  const role = b.role ? cleanLine(b.role) : ''
  const lines = [
    'Um agente mandou um beacon pelo MCP do portfólio: alguém se interessou.',
    '',
    `Cargo: ${orNot(role)}`,
    `Empresa: ${orNot(company)}`,
    `Nota: ${b.note ? cleanText(b.note) : 'nenhuma'}`,
    '',
    `Cliente: ${orNot(caller.client)} · rede: ${orNot(caller.network)} · país: ${orNot(caller.country)}`,
    `Recebido em: ${BRT.format(now)} (Brasília)`,
    ...FOOTER,
  ]
  const about = [company, role].filter(Boolean).join(' · ')
  return {
    from: FROM,
    to: DESTINATION,
    subject: `Beacon do MCP: ${about || 'sem cargo nem empresa'}`,
    text: lines.join('\n'),
  }
}

export const sendBeacon = (env: Env, b: Beacon, caller: Caller, now: number): Promise<Delivery> =>
  send(env, composeBeacon(b, caller, now))

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
/** Segunda-feira, 11h UTC (8h em Brasília). */
const SUMMARY_HOUR_UTC = 11

/** O último horário de resumo que já passou: a segunda-feira 11h UTC mais recente até `now`. */
export function lastDue(now: number): number {
  const d = new Date(now)
  const sinceMonday = (d.getUTCDay() + 6) % 7
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceMonday, SUMMARY_HOUR_UTC)
  return monday <= now ? monday : monday - WEEK_MS
}

type Row = { k: string | null; n: number }

/** Contagens da semana [from, to) num lote só; o agrupamento roda no D1, não na CPU do Worker. */
async function weekNumbers(db: D1Database, from: number, to: number) {
  const window = 'created_at >= ?1 AND created_at < ?2'
  const top = (key: string, where = '') =>
    db
      .prepare(
        `SELECT ${key} AS k, COUNT(*) AS n FROM mcp_calls WHERE ${window} ${where} GROUP BY k ORDER BY n DESC, k LIMIT 10`,
      )
      .bind(from, to)
  const tags = (group: string) =>
    db
      .prepare(
        'SELECT j.value AS k, COUNT(*) AS n FROM mcp_calls c, json_each(c.args, ?3) j ' +
          `WHERE c.${window} AND c.tool = 'search_journey' AND json_valid(c.args) GROUP BY k ORDER BY n DESC, k LIMIT 10`,
      )
      .bind(from, to, `$.${group}`)
  const field = (tool: string, path: string) =>
    top(
      `json_extract(args, '${path}')`,
      `AND tool = '${tool}' AND json_valid(args) AND json_extract(args, '${path}') IS NOT NULL`,
    )
  const results = await db.batch<Row>([
    top("'total'"),
    top('tool'),
    top("COALESCE(client, 'desconhecido')"),
    top("COALESCE(network, 'desconhecida')"),
    top("COALESCE(country, '?')"),
    tags('tools'),
    tags('concepts'),
    tags('skills'),
    field('search_journey', '$.text'),
    field('get_checkpoint', '$.id'),
    top("tool || ': ' || outcome", "AND outcome NOT IN ('ok', 'sent')"),
    db
      .prepare(
        'SELECT NULL AS k, COUNT(*) AS n FROM messages WHERE via IS NOT NULL AND created_at >= ?1 AND created_at < ?2',
      )
      .bind(from, to),
    // Dias UTC inteiros de segunda a domingo (a janela das chamadas começa e termina às 11h UTC de segunda).
    db
      .prepare(
        "SELECT NULL AS k, COUNT(*) AS n FROM mcp_quota WHERE kind = 'log' AND used >= ?1 AND day >= ?2 AND day < ?3",
      )
      .bind(DAILY.log, utcDay(from), utcDay(to)),
    db
      .prepare(
        "SELECT NULL AS k, COALESCE(SUM(used), 0) AS n FROM mcp_quota WHERE kind = 'log_lost' AND day >= ?1 AND day < ?2",
      )
      .bind(utcDay(from), utcDay(to)),
  ])
  return results.map((r) => r.results)
}

const list = (rows: Row[] | undefined) => (rows?.length ? rows.map((r) => `${r.k ?? '?'} ${r.n}`).join(' · ') : '—')
const count = (rows: Row[] | undefined) => rows?.[0]?.n ?? 0

function composeSummary(numbers: Row[][], from: number, to: number): EmailMessageBuilder {
  const [
    total,
    tools,
    clients,
    networks,
    countries,
    stack,
    concepts,
    skills,
    texts,
    steps,
    problems,
    messages,
    capped,
    lost,
  ] = numbers
  const period = `${BRT.format(from).slice(0, 5)} a ${BRT.format(to - 1).slice(0, 5)}`
  const lines = [
    `Semana de ${period} (horário de Brasília).`,
    '',
    `Chamadas registradas: ${count(total)}` +
      (count(capped)
        ? ` (a cota de ${DAILY.log}/dia esgotou em ${count(capped)} dia(s); o excedente foi para a fila e é gravado no dia seguinte)`
        : '') +
      (count(lost) ? `; ${count(lost)} não couberam nem na fila e não foram gravadas` : ''),
    `Mensagens pelo MCP: ${count(messages)}`,
    '',
    `Por ferramenta: ${list(tools)}`,
    `Por cliente: ${list(clients)}`,
    `Por rede: ${list(networks)}`,
    `Por país: ${list(countries)}`,
    '',
    'O que mais pediram',
    `Stack: ${list(stack)}`,
    `Conceitos: ${list(concepts)}`,
    `Habilidades: ${list(skills)}`,
    `Textos buscados: ${list(texts)}`,
    `Marcos abertos: ${list(steps)}`,
    '',
    `Falhas e limites: ${list(problems)}`,
    ...FOOTER,
  ]
  return {
    from: FROM,
    to: DESTINATION,
    subject: `Resumo semanal do MCP: ${count(total)} chamadas`,
    text: lines.join('\n'),
  }
}

/** Tentativas por semana: o cron de 15 minutos tenta de novo depois de uma falha, até este teto. */
const SUMMARY_TRIES = 3

/**
 * Resumo da semana encerrada na última segunda 11h UTC, uma vez por semana. Roda no cron de 15 minutos. A tentativa é
 * contada ANTES de consultar e enviar, e o envio bem-sucedido fecha a semana: nem um e-mail que não chega nem um D1 que
 * recusa a marca fazem o cron refazer as consultas (até 14 mil linhas lidas cada) a cada 15 minutos. Semana sem
 * chamadas também vai: é o sinal de que o registro está vivo.
 */
export async function weeklySummary(env: Env, now: number): Promise<'sent' | 'done' | 'failed'> {
  const to = lastDue(now)
  const week = utcDay(to)
  if ((await bump(env.DB, week, 'summary', SUMMARY_TRIES)) !== 'ok') return 'done'
  const from = to - WEEK_MS
  const d = await send(env, composeSummary(await weekNumbers(env.DB, from, to), from, to))
  if (!d.ok) return 'failed'
  await env.DB.prepare("UPDATE mcp_quota SET used = ? WHERE day = ? AND kind = 'summary'")
    .bind(SUMMARY_TRIES, week)
    .run()
  return 'sent'
}
