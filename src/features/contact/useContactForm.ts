import { useState, type SubmitEvent } from 'react'
import type { ContactRequest, Field } from '../../../shared/contact/contract'
import { parseContact } from '../../../shared/contact/validation'
import { sendContact } from './api'
import { FALLBACK, STILL_VERIFYING, errorText } from './texts'

export type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; text: string }

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
 * traduz o resultado (enviado, campos a corrigir ou erro com texto próprio).
 */
export function useContactForm(verification: Verification) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [invalid, setInvalid] = useState<Field[]>([])
  // O aviso "ainda verificando" sai quando o token chega (U2): o botão já diz "Send". Ajuste no render (padrão do
  // React para estado que segue uma prop), sem efeito e sem um quadro com o aviso velho.
  if (verification.token && status.kind === 'error' && status.text === STILL_VERIFYING) setStatus({ kind: 'idle' })

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
      setStatus({ kind: 'error', text: verification.failed ? FALLBACK : STILL_VERIFYING })
      return
    }

    setStatus({ kind: 'sending' })
    const result = await sendContact({ ...fields, token })
    verification.renew()
    if (result.kind === 'sent') {
      form.reset()
      setStatus({ kind: 'sent' })
    } else if (result.kind === 'invalid') {
      setInvalid(result.fields)
      setStatus({ kind: 'idle' })
      focusField(form, result.fields[0])
    } else {
      setStatus({ kind: 'error', text: errorText(result.code) })
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
