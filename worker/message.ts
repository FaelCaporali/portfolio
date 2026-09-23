/**
 * A mensagem de contato e a política de guarda e reenvio. Sem I/O: o repositório grava, o correio entrega, o cron
 * reenvia; as regras de quando desistir e por quanto tempo guardar ficam aqui.
 */

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

/** Tentativas de envio (a do formulário + as do cron) antes de desistir. */
export const MAX_ATTEMPTS = 5
export const RETENTION_MS = 90 * 24 * 60 * 60 * 1000
/** O cron só pega mensagens com mais de 5 minutos, para não disputar com o envio do próprio formulário. */
export const RETRY_AFTER_MS = 5 * 60 * 1000
/** Teto global por 24 h: segura uma enxurrada que passe pelo Turnstile. */
export const DAILY_CAP = 50
export const DAY_MS = 24 * 60 * 60 * 1000

/** Resultado de uma tentativa de entrega: id do provedor ou só o código do erro (nunca a mensagem, que ecoa dados). */
export type Delivery = { ok: true; messageId: string } | { ok: false; code: string }

export type Status = 'pending' | 'sent' | 'failed'

/** Estado depois de uma tentativa; `attempts` já conta a tentativa que acabou de acontecer. */
export function statusAfter(attempts: number, delivery: Delivery): Status {
  if (delivery.ok) return 'sent'
  return attempts >= MAX_ATTEMPTS ? 'failed' : 'pending'
}
