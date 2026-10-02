/**
 * Textos do widget de contato no idioma da página (src/i18n/messages/). O estado do formulário guarda a chave do
 * aviso, não o texto: a troca de idioma com um aviso na tela o traduz junto.
 */
import { LIMITS, type ContactErrorCode, type Field } from '../../../shared/contact/contract'
import { en, type Messages } from '../../i18n/messages/en'

/** Um aviso de envio: a recusa do Worker, a falha sem código ou a verificação humana que ainda não terminou. */
export type ErrorKey = ContactErrorCode | 'fallback' | 'still_verifying'

export const fieldHint = (m: Messages, field: Field) =>
  field === 'message' ? m.contact.hints.message(LIMITS.messageMin) : m.contact.hints[field]

/** O texto de um aviso; sem código (rede, resposta ilegível), o de falha genérica. */
export function errorText(key: ErrorKey | null, m: Messages = en): string {
  if (key === null || key === 'fallback') return m.contact.fallback
  if (key === 'still_verifying') return m.contact.stillVerifying
  return m.contact.errors[key]
}

/** Os dois avisos sem código, em inglês (os testes do widget os procuram na página). */
export const FALLBACK = en.contact.fallback
export const STILL_VERIFYING = en.contact.stillVerifying
