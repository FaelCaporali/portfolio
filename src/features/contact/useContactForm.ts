import { useState, type SubmitEvent } from 'react'
import { LIMITS, type ContactRequest, type Field } from '../../../shared/contact/contract'
import { parseContact } from '../../../shared/contact/validation'
import { sendContact } from './api'
import type { ErrorKey } from './texts'
import { track } from '../../lib/track'

export type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; key: ErrorKey }

interface Verification {
  token: string | null
  failed: boolean
  renew: () => void
}

/** Campos do formulário como o Worker os recebe (sem o token). */
function readForm(form: HTMLFormElement): Omit<ContactRequest, 'token'> {
  const data = new FormData(form)
  const text = (name: string) => {
    const v = data.get(name)
    return typeof v === 'string' ? v : ''
  }
  return { name: text('name'), contact: text('contact'), message: text('message'), website: text('website') }
}

const focusField = (form: HTMLFormElement, field: Field | undefined) => {
  if (field) form.querySelector<HTMLElement>(`[name="${field}"]`)?.focus()
}

/**
 * Estado e envio do formulário: valida com as mesmas regras do Worker, exige o token da verificação humana, envia e
 * traduz o resultado (enviado, campos a corrigir ou erro com texto próprio). `prefix`: o assunto da oferta, juntado à
 * mensagem só no envio, depois da validação (o mínimo vale para o texto da pessoa).
 */
export function useContactForm(verification: Verification, prefix = '') {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [invalid, setInvalid] = useState<Field[]>([])
  // O aviso "ainda verificando" sai quando o token chega (U2): o botão já diz "Send". Ajuste no render (padrão do
  // React para estado que segue uma prop), sem efeito e sem um quadro com o aviso velho.
  if (verification.token && status.kind === 'error' && status.key === 'still_verifying') setStatus({ kind: 'idle' })

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status.kind === 'sending') return
    const form = e.currentTarget
    const fields = readForm(form)

    // A mesma validação do Worker: o que passa aqui não volta recusado por formato.
    const parsed = parseContact(fields)
    const bad = parsed.ok ? [] : parsed.fields
    setInvalid(bad)
    if (bad.length) {
      focusField(form, bad[0])
      return
    }
    const { token } = verification
    if (!token) {
      setStatus({ kind: 'error', key: verification.failed ? 'fallback' : 'still_verifying' })
      return
    }

    setStatus({ kind: 'sending' })
    // O texto da pessoa vem antes do assunto: se os dois juntos passarem do limite (texto longo digitado antes de abrir
    // por uma oferta), vai sem o assunto, em vez de o Worker recusar com um aviso que não explica o motivo.
    const withTopic = prefix + fields.message
    const message = withTopic.length <= LIMITS.message ? withTopic : fields.message
    const result = await sendContact({ ...fields, message, token })
    verification.renew()
    if (result.kind === 'sent') {
      form.reset()
      setStatus({ kind: 'sent' })
      track('contact_sent')
    } else if (result.kind === 'invalid') {
      setInvalid(result.fields)
      setStatus({ kind: 'idle' })
      focusField(form, result.fields[0])
    } else {
      setStatus({ kind: 'error', key: result.code ?? 'fallback' })
    }
  }

  const clearInvalid = (name: Field) => {
    if (invalid.includes(name)) setInvalid((f) => f.filter((x) => x !== name))
  }
  const restart = () => {
    setStatus({ kind: 'idle' })
  }

  return { status, invalid, submit, clearInvalid, restart }
}
