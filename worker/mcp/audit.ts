/**
 * Registro das chamadas do MCP e cotas diárias, no D1 do formulário (.wai/mcp/02-plano.md, T4 e T5). Sem o SDK: o cron
 * também usa. "Quem" é o assistente e a rede, nunca a pessoa: sem IP, e o texto livre dos argumentos vai com e-mail e
 * telefone mascarados e cortado. Nome, contato e mensagem do send_message não entram no registro.
 *
 * O D1 grátis para de gravar ao passar de 100 mil linhas escritas no dia UTC, e o formulário depende dele. Por isso
 * tudo o que o MCP grava passa por uma cota do dia. Acima da cota do registro a chamada responde igual e vai para a
 * fila MCP_LOG, que a grava quando a cota do dia seguinte abrir (D-MCP26).
 */

/**
 * Cotas por dia UTC. Registro: cada chamada grava ~3 linhas (a chamada, o índice e a cota); 2 mil = ~6% do
 * limite grátis do D1.
 */
export const DAILY = { log: 2000, message: 10, beacon: 20 } as const
type Kind = keyof typeof DAILY | 'log_lost' | 'summary'

/** O dia UTC (AAAA-MM-DD) de um instante, a chave das cotas. */
export const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Resultado de gastar cota: gastou, o teto já foi atingido, ou o banco falhou (nada se grava nem se envia). */
export type Took = 'ok' | 'full' | 'error'

/**
 * Gasta uma unidade do contador (dia, tipo) se ele ainda estiver abaixo de `cap`, numa instrução só (sem corrida entre
 * duas chamadas). Acima do teto o UPDATE não casa e nada é gravado.
 */
export async function bump(db: D1Database, day: string, kind: Kind, cap: number): Promise<Took> {
  try {
    const { meta } = await db
      .prepare(
        'INSERT INTO mcp_quota (day, kind, used) VALUES (?, ?, 1) ' +
          'ON CONFLICT (day, kind) DO UPDATE SET used = used + 1 WHERE used < ?',
      )
      .bind(day, kind, cap)
      .run()
    return meta.changes > 0 ? 'ok' : 'full'
  } catch {
    return 'error'
  }
}

/** A cota do dia UTC de `now`. */
export const take = (db: D1Database, kind: keyof typeof DAILY, now: number) => bump(db, utcDay(now), kind, DAILY[kind])

/**
 * Palavra com arroba entre letras: e-mail, mesmo sem ponto no domínio, ou perfil (@fulano). Sai a palavra inteira, com
 * a pontuação colada. Limite conhecido: e-mail disfarçado ("maria [at] gmail.com") passa.
 */
const isEmail = (word: string) => /\S@\S|^@\w/.test(word)
/**
 * Sequência de dígitos com separadores comuns; vira telefone a partir de 8 dígitos (CPF e documentos também saem),
 * menos quando é só ano (1900–2100), como "2019 2020" ou "2019-2020". Limite conhecido: telefone local de 7 dígitos
 * passa.
 */
const DIGITS = /\+?\(?\d[\d\s().-]*\d/g
const onlyYears = (m: string) =>
  m
    .split(/\D+/)
    .filter(Boolean)
    .every((g) => g.length === 4 && Number(g) >= 1900 && Number(g) <= 2100)
const maskDigits = (m: string) => (m.replace(/\D/g, '').length >= 8 && !onlyYears(m) ? '[telefone]' : m)

/** Texto livre como pode ser gravado: e-mail e telefone mascarados, uma linha, no máximo `max` caracteres. */
export function scrub(text: string, max = 200): string {
  const masked = text
    .split(/\s+/)
    .map((word) => (isEmail(word) ? '[e-mail]' : word))
    .join(' ')
    .replace(DIGITS, maskDigits)
    .trim()
  return Array.from(masked).slice(0, max).join('')
}

/** Cliente MCP de até 80 caracteres, uma linha (vai também no assunto do e-mail). */
const line = (s: string) =>
  Array.from(s.replace(/[\r\n\t]+/g, ' ').trim())
    .slice(0, 80)
    .join('')

/**
 * O cliente declarado: `clientInfo` (nome e versão) quando a requisição traz, senão o produto do User-Agent (a 1ª
 * palavra, sem o resto, que pode descrever a máquina). Os dois são autodeclarados.
 */
export function clientName(info: { name: string; version: string } | undefined, request: Request): string | null {
  if (info) return line(`${info.name} ${info.version}`)
  const product = request.headers.get('User-Agent')?.trim().split(/\s/)[0]
  return product ? line(`UA ${product}`) : null
}

export interface Call {
  tool: string
  args: Record<string, unknown> | null
  client: string | null
  outcome: string
  durationMs: number
}

/** O que a Cloudflare sabe da origem: organização da rede (Anthropic, OpenAI, provedor) e país. Nunca o IP. */
export function source(request: Request): { network: string | null; country: string | null } {
  const cf = request.cf as IncomingRequestCfProperties | undefined
  return {
    network: typeof cf?.asOrganization === 'string' ? line(cf.asOrganization) : null,
    country: typeof cf?.country === 'string' ? cf.country : null,
  }
}

/** Uma linha de mcp_calls, como vai ao D1 e, quando não cabe, à fila (JSON). */
export interface LogRow {
  created_at: number
  tool: string
  args: string | null
  client: string | null
  protocol: string | null
  network: string | null
  country: string | null
  outcome: string
  duration_ms: number
}

/**
 * Espera antes de tentar de novo quando o banco falha: 1 h, para uma queda longa do D1 não gastar as 10 mil operações
 * diárias da fila (cada nova tentativa é uma leitura); max_retries no wrangler.jsonc cobre as 24 h da fila.
 */
const RETRY_SECONDS = 3600
/** A fila aceita no máximo 24 h de espera (delaySeconds) e, no plano grátis, guarda a mensagem por 24 h. */
const MAX_DELAY_SECONDS = 24 * 3600
const QUEUE_RETENTION_MS = MAX_DELAY_SECONDS * 1000
/** Teto do contador de perdidas: ele também grava uma linha por chamada. */
const LOST_CAP = 10_000

/** Conta a chamada que não foi gravada nem guardada na fila (resumo semanal) e avisa no log do Worker. */
async function lose(db: D1Database, tool: string, now: number): Promise<void> {
  console.warn(JSON.stringify({ event: 'mcp_audit_lost', tool }))
  await bump(db, utcDay(now), 'log_lost', LOST_CAP)
}

/** Segundos até a cota do registro zerar (meia-noite UTC), com um minuto de folga para o relógio. */
export function untilNextUtcDay(now: number): number {
  const d = new Date(now)
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
  return Math.min(MAX_DELAY_SECONDS, Math.ceil((midnight - now) / 1000) + 60)
}

/**
 * Grava a linha se a cota do dia permitir. Senão devolve quanto esperar: até o dia seguinte (teto) ou 15 minutos (banco
 * fora do ar). Limite conhecido: se o INSERT falha depois de gastar a cota, a nova tentativa gasta outra unidade.
 */
async function store(db: D1Database, row: LogRow, now: number): Promise<number | null> {
  const took = await take(db, 'log', now)
  if (took === 'full') return untilNextUtcDay(now)
  if (took === 'error') return RETRY_SECONDS
  try {
    await db
      .prepare(
        'INSERT INTO mcp_calls (created_at, tool, args, client, protocol, network, country, outcome, duration_ms) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        row.created_at,
        row.tool,
        row.args,
        row.client,
        row.protocol,
        row.network,
        row.country,
        row.outcome,
        row.duration_ms,
      )
      .run()
    return null
  } catch {
    return RETRY_SECONDS
  }
}

/**
 * Grava a chamada; o que não cabe na cota do dia (ou encontra o banco fora do ar) vai para a fila com a espera certa.
 * Se a fila também recusar (10 mil operações por dia no plano grátis), a chamada é contada como perdida.
 */
export async function record(
  env: Pick<Env, 'DB' | 'MCP_LOG'>,
  request: Request,
  call: Call,
  now: number,
): Promise<void> {
  const { network, country } = source(request)
  const row: LogRow = {
    created_at: now,
    tool: call.tool,
    // Sem corte aqui: o JSON precisa continuar válido para o resumo semanal, e o esquema de cada ferramenta já limita
    // o tamanho (o maior, search_journey, fica em poucos KiB).
    args: call.args ? JSON.stringify(call.args) : null,
    client: call.client,
    protocol: line(request.headers.get('MCP-Protocol-Version') ?? '') || null,
    network,
    country,
    outcome: call.outcome,
    duration_ms: call.durationMs,
  }
  const wait = await store(env.DB, row, now)
  if (wait === null) return
  try {
    await env.MCP_LOG.send(row, { delaySeconds: wait })
  } catch {
    await lose(env.DB, call.tool, now)
  }
}

/**
 * Consumidor da fila MCP_LOG: grava cada linha com a hora original da chamada se a cota do dia permitir; a que não
 * cabe volta para a fila com a mesma espera. A fila guarda a mensagem por 24 h (plano grátis; a doc não diz se a espera
 * entra na conta, por isso conto desde o envio, o caso mais curto): a que não
 * caberia mais nesse prazo (excedente acima da cota de dois dias seguidos) sai da fila e é contada como perdida, em vez
 * de sumir calada. Até 2 consultas ao D1 por mensagem: o lote do wrangler.jsonc fica abaixo das 50 por invocação.
 */
export async function drainLog(batch: MessageBatch<LogRow>, db: D1Database, now: number): Promise<void> {
  for (const message of batch.messages) {
    const wait = await store(db, message.body, now)
    if (wait === null) {
      message.ack()
    } else if (now + wait * 1000 >= message.timestamp.getTime() + QUEUE_RETENTION_MS) {
      await lose(db, message.body.tool, now)
      message.ack()
    } else {
      message.retry({ delaySeconds: wait })
    }
  }
}

/** Retenção: apaga chamadas e cotas de antes de `before`. */
export async function purge(db: D1Database, before: number): Promise<number> {
  const [calls] = await db.batch([
    db.prepare('DELETE FROM mcp_calls WHERE created_at < ?').bind(before),
    db.prepare('DELETE FROM mcp_quota WHERE day < ?').bind(utcDay(before)),
  ])
  return calls?.meta.changes ?? 0
}
