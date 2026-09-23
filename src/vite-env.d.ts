/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chave pública do widget Turnstile (.env.development: chave de teste; .env.production: a do widget real). */
  readonly VITE_TURNSTILE_SITEKEY: string
}
