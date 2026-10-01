/**
 * Roteamento do Worker único do site: a API do contato, 404 JSON no resto de /api/, o servidor MCP em /mcp
 * (worker/mcp/; para os agentes, no workers.dev), a detecção de idioma na primeira visita (worker/lang.ts) e as páginas
 * HTML (com a CSP de nonce). Arquivos estáticos não passam por aqui (run_worker_first no wrangler.jsonc).
 */
import { CONTACT_PATH } from '../shared/contact/contract'
import { handleContact } from './contact'
import { retryAndPurge } from './cron'
import { json } from './http'
import { langRedirect, withLangVary } from './lang'
import { SITE_ORIGIN } from '../shared/i18n'
import { isWorkersDev, MCP_PATH, wantsPage } from './mcp/route'
import { withPageCsp } from './page'

/**
 * Página vazia do roteador (React Router, gerada no build ao lado das pré-renderizadas): num endereço que não existe,
 * o navegador a hidrata e mostra "Page not found" (src/root.tsx), sem hidratar o herói no lugar errado.
 */
const NOT_FOUND_PAGE = '/__spa-fallback'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const { pathname } = url
    const mcp = pathname === MCP_PATH && !wantsPage(request)
    // No workers.dev (o endereço do MCP fora do Bot Fight Mode) só o MCP responde: página, contato e o resto vão para
    // o site, sem conteúdo duplicado nem outra porta para o formulário.
    if (isWorkersDev(url) && !mcp) return Response.redirect(`${SITE_ORIGIN}${pathname}${url.search}`, 301)
    if (pathname === CONTACT_PATH) return handleContact(request, env)
    if (pathname.startsWith('/api/')) return json(404, { ok: false, error: 'not_found' })
    // Sob demanda: o SDK do MCP só é avaliado quando um cliente MCP chama (worker/mcp/route.ts).
    if (mcp) return (await import('./mcp/server')).handleMcp(request, env)
    // Endereço antigo da trajetória, anunciado antes de a página ganhar o nome em inglês do resto do site.
    if (pathname === '/trajetoria' || pathname === '/trajetoria/') {
      return Response.redirect(new URL('/journey', request.url).href, 301)
    }
    // Primeira visita de quem prefere português: a página em /pt (worker/lang.ts).
    const redirect = langRedirect(request)
    if (redirect) return redirect
    const asset = await env.ASSETS.fetch(request)
    if (asset.status === 404 && request.headers.get('Accept')?.includes('text/html')) {
      const page = await env.ASSETS.fetch(new URL(NOT_FOUND_PAGE, request.url))
      return withPageCsp(new Response(page.body, { status: 404, headers: page.headers }))
    }
    return withLangVary(request, withPageCsp(asset))
  },

  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      retryAndPurge(env, controller.scheduledTime).then((r) =>
        console.log(JSON.stringify({ event: 'contact_cron', ...r })),
      ),
    )
  },
} satisfies ExportedHandler<Env>
