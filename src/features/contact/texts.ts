/** Textos do widget de contato, em inglês como o resto do site (`lang="en"` no index.html). */
import { LIMITS, type ContactErrorCode, type Field } from '../../../shared/contact/contract'

export const FIELD_HINT: Record<Field, string> = {
  name: 'Tell me your name.',
  contact: 'Enter an e-mail or a phone number.',
  message: `Write at least ${LIMITS.messageMin} characters.`,
}

/** Falha sem código (rede, resposta ilegível) ou verificação humana que não carregou. */
export const FALLBACK = "Couldn't send right now. Please reach me directly below."
export const STILL_VERIFYING = 'Still checking you are human. One moment and try again.'

/** Um texto por recusa do Worker: quem escreveu sabe o que aconteceu e o que fazer. */
const ERRORS: Record<ContactErrorCode, string> = {
  method: 'The form could not be sent from here. Please reach me directly below.',
  forbidden: 'This page is not allowed to send the form. Please reach me directly below.',
  unsupported: 'Your browser sent the form in a format I cannot read. Please reach me directly below.',
  rate_limited: 'Too many attempts. Please try again in a minute.',
  too_large: 'The message is too long. Please shorten it and try again.',
  invalid: 'Something in the form could not be read. Please check it and try again.',
  verification_failed: 'Human verification failed. Please try again.',
  busy: 'Too many messages today. Please reach me directly below.',
  unavailable: FALLBACK,
}

export const errorText = (code: ContactErrorCode | null) => (code ? ERRORS[code] : FALLBACK)
