import { LANGS, markdownPath, SITE_PAGES } from '../../shared/i18n'
import { pageMarkdown } from '../seo/markdown'

/**
 * A versão em markdown de cada página (/index.md, /journey.md, /pt/mcp.md...), para assistentes de IA (llmstxt.org).
 * Uma rota por endereço (src/routes.ts); o endereço do pedido diz a página e o idioma. Pré-renderizada no build.
 */
export function loader({ url }: { url: URL }) {
  // `url`, não `request.url`: com v8_passThroughRequests o pedido do pré-render traz o sufixo .data.
  const { pathname } = url
  for (const lang of LANGS) {
    for (const path of SITE_PAGES) {
      if (markdownPath(lang, path) === pathname) {
        return new Response(pageMarkdown(lang, path), {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        })
      }
    }
  }
  return new Response('Not found', { status: 404 })
}
