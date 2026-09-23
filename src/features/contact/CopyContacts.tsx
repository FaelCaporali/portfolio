import { useEffect, useRef, useState } from 'react'
import { directContacts, type DirectContact } from '../../content/profile'
import { copyText } from '../../lib/clipboard'

/** Ícone do tipo de contato; vira um visto por um instante depois de copiar. */
function KindIcon({ kind }: { kind: DirectContact['kind'] | 'copied' }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === 'copied' && <path d="m5 12.5 4.5 4.5L19 7.5" />}
      {kind === 'email' && (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
        </>
      )}
      {kind === 'phone' && (
        <path d="M5 3.5h3.2l1.6 4.2-2 1.3a11 11 0 0 0 7.2 7.2l1.3-2 4.2 1.6V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.1 1.5 1.5 0 0 1 5 3.5z" />
      )}
    </svg>
  )
}

const noun = (c: DirectContact) => (c.kind === 'email' ? 'E-mail' : 'Phone')

/** Confirmação sobre o item copiado (e anunciada ao leitor de tela). */
const copiedText = (c: DirectContact, ok: boolean) =>
  ok ? `${noun(c)} copied` : 'Copy failed. Select the text instead.'

/**
 * E-mail e telefone sempre à vista no herói. Clique copia o texto pronto para colar (telefone com +55 e DDD);
 * a confirmação aparece sobre o item e é anunciada ao leitor de tela. Abrir e-mail/WhatsApp fica no widget de contato.
 */
export function CopyContacts({ className = '' }: { className?: string }) {
  const [copied, setCopied] = useState<{ label: string; ok: boolean } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy(c: DirectContact) {
    const ok = await copyText(c.value)
    setCopied({ label: c.label, ok })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(null), 1800)
  }

  return (
    <ul aria-label="Contact" className={`flex flex-wrap gap-x-1 gap-y-1 min-[360px]:gap-x-2 ${className}`}>
      {directContacts.map((c) => {
        const shown = copied?.label === c.label
        return (
          <li key={c.label} className="relative">
            <button
              type="button"
              onClick={() => void copy(c)}
              title={`Copy ${c.kind === 'email' ? 'e-mail' : 'phone number'}`}
              className="group -mx-1.5 inline-flex cursor-copy items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-white/65 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white min-[360px]:text-[13px] lg:text-sm"
            >
              <KindIcon kind={shown && copied.ok ? 'copied' : c.kind} />
              <span className="tabular-nums">{c.value}</span>
            </button>
            <span
              role="status"
              className={`pointer-events-none absolute bottom-full left-0 mb-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium whitespace-nowrap text-neutral-950 shadow transition-all duration-150 ${shown ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`}
            >
              {shown ? copiedText(c, copied.ok) : ''}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
