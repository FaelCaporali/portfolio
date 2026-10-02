import { useCallback, useEffect, useRef, useState } from 'react'
import { TURNSTILE_ACTION } from '../../../shared/contact/contract'
import { LOCALES, useLang } from '../../i18n/lang'
import { SITEKEY, loadTurnstile } from './turnstile'

/**
 * Verificação humana do formulário, no idioma da página. O widget é criado na primeira vez que `active` fica verdadeiro
 * e depois fica renderizado (renova sozinho ao expirar); se o idioma da página muda, é refeito no idioma novo na
 * próxima abertura. O token é de uso único: depois de cada envio, `renew()` pede outro.
 */
export function useTurnstile(active: boolean) {
  const container = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const language = LOCALES[useLang()].turnstile
  const shownIn = useRef<string | null>(null)

  useEffect(() => {
    if (!active || (widget.current && shownIn.current === language)) return
    let cancelled = false
    loadTurnstile()
      .then((t) => {
        if (cancelled || !container.current || (widget.current && shownIn.current === language)) return
        if (widget.current) {
          t.remove(widget.current)
          widget.current = null
          setToken(null)
        }
        shownIn.current = language
        widget.current = t.render(container.current, {
          sitekey: SITEKEY,
          action: TURNSTILE_ACTION,
          theme: 'dark',
          size: 'flexible',
          appearance: 'interaction-only',
          language,
          callback: (tok) => {
            setToken(tok)
            setFailed(false)
          },
          'expired-callback': () => {
            setToken(null)
          },
          'error-callback': () => {
            setToken(null)
            setFailed(true)
          },
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [active, language])

  const renew = useCallback(() => {
    setToken(null)
    if (widget.current) window.turnstile?.reset(widget.current)
  }, [])

  return { container, token, failed, renew }
}
