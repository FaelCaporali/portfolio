import { useEffect, useId, useRef } from 'react'
import { LIMITS, type Field } from '../../../shared/contact/contract'
import { FIELD_HINT } from './texts'
import { useContactForm } from './useContactForm'
import { useTurnstile } from './useTurnstile'

const INPUT =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 transition-colors focus:border-white/60 focus:outline-none aria-[invalid=true]:border-rose-400/80'
const LABEL = 'mb-1 block text-xs text-white/60'

/**
 * Formulário de contato. Continua montado com o painel fechado e depois do envio: o texto digitado não se perde e o
 * Turnstile vive dentro dele. `active` = painel aberto (carrega a verificação e põe o foco no primeiro campo).
 */
export function ContactForm({ active }: { active: boolean }) {
  const turnstile = useTurnstile(active)
  const { status, invalid, submit, clearInvalid, restart } = useContactForm(turnstile)
  const form = useRef<HTMLFormElement>(null)
  const id = useId()

  useEffect(() => {
    if (active && status.kind !== 'sent') form.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus()
  }, [active, status.kind])

  const hintId = (name: Field) => `${id}-${name}-hint`
  const fieldProps = (name: Field) => ({
    name,
    id: `${id}-${name}`,
    'aria-invalid': invalid.includes(name),
    'aria-describedby': invalid.includes(name) ? hintId(name) : undefined,
    onInput: () => {
      clearInvalid(name)
    },
  })
  const hint = (name: Field) =>
    invalid.includes(name) && (
      <p id={hintId(name)} className="mt-1 text-xs text-rose-300">
        {FIELD_HINT[name]}
      </p>
    )

  return (
    <>
      {status.kind === 'sent' && (
        <div role="status" className="mt-4 space-y-3 text-sm text-white/80">
          <p>Thanks! Message received. I&apos;ll get back to you soon.</p>
          <button
            type="button"
            onClick={restart}
            className="cursor-pointer text-white underline underline-offset-4 hover:text-white/80"
          >
            Send another message
          </button>
        </div>
      )}
      <form
        ref={form}
        noValidate
        onSubmit={(e) => void submit(e)}
        hidden={status.kind === 'sent'}
        className="mt-4 space-y-3"
      >
        <div>
          <label htmlFor={`${id}-name`} className={LABEL}>
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
          <label htmlFor={`${id}-contact`} className={LABEL}>
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
          <label htmlFor={`${id}-message`} className={LABEL}>
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
        <div ref={turnstile.container} />
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
    </>
  )
}
