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

/**
 * Estado e envio do formulário: valida com as mesmas regras do Worker, exige o token da verificação humana, envia e
 * traduz o resultado (enviado, campos a corrigir ou erro com texto próprio).
 */
export function useContactForm(verification: Verification) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [invalid, setInvalid] = useState<Field[]>([])

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status.kind === 'sending') return
    const form = e.currentTarget
    const fields = readForm(form)

    // A mesma validação do Worker: o que passa aqui não volta recusado por formato.
    const parsed = parseContact(fields)
    const bad = parsed.ok ? [] : parsed.fields
    setInvalid(bad)
    if (bad[0]) {
      form.querySelector<HTMLElement>(`[name="${bad[0]}"]`)?.focus()
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
