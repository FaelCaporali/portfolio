import { useEffect, useRef, useState } from 'react'
import { mcp } from '../../content/mcp'
import { useMessages, type Lang } from '../../i18n/lang'
import { copyText } from '../../lib/clipboard'
import { cx } from '../../lib/cx'
import { useHydrated } from '../../lib/useHydrated'
import { FOCUS } from '../overview/parts'

/** Duas folhas; vira um visto por um instante depois de copiar (o padrão do CopyContacts). */
function CopyIcon({ done }: { done: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {done ? (
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      ) : (
        <>
          <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
          <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
        </>
      )}
    </svg>
  )
}

/**
 * Botão que copia um texto: desligado até a hidratação (a página sai pronta do build), o rótulo vira "Copied" por
 * 1,8 s num role="status"; se o navegador recusa, a falha do contato ("select the text instead"), e o texto continua
 * selecionável. `big`: o do endereço, a ação primária da página (04 §2.4); senão, o pequeno dos blocos de código.
 */
export function CopyButton({
  text,
  label,
  lang,
  big,
  className,
  describedBy,
}: {
  text: string
  label: string
  lang: Lang
  big?: boolean
  className?: string
  /** O id do texto que diz o que se copia, quando o rótulo sozinho não diz. */
  describedBy?: string
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const hydrated = useHydrated()
  const failed = useMessages().contact.copy.failed
  const said = { idle: '', copied: mcp.copy.copied[lang], failed }[state]

  async function copy() {
    setState((await copyText(text)) ? 'copied' : 'failed')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 1800)
  }

  return (
    <span className={cx('relative inline-flex', className)}>
      <button
        type="button"
        disabled={!hydrated}
        aria-describedby={describedBy}
        onClick={() => void copy()}
        className={cx(
          'inline-flex w-full cursor-copy items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-default motion-reduce:transition-none',
          big
            ? 'min-h-11 min-w-[9.5rem] bg-fg px-5 text-sm text-on-fg hover:bg-fg/85'
            : 'min-h-8 border border-fg/20 px-3 text-xs text-fg/80 hover:border-fg/60 hover:text-fg',
          FOCUS,
        )}
      >
        <CopyIcon done={state === 'copied'} />
        {state === 'copied' ? mcp.copy.copied[lang] : label}
      </button>
      <span role="status" className="sr-only">
        {said}
      </span>
      {state === 'failed' && (
        <span className="absolute top-full right-0 mt-1 w-max max-w-[16rem] rounded-md bg-fg px-2 py-0.5 text-xs font-medium text-on-fg shadow">
          {failed}
        </span>
      )}
    </span>
  )
}
