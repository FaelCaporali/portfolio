/** Composição e entrega dos e-mails pela binding send_email (destino e remetente fixos no wrangler.jsonc). */
import { asPhone } from '../shared/contact/validation'
import type { Delivery, Message } from './message'

export const SENDER = { email: 'worker@mail.caporali.dev', name: 'Portfólio · contato' }
export const DESTINATION = 'fael@caporali.dev'

export const BRT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
})

/** Só texto puro: nada do visitante vira HTML. Assunto montado aqui, de campo já sem quebras de linha. */
export function compose(m: Message): EmailMessageBuilder {
  const phone = m.reply_email ? null : asPhone(m.contact)
  const lines = [
    `Nome: ${m.name}`,
    m.reply_email ? `E-mail: ${m.reply_email} (responda este e-mail)` : `Telefone: ${m.contact}`,
    ...(phone ? [`WhatsApp: https://wa.me/${phone}`] : []),
    `Recebida em: ${BRT.format(m.created_at)} (Brasília)` + (m.country ? ` · país: ${m.country}` : ''),
    '',
    m.body,
    '',
    '--',
    m.via ? `MCP do portfólio (${m.via}) · id ${m.id}` : `Formulário de fael.caporali.dev · id ${m.id}`,
  ]
  return {
    from: SENDER,
    to: DESTINATION,
    ...(m.reply_email ? { replyTo: { email: m.reply_email, name: m.name } } : {}),
    subject: m.via ? `Contato pelo MCP do portfólio: ${m.name}` : `Contato pelo portfólio: ${m.name}`,
    text: lines.join('\n'),
  }
}

/** Código do erro da binding (E_...), nunca a mensagem, que pode ecoar dados. */
function errorCode(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code
  if (typeof code === 'string' && /^E_[A-Z_]{1,40}$/.test(code)) return code
  const match = e instanceof Error ? /\bE_[A-Z_]{1,40}\b/.exec(e.message) : null
  return match?.[0] ?? 'E_UNKNOWN'
}

/** Entrega um e-mail já composto; erro vira só o código. */
export async function send(env: Env, mail: EmailMessageBuilder): Promise<Delivery> {
  try {
    const { messageId } = await env.EMAIL.send(mail)
    return { ok: true, messageId }
  } catch (e) {
    return { ok: false, code: errorCode(e) }
  }
}

export const deliver = (env: Env, m: Message): Promise<Delivery> => send(env, compose(m))
