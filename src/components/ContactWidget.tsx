import { useCallback, useEffect, useId, useRef, useState, type SubmitEvent } from 'react'
import { directContacts } from '../content/profile'
import {
  CONTACT_PATH,
  LIMITS,
  TURNSTILE_ACTION,
  type ContactErrorCode,
  type ContactRequest,
  type ContactResponse,
  type Field,
} from '../../shared/contact/contract'
import { parseContact } from '../../shared/contact/validation'
import { SITEKEY, loadTurnstile } from './turnstile'
import { useDismiss } from './useDismiss'

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; text: string }

const FIELD_HINT: Record<Field, string> = {
  name: 'Tell me your name.',
  contact: 'Enter an e-mail or a phone number.',
  message: `Write at least ${LIMITS.messageMin} characters.`,
}

const FALLBACK = "Couldn't send right now. Please reach me directly below."
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

const isErrorCode = (code: unknown): code is ContactErrorCode => typeof code === 'string' && Object.hasOwn(ERRORS, code)

const INPUT =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 transition-colors focus:border-white/60 focus:outline-none aria-[invalid=true]:border-rose-400/80'

/**
 * Contato flutuante, em todas as páginas: formulário que envia direto (Worker → fael@caporali.dev) e, abaixo, e-mail e
 * WhatsApp à vista. Largo: canto inferior direito, abre para cima. Celular: canto superior direito, abre para baixo.
 * O painel fica montado quando fechado: o texto digitado não se perde.
 */
export function ContactWidget() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [invalid, setInvalid] = useState<Field[]>([])
  const [token, setToken] = useState<string | null>(null)
  const [captchaError, setCaptchaError] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const captcha = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const id = useId()

  const close = useCallback(() => {
    if (root.current?.contains(document.activeElement)) toggle.current?.focus()
    setOpen(false)
  }, [])
  useDismiss(open, close, root)

  // Turnstile só na primeira abertura; depois fica renderizado (e se renova sozinho ao expirar).
  useEffect(() => {
    if (!open || widget.current) return
    let cancelled = false
    loadTurnstile()
      .then((t) => {
        if (cancelled || widget.current || !captcha.current) return
        widget.current = t.render(captcha.current, {
          sitekey: SITEKEY,
          action: TURNSTILE_ACTION,
          theme: 'dark',
          size: 'flexible',
          appearance: 'interaction-only',
          callback: (tok) => {
            setToken(tok)
            setCaptchaError(false)
          },
          'expired-callback': () => setToken(null),
          'error-callback': () => {
            setToken(null)
            setCaptchaError(true)
          },
        })
      })
      .catch(() => !cancelled && setCaptchaError(true))
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (open && status.kind !== 'sent') form.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus()
  }, [open, status.kind])

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status.kind === 'sending') return
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    // A mesma validação do Worker: o que passa aqui não volta recusado por formato.
    const parsed = parseContact(data)
    const bad = parsed.ok ? [] : parsed.fields
    setInvalid(bad)
    if (bad.length) {
      form.current?.querySelector<HTMLElement>(`[name="${bad[0]}"]`)?.focus()
      return
    }
    if (!token) {
      setStatus({
        kind: 'error',
        text: captchaError ? FALLBACK : 'Still checking you are human. One moment and try again.',
      })
      return
    }
    setStatus({ kind: 'sending' })
    try {
      const request: ContactRequest = {
        name: data.name ?? '',
        contact: data.contact ?? '',
        message: data.message ?? '',
        website: data.website ?? '',
        token,
      }
      const r = await fetch(CONTACT_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      const body = (await r.json().catch(() => ({}))) as Partial<ContactResponse>
      if (r.ok && body.ok) {
        form.current?.reset()
        setStatus({ kind: 'sent' })
      } else if (body.ok === false && body.fields?.length) {
        setInvalid(body.fields)
        setStatus({ kind: 'idle' })
      } else {
        const code = body.ok === false ? body.error : undefined
        setStatus({ kind: 'error', text: isErrorCode(code) ? ERRORS[code] : FALLBACK })
      }
    } catch {
      setStatus({ kind: 'error', text: FALLBACK })
    } finally {
      // Token de uso único: pede outro para a próxima tentativa.
      setToken(null)
      if (widget.current) window.turnstile?.reset(widget.current)
    }
  }

  const fieldProps = (name: Field) => ({
    name,
    id: `${id}-${name}`,
    'aria-invalid': invalid.includes(name),
    'aria-describedby': invalid.includes(name) ? `${id}-${name}-hint` : undefined,
    onInput: () => invalid.includes(name) && setInvalid((f) => f.filter((x) => x !== name)),
  })
  const hint = (name: Field) =>
    invalid.includes(name) && (
      <p id={`${id}-${name}-hint`} className="mt-1 text-xs text-rose-300">
        {FIELD_HINT[name]}
      </p>
    )

  return (
    <div ref={root} className="fixed top-3.5 right-5 z-20 sm:right-10 lg:top-auto lg:right-8 lg:bottom-8">
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((o) => !o)}
        className="ml-auto flex cursor-pointer items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-white shadow-lg backdrop-blur-md transition-colors hover:border-white/60 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:px-5 lg:py-3 lg:text-sm"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-4 w-4 lg:h-5 lg:w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z" />
        </svg>
        Contact me
      </button>

      <section
        id={`${id}-panel`}
        role="dialog"
        aria-labelledby={`${id}-title`}
        hidden={!open}
        className="absolute top-full right-0 mt-2 max-h-[calc(100dvh-4.5rem)] w-[calc(100vw-2.5rem)] max-w-sm overflow-y-auto rounded-2xl border border-white/15 bg-[#16161b]/95 p-5 text-white shadow-2xl backdrop-blur lg:top-auto lg:bottom-full lg:mt-0 lg:mb-2 lg:max-h-[calc(100dvh-7rem)] lg:w-[22rem]"
      >
        <h2 id={`${id}-title`} className="text-base font-semibold">
          Send me a message
        </h2>

        {/* O formulário continua montado depois do envio: o Turnstile vive dentro dele. */}
        {status.kind === 'sent' && (
          <div role="status" className="mt-4 space-y-3 text-sm text-white/80">
            <p>Thanks! Message received. I'll get back to you soon.</p>
            <button
              type="button"
              onClick={() => setStatus({ kind: 'idle' })}
              className="cursor-pointer text-white underline underline-offset-4 hover:text-white/80"
            >
              Send another message
            </button>
          </div>
        )}
        <form ref={form} noValidate onSubmit={submit} hidden={status.kind === 'sent'} className="mt-4 space-y-3">
          <div>
            <label htmlFor={`${id}-name`} className="mb-1 block text-xs text-white/60">
              Name
            </label>
            <input
              {...fieldProps('name')}
              type="text"
              autoComplete="name"
              maxLength={LIMITS.name}
              required
              className={INPUT}
            />
            {hint('name')}
          </div>
          <div>
            <label htmlFor={`${id}-contact`} className="mb-1 block text-xs text-white/60">
              E-mail or WhatsApp, so I can reply
            </label>
            <input
              {...fieldProps('contact')}
              type="text"
              inputMode="email"
              autoComplete="email"
              maxLength={LIMITS.contact}
              required
              className={INPUT}
            />
            {hint('contact')}
          </div>
          <div>
            <label htmlFor={`${id}-message`} className="mb-1 block text-xs text-white/60">
              Message
            </label>
            <textarea
              {...fieldProps('message')}
              rows={4}
              maxLength={LIMITS.message}
              required
              className={`${INPUT} resize-y`}
            />
            {hint('message')}
          </div>
          {/* Isca para robôs: invisível, fora do Tab e do leitor de tela. Pessoas não preenchem. */}
          <div aria-hidden className="absolute h-px w-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]">
            <label>
              Website
              <input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
            </label>
          </div>
          <div ref={captcha} />
          <button
            type="submit"
            disabled={status.kind === 'sending'}
            className="flex w-full cursor-pointer items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
          >
            {status.kind === 'sending' ? 'Sending…' : 'Send'}
          </button>
          <p role="status" className="min-h-[1lh] text-xs text-rose-300">
            {status.kind === 'error' ? status.text : ''}
          </p>
        </form>

        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-xs text-white/50">Or reach me directly</p>
          <ul className="mt-2 space-y-1 text-sm">
            {directContacts.map((c) => (
              <li key={c.label}>
                <a
                  href={c.href}
                  target={c.href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                >
                  <span className="text-white/45">{c.label}:</span> {c.value}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
