/**
 * Detecção de idioma na primeira visita (shared/i18n.ts): pedido de página em inglês (/ ou /journey), vindo de um
 * navegador que prefere português e sem escolha salva em inglês, vai para o endereço em português (302, com a query).
 * O endereço com /pt nunca é redirecionado (link compartilhado vale), e o robô sem Accept-Language recebe o inglês.
 */
import { langFromPath, localePath, parseAcceptLanguage, preferredLang, savedLang, SITE_PAGES } from '../shared/i18n'

/** O que muda a resposta das páginas em inglês: caches não servem a página de um visitante ao outro. */
const VARY = 'Accept-Language, Cookie'

const PAGES = new Set<string>(SITE_PAGES)

/** Página nos dois idiomas, pedida como documento (navegação), no endereço inglês. */
function isEnglishPage(request: Request, pathname: string): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  if (!request.headers.get('Accept')?.includes('text/html')) return false
  // Vinda do próprio site (o controle EN clicado antes da hidratação, sem JS ou em outra aba): a pessoa escolheu.
  if (request.headers.get('Sec-Fetch-Site') === 'same-origin') return false
  return PAGES.has(pathname) && langFromPath(pathname) === 'en'
}

/** O redirect para o português, ou null quando a página em inglês é a certa. */
export function langRedirect(request: Request): Response | null {
  const url = new URL(request.url)
  if (!isEnglishPage(request, url.pathname)) return null
  const lang = preferredLang(
    parseAcceptLanguage(request.headers.get('Accept-Language')),
    savedLang(request.headers.get('Cookie')),
  )
  if (lang === 'en') return null
  const target = new URL(localePath(lang, url.pathname), url)
  target.search = url.search
  return new Response(null, {
    status: 302,
    headers: { Location: target.href, Vary: VARY, 'Cache-Control': 'no-store' },
  })
}

/** A página inglesa que ficou (sem redirect) também declara do que depende. */
export function withLangVary(request: Request, response: Response): Response {
  if (!isEnglishPage(request, new URL(request.url).pathname)) return response
  const page = new Response(response.body, response)
  page.headers.set('Vary', VARY)
  return page
}
