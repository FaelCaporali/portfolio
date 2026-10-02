/**
 * CSP das páginas HTML com nonce por requisição. As páginas saem prontas do build (React Router, pré-renderizadas) com
 * <script> inline do roteador (dados da rota, restauração da rolagem, a partida do app): o Worker põe o nonce da
 * resposta em cada <script> do HTML (HTMLRewriter). A Cloudflare lê o nonce do cabeçalho e o põe nos scripts que ela
 * injeta na borda (JS Detections do Bot Fight Mode e o beacon do Web Analytics). Nada precisa de 'unsafe-inline'. Os
 * demais arquivos saem direto dos assets com a CSP do public/_headers (mesmas diretivas, sem nonce).
 */

import { FILTERING_ATTR } from '../shared/journey-filters'

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
 * Página HTML ganha a CSP com nonce, o mesmo nonce em todos os seus <script>, e sai sem cache (o nonce não pode se
 * repetir). `filtering`: a trajetória pedida com filtro ganha a marca no <html> (shared/journey-filters.ts). O resto
 * passa como veio. No servidor de dev do Vite as páginas não passam por aqui.
 */
export function withPageCsp(response: Response, filtering = false): Response {
  if (!response.headers.get('Content-Type')?.includes('text/html')) return response
  const nonce = newNonce()
  let rewriter = new HTMLRewriter().on('script', {
    element(el) {
      el.setAttribute('nonce', nonce)
    },
  })
  if (filtering) {
    rewriter = rewriter.on('html', {
      element(el) {
        el.setAttribute(FILTERING_ATTR, '')
      },
    })
  }
  const html = rewriter.transform(response)
  const page = new Response(html.body, response)
  page.headers.set('Content-Security-Policy', pageCsp(nonce))
  page.headers.set('Cache-Control', 'no-store')
  // O corpo mudou (nonce): tamanho e ETag do arquivo original não valem mais.
  page.headers.delete('Content-Length')
  page.headers.delete('ETag')
  return page
}
