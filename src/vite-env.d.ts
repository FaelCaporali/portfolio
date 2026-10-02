/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chave pública do widget Turnstile (.env.development: chave de teste; produção: segredo do ambiente no CI). */
  readonly VITE_TURNSTILE_SITEKEY: string
}

/** O dia do build (AAAA-MM-DD, vite.config.ts): dateModified dos dados estruturados e lastmod do sitemap. */
declare const __BUILD_DATE__: string
