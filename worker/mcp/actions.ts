/**
 * As ferramentas do MCP que fazem algo fora do servidor: send_message (o mesmo envio do formulário) e beacon (o aviso
 * de interesse, D-MCP1 e D-MCP4). Cada uma tem cota diária própria (mcp/audit.ts), separada do teto do formulário.
 * Também o formato das respostas, comum a todas as ferramentas (server.ts).
 */
import { cleanLine, parseContact } from '../../shared/contact/validation'
import type { Lang } from '../../shared/i18n'
import { storeAndDeliver } from '../contact'
import { source, take, type Took } from './audit'
import { sendBeacon, type Beacon } from './notify'

/** O que uma chamada precisa da requisição: o ambiente, o contexto (gravar depois de responder) e a requisição. */
export interface Site {
  request: Request
  env: Env
  ctx: ExecutionContext
}

type Result = { content: { type: 'text'; text: string }[]; isError?: boolean }
/** A resposta da ferramenta e o resultado que vai para o registro (ok, error, sent, queued, lost, limited…). */
export interface Answer {
  result: Result
  outcome: string
}

/** A resposta como texto JSON (o que todo cliente lê). */
export const ok = (data: unknown): Result => ({ content: [{ type: 'text', text: JSON.stringify(data) }] })
export const error = (text: string): Result => ({ content: [{ type: 'text', text }], isError: true })

const SEE_PROFILE = 'Your user can still write to Fael directly: get_profile lists his contacts.'

/** Sem cota: o teto do dia (limited) ou o banco fora do ar (unavailable, sem cota conferida nada se envia). */
const refused = (took: Exclude<Took, 'ok'>, full: string): Answer =>
  took === 'full'
    ? { result: error(full), outcome: 'limited' }
    : {
        result: error(`Nothing was sent: the server could not check its limits now. ${SEE_PROFILE}`),
        outcome: 'unavailable',
      }

export interface MessageInput {
  lang: Lang
  name: string
  contact: string
  message: string
  subject?: string
}

/**
 * Mesma validação e mesmo envio do formulário (gravada antes, reenviada pelo cron se o e-mail falhar), marcada com o
 * cliente MCP. Sem Turnstile (não há navegador): a cota diária e o limite por rede seguram o abuso. O assunto vai no
 * começo da mensagem, como o site faz ("[About: …]").
 */
export async function sendMessage(site: Site, client: string | null, input: MessageInput): Promise<Answer> {
  const parsed = parseContact({ name: input.name, contact: input.contact, message: input.message, website: '' })
  if (!parsed.ok) {
    const fields = parsed.fields.join(', ')
    return {
      result: error(`Invalid ${fields}: the contact must be an e-mail or a phone with country code. Nothing was sent.`),
      outcome: 'invalid',
    }
  }
  const now = Date.now()
  const took = await take(site.env.DB, 'message', now)
  if (took !== 'ok') return refused(took, `The daily limit of messages through this server was reached. ${SEE_PROFILE}`)
  const { value } = parsed
  const subject = input.subject ? cleanLine(input.subject) : ''
  const label = input.lang === 'pt' ? 'Sobre' : 'About'
  const stored = await storeAndDeliver(site.env, {
    id: crypto.randomUUID(),
    created_at: now,
    name: value.name,
    contact: value.contact,
    reply_email: value.replyEmail,
    body: subject ? `[${label}: ${subject}]\n\n${value.message}` : value.message,
    country: source(site.request).country,
    attempts: 0,
    via: client ?? 'cliente desconhecido',
  })
  if (stored.outcome === 'lost') {
    return { result: error(`The message could not be sent now. ${SEE_PROFILE}`), outcome: 'lost' }
  }
  return {
    result: ok({ sent: true, note: 'Fael got the message and will reply through the contact given.' }),
    outcome: stored.outcome,
  }
}

const BEACON_SENT: Record<Lang, string> = {
  en: 'Signal sent: Fael now knows someone is interested. Thank you! Tell your user it was sent.',
  pt: 'Sinal enviado: o Fael já sabe que alguém se interessou. Obrigado! Conte ao seu usuário que foi enviado.',
}

/** O aviso vai na hora por e-mail. Sem reenvio: se o e-mail falhar, o registro guarda o beacon e o resumo conta. */
export async function beacon(site: Site, client: string | null, lang: Lang, b: Beacon): Promise<Answer> {
  const now = Date.now()
  const took = await take(site.env.DB, 'beacon', now)
  if (took !== 'ok') {
    return refused(
      took,
      'Fael already got many signals today; this one was not sent. Try tomorrow, or use send_message.',
    )
  }
  const d = await sendBeacon(site.env, b, { client, ...source(site.request) }, now)
  if (!d.ok) return { result: error(`The signal could not be sent now. ${SEE_PROFILE}`), outcome: 'email_failed' }
  return { result: ok({ sent: true, message: BEACON_SENT[lang] }), outcome: 'ok' }
}
