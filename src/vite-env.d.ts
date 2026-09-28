/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chave pública do widget Turnstile (.env.development: chave de teste; produção: segredo do ambiente no CI). */
  readonly VITE_TURNSTILE_SITEKEY: string
}
