import { useCallback, useEffect, useRef, useState } from 'react'
import { TURNSTILE_ACTION } from '../../../shared/contact/contract'
import { SITEKEY, loadTurnstile } from './turnstile'

/**
 * Verificação humana do formulário. O widget é criado na primeira vez que `active` fica verdadeiro e depois fica
 * renderizado (renova sozinho ao expirar). O token é de uso único: depois de cada envio, `renew()` pede outro.
 */
export function useTurnstile(active: boolean) {
  const container = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!active || widget.current) return
    let cancelled = false
    loadTurnstile()
      .then((t) => {
        if (cancelled || widget.current || !container.current) return
        widget.current = t.render(container.current, {
          sitekey: SITEKEY,
          action: TURNSTILE_ACTION,
          theme: 'dark',
          size: 'flexible',
          appearance: 'interaction-only',
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
  }, [active])

  const renew = useCallback(() => {
    setToken(null)
    if (widget.current) window.turnstile?.reset(widget.current)
  }, [])

  return { container, token, failed, renew }
}
