/**
 * Contrato HTTP do formulário de contato entre o site (src/features/contact) e o Worker (worker/contact.ts).
 * Os dois lados importam daqui: mudar um campo, limite ou código de erro muda os dois de uma vez.
 */

export const CONTACT_PATH = '/api/contact'

/** Ação do widget Turnstile. O Worker recusa token emitido para outra ação. */
export const TURNSTILE_ACTION = 'contact'

export const LIMITS = {
  /** Corpo da requisição inteiro, em bytes. */
  body: 16 * 1024,
  name: 100,
  contact: 200,
  messageMin: 10,
  message: 4000,
  token: 2048,
} as const

export type Field = 'name' | 'contact' | 'message'

/** Corpo do POST. `website` é a isca para robôs: invisível para pessoas, que o deixam vazio. */
export interface ContactRequest {
  name: string
  contact: string
  message: string
  website: string
  /** Token do Turnstile. */
  token: string
}

/** Por que o envio foi recusado. Genéricos de propósito: nenhum detalhe interno sai do Worker. */
export type ContactErrorCode =
  | 'method'
  | 'forbidden'
  | 'unsupported'
  | 'rate_limited'
  | 'too_large'
  | 'invalid'
  | 'verification_failed'
  | 'busy'
  | 'unavailable'

export type ContactResponse = { ok: true } | { ok: false; error: ContactErrorCode; fields?: Field[] }
