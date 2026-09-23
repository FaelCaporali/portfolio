/** Cliente da API de contato: POST no Worker e a resposta traduzida num resultado que a interface entende. */
import {
  CONTACT_PATH,
  isContactErrorCode,
  isField,
  type ContactErrorCode,
  type ContactRequest,
  type Field,
} from '../../../shared/contact/contract'

export type SendResult =
  { kind: 'sent' } | { kind: 'invalid'; fields: Field[] } | { kind: 'error'; code: ContactErrorCode | null }

/** Status + corpo → resultado. Corpo fora do contrato (proxy, página de erro, HTML) vira erro sem código. */
export function toResult(ok: boolean, body: unknown): SendResult {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  if (ok && b.ok === true) return { kind: 'sent' }
  const fields = Array.isArray(b.fields) ? b.fields.filter(isField) : []
  if (fields.length) return { kind: 'invalid', fields }
  return { kind: 'error', code: isContactErrorCode(b.error) ? b.error : null }
}

export async function sendContact(request: ContactRequest): Promise<SendResult> {
  try {
    const r = await fetch(CONTACT_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return toResult(r.ok, await r.json().catch(() => null))
  } catch {
    return { kind: 'error', code: null }
  }
}
