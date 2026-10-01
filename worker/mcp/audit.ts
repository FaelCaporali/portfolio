/**
 * Registro das chamadas do MCP e cotas diárias, no D1 do formulário (.wai/mcp/02-plano.md, T4 e T5). Sem o SDK: o cron
 * também usa. "Quem" é o assistente e a rede, nunca a pessoa: sem IP, e o texto livre dos argumentos vai com e-mail e
 * telefone mascarados e cortado. Nome, contato e mensagem do send_message não entram no registro.
 *
 * O D1 grátis para de gravar ao passar de 100 mil linhas escritas no dia UTC, e o formulário depende dele. Por isso
 * tudo o que o MCP grava passa por uma cota do dia: acima dela, nada mais é gravado (a chamada responde igual).
 */

/**
 * Cotas por dia UTC. Registro: cada chamada grava ~3 linhas (a chamada, o índice e a cota); 2 mil = ~6% do
 * limite grátis do D1.
 */
export const DAILY = { log: 2000, message: 10, beacon: 20 } as const
type Kind = keyof typeof DAILY | 'summary'

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

/** Grava a chamada se a cota de registro do dia permitir. Falha de banco só vira aviso no log do Worker. */
export async function record(db: D1Database, request: Request, call: Call, now: number): Promise<void> {
  try {
    if ((await take(db, 'log', now)) !== 'ok') return
    const { network, country } = source(request)
    // Sem corte aqui: o JSON precisa continuar válido para o resumo semanal, e o esquema de cada ferramenta já limita
    // o tamanho (o maior, search_journey, fica em poucos KiB).
    const args = call.args ? JSON.stringify(call.args) : null
    await db
      .prepare(
        'INSERT INTO mcp_calls (created_at, tool, args, client, protocol, network, country, outcome, duration_ms) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        now,
        call.tool,
        args,
        call.client,
        line(request.headers.get('MCP-Protocol-Version') ?? '') || null,
        network,
        country,
        call.outcome,
        call.durationMs,
      )
      .run()
  } catch {
    console.warn(JSON.stringify({ event: 'mcp_audit_failed', tool: call.tool }))
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
