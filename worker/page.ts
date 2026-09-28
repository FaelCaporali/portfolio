/// <reference types="vite/client" />
/**
 * CSP das páginas HTML com nonce por requisição. A Cloudflare lê o nonce do cabeçalho e o põe nos scripts que ela
 * injeta na borda (JS Detections do Bot Fight Mode e o beacon do Web Analytics), então nada precisa de
 * 'unsafe-inline'. Os demais arquivos saem direto dos assets com a CSP do public/_headers (mesmas diretivas, sem
 * nonce).
 */

/** Script do Web Analytics da Cloudflare e o endereço para onde ele envia as medições. */
const ANALYTICS_SCRIPT = 'https://static.cloudflareinsights.com'
const ANALYTICS_BEACON = 'https://cloudflareinsights.com'
const TURNSTILE = 'https://challenges.cloudflare.com'

function pageCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' ${TURNSTILE} ${ANALYTICS_SCRIPT}`,
    `frame-src ${TURNSTILE}`,
    `connect-src 'self' blob: data: ${ANALYTICS_BEACON}`,
    "img-src 'self' blob: data:",
    "style-src 'self'",
    "font-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

/** 128 bits aleatórios em base64: imprevisível a cada resposta. */
function newNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
}

/**
 * Página HTML ganha a CSP com nonce e sai sem cache (o nonce não pode se repetir). O resto passa como veio.
 * No servidor de dev do Vite não se aplica: o recarregamento do React usa script inline.
 */
export function withPageCsp(response: Response): Response {
  if (import.meta.env.DEV || !response.headers.get('Content-Type')?.includes('text/html')) return response
  const page = new Response(response.body, response)
  page.headers.set('Content-Security-Policy', pageCsp(newNonce()))
  page.headers.set('Cache-Control', 'no-store')
  return page
}
