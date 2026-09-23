/**
 * Turnstile (anti-robô da Cloudflare) em modo explícito: o script só carrega quando o formulário abre pela primeira vez.
 * O token é conferido no Worker (worker/turnstile.ts); aqui só se obtém e renova.
 */

interface RenderOptions {
  sitekey: string
  action: string
  theme: 'dark' | 'light' | 'auto'
  size: 'normal' | 'flexible' | 'compact'
  appearance: 'always' | 'execute' | 'interaction-only'
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => boolean | void
}

interface Turnstile {
  render(el: HTMLElement, options: RenderOptions): string
  reset(id: string): void
  remove(id: string): void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
export const SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY

let loading: Promise<Turnstile> | undefined

export function loadTurnstile(): Promise<Turnstile> {
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile)
    const script = document.createElement('script')
    script.src = SRC
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')))
    script.onerror = () => {
      loading = undefined
      script.remove()
      reject(new Error('turnstile'))
    }
    document.head.appendChild(script)
  })
  return loading
}
