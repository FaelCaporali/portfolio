import { useEffect, useId, useRef } from 'react'
import { LIMITS, type Field } from '../../../shared/contact/contract'
import { useMessages } from '../../i18n/lang'
import { errorText, fieldHint } from './texts'
import { useContactForm } from './useContactForm'
import { useTurnstile } from './useTurnstile'

const INPUT =
  'w-full rounded-lg border border-fg/15 bg-fg/5 px-3 py-2 text-sm text-fg placeholder:text-fg/35 transition-colors focus:border-fg/60 focus:outline-none aria-[invalid=true]:border-error-edge/80'
const LABEL = 'mb-1 block text-xs text-fg/60'

/**
 * Formulário de contato. Continua montado com o painel fechado e depois do envio: o texto digitado não se perde e o
 * Turnstile vive dentro dele. `active` = painel aberto.
 *
 * Foco: só se move quando quem o tinha deixa de existir ou quando a pessoa pede. Ao abrir, entra no painel (padrão de
 * diálogo); campo inválido recebe o foco; enviado, o formulário some e o foco vai para "enviar outra"; "enviar outra"
 * volta ao primeiro campo. Erro de envio não mexe no foco: o texto é anunciado pelo status.
 */
export function ContactForm({ active }: { active: boolean }) {
  const { container: captcha, token, failed, renew } = useTurnstile(active)
  const { status, invalid, submit, clearInvalid, restart } = useContactForm({ token, failed, renew })
  const m = useMessages()
  const t = m.contact
  const form = useRef<HTMLFormElement>(null)
  const again = useRef<HTMLButtonElement>(null)
  const id = useId()

  const wasActive = useRef(false)
  const sent = status.kind === 'sent'
  // A verificação humana ainda não terminou (U2, D-143: a demora da 1ª abertura): nem token nem falha. O botão avisa
  // e não envia (o envio sem token já para em useContactForm). Com o token, "Send"; falha, o texto que já existe.
  const verifying = token === null && !failed && status.kind !== 'sending'
  const sendLabel = status.kind === 'sending' ? t.sending : t.send
  const nameInput = () => form.current?.querySelector<HTMLInputElement>('input[name="name"]')

  useEffect(() => {
    const opened = active && !wasActive.current
    wasActive.current = active
    if (opened) (sent ? again.current : nameInput())?.focus()
  }, [active, sent])

  // Enviado → "enviar outra"; de volta ao formulário (só acontece por "enviar outra") → primeiro campo.
  const wasSent = useRef(false)
  useEffect(() => {
    if (sent) again.current?.focus()
    else if (wasSent.current) nameInput()?.focus()
    wasSent.current = sent
  }, [sent])

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
      <p id={hintId(name)} className="mt-1 text-xs text-error">
        {fieldHint(m, name)}
      </p>
    )

  return (
    <>
      {status.kind === 'sent' && (
        <div role="status" className="mt-4 space-y-3 text-sm text-fg/80">
          <p>{t.sent}</p>
          <button
            type="button"
            ref={again}
            onClick={restart}
            className="cursor-pointer text-fg underline underline-offset-4 hover:text-fg/80"
          >
            {t.another}
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
            {t.name}
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
            {t.contact}
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
            {t.message}
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
        {/* Verificando: aria-disabled e não disabled, para o foco e a validação dos campos seguirem no botão. */}
        <button
          type="submit"
          disabled={status.kind === 'sending'}
          aria-disabled={verifying || undefined}
          aria-busy={verifying || undefined}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-on-fg transition-colors hover:bg-fg/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-wait disabled:opacity-60 aria-busy:cursor-wait aria-busy:opacity-60"
        >
          {verifying && (
            // Anel girando: só transform (animate-spin); parado com movimento reduzido.
            <span
              aria-hidden
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
            />
          )}
          {verifying ? t.verifying : sendLabel}
        </button>
        <p role="status" className="min-h-[1lh] text-xs text-error">
          {status.kind === 'error' ? errorText(status.key, m) : ''}
        </p>
      </form>
    </>
  )
}
