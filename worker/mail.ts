/** Composição e entrega do e-mail pela binding send_email (destino e remetente fixos no wrangler.jsonc). */
import { asPhone } from '../shared/contact/validation'
import type { Delivery, Message } from './message'

const SENDER = { email: 'worker@mail.caporali.dev', name: 'Portfólio · contato' }
const DESTINATION = 'fael@caporali.dev'

const BRT = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })

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
function errorCode(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code
  if (typeof code === 'string' && /^E_[A-Z_]{1,40}$/.test(code)) return code
  const match = e instanceof Error ? /\bE_[A-Z_]{1,40}\b/.exec(e.message) : null
  return match?.[0] ?? 'E_UNKNOWN'
}

export async function deliver(env: Env, m: Message): Promise<Delivery> {
  try {
    const { messageId } = await env.EMAIL.send(compose(m))
    return { ok: true, messageId }
  } catch (e) {
    return { ok: false, code: errorCode(e) }
  }
}
