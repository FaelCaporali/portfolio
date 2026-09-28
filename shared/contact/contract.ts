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

const FIELDS = ['name', 'contact', 'message'] as const
export type Field = (typeof FIELDS)[number]

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
const CONTACT_ERROR_CODES = [
  'method',
  'forbidden',
  'unsupported',
  'rate_limited',
  'too_large',
  'invalid',
  'verification_failed',
  'busy',
  'unavailable',
] as const
export type ContactErrorCode = (typeof CONTACT_ERROR_CODES)[number]

export const isField = (v: unknown): v is Field => FIELDS.some((f) => f === v)
export const isContactErrorCode = (v: unknown): v is ContactErrorCode => CONTACT_ERROR_CODES.some((c) => c === v)

export type ContactResponse = { ok: true } | { ok: false; error: ContactErrorCode; fields?: Field[] }
