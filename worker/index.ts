/**
 * Roteamento do Worker único do site: a API do contato, 404 JSON no resto de /api/, o servidor MCP em /mcp
 * (worker/mcp/; para os agentes, no workers.dev), a detecção de idioma na primeira visita (worker/lang.ts) e as páginas
 * HTML (com a CSP de nonce e o registro de visitas, worker/visits.ts). Arquivos estáticos não passam por aqui
 * (run_worker_first no wrangler.jsonc). Também o cron e o consumidor da fila do registro do MCP (MCP_LOG).
 */
import { classifyAgent } from '../shared/bots'
import { CONTACT_PATH } from '../shared/contact/contract'
import { VISITS_PATH } from '../shared/visits'
import { handleContact } from './contact'
import { mcpHousekeeping, retryAndPurge } from './cron'
import { json } from './http'
import { drainLog, type LogRow } from './mcp/audit'
import { langRedirect, withLangVary } from './lang'
import { SITE_ORIGIN, stripLang } from '../shared/i18n'
import { wantsFilteredJourney } from '../shared/journey-filters'
import { isWorkersDev, limitMcp, MCP_PATH, varyOnAccept, wantsPage } from './mcp/route'
import { withPageCsp } from './page'
import { handleVisit, recordView } from './visits'

/**
 * Página vazia do roteador (React Router, gerada no build ao lado das pré-renderizadas): num endereço que não existe,
 * o navegador a hidrata e mostra "Page not found" (src/root.tsx), sem hidratar o herói no lugar errado.
 */
const NOT_FOUND_PAGE = '/__spa-fallback'

/**
 * Caminho interno da variante dos robôs da home (camada 1, 03-plano-versao-robos.md): nunca um endereço navegável
 * (R2) — um pedido direto, de qualquer User-Agent, 404 (decisão 2 do plano, abaixo em `fetch`). Só alcançada por
 * `env.ASSETS.fetch` com a URL reescrita (`sitePage`), que não reentra em `fetch`.
 */
const BOT_HERO_PATHS = new Set(['/__hero-bot', '/pt/__hero-bot'])

/** O caminho interno da variante dos robôs para `/` ou `/pt`; `null` para qualquer outra página (decisão 4). */
function botHeroPath(pathname: string): string | null {
  if (pathname === '/') return '/__hero-bot'
  if (pathname === '/pt') return '/pt/__hero-bot'
  return null
}

/** As páginas do site (arquivos do build), com o idioma da primeira visita e a CSP. */
async function sitePage(request: Request, env: Env, pathname: string): Promise<Response> {
  // Endereço antigo da trajetória, anunciado antes de a página ganhar o nome em inglês do resto do site.
  if (pathname === '/trajetoria' || pathname === '/trajetoria/') {
    return Response.redirect(new URL('/journey', request.url).href, 301)
  }
  // Primeira visita de quem prefere português: a página em /pt (worker/lang.ts).
  const redirect = langRedirect(request)
  if (redirect) return redirect
  // Só na home (decisão 4): quem não é pessoa (shared/bots.ts) recebe as 9 vidas inteiras, sem canvas (camada 1),
  // na MESMA URL — nunca um endereço diferente (R2). O resto do Request (método, cabeçalhos) segue igual.
  const botPath = botHeroPath(pathname)
  const useBot = botPath !== null && classifyAgent(request.headers.get('User-Agent')).client !== 'human'
  const assetRequest = useBot ? new Request(new URL(botPath, request.url), request) : request
  const asset = await env.ASSETS.fetch(assetRequest)
  if (asset.status === 404 && request.headers.get('Accept')?.includes('text/html')) {
    const page = await env.ASSETS.fetch(new URL(NOT_FOUND_PAGE, request.url))
    return withPageCsp(new Response(page.body, { status: 404, headers: page.headers }))
  }
  const filtering = wantsFilteredJourney(stripLang(pathname), new URL(request.url).searchParams)
  const page = withLangVary(request, withPageCsp(asset, filtering))
  // Defensivo (decisão 10): Cache-Control: no-store já impede qualquer cache de misturar as duas variantes; .append
  // para não apagar o Vary de idioma que withLangVary já escreveu (.set). Só onde há duas variantes (a home).
  if (botPath === null) return page
  const varied = new Response(page.body, page)
  varied.headers.append('Vary', 'User-Agent')
  return varied
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const { pathname } = url
    // Pedido direto à rota interna da variante dos robôs, de QUALQUER User-Agent: 404 (decisão 2). Antes de tudo:
    // nunca um endereço navegável, nunca o conteúdo da variante fora da MESMA URL de `/` e `/pt`.
    if (BOT_HERO_PATHS.has(pathname)) return new Response('Not found', { status: 404 })
    const mcp = pathname === MCP_PATH && !wantsPage(request)
    // No workers.dev (o endereço do MCP fora do Bot Fight Mode) só o MCP responde: página, contato e o resto vão para
    // o site, sem conteúdo duplicado nem outra porta para o formulário.
    if (isWorkersDev(url) && !mcp) {
      const away = Response.redirect(`${SITE_ORIGIN}${pathname}${url.search}`, 301)
      // O 301 vai para cache: em /mcp, um GET de cliente MCP no mesmo endereço não pode receber o da página.
      return pathname === MCP_PATH ? varyOnAccept(away) : away
    }
    if (pathname === CONTACT_PATH) return handleContact(request, env)
    if (pathname === VISITS_PATH) return handleVisit(request, env)
    if (pathname.startsWith('/api/')) return json(404, { ok: false, error: 'not_found' })
    // Sob demanda: o SDK do MCP só é avaliado quando um cliente MCP chama, e depois do limite por rede
    // (worker/mcp/route.ts).
    if (mcp) return (await limitMcp(request, env)) ?? (await import('./mcp/server')).handleMcp(request, env, ctx)
    const page = await sitePage(request, env, pathname)
    recordView(request, env, page)
    // Em /mcp a página e o servidor dividem o endereço: o que volta depende do Accept.
    return pathname === MCP_PATH ? varyOnAccept(page) : page
  },

  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      retryAndPurge(env, controller.scheduledTime).then((r) =>
        console.log(JSON.stringify({ event: 'contact_cron', ...r })),
      ),
    )
    ctx.waitUntil(
      mcpHousekeeping(env, controller.scheduledTime).then((r) =>
        console.log(JSON.stringify({ event: 'mcp_cron', ...r })),
      ),
    )
  },

  // Chamadas do MCP que não couberam na cota do registro do dia (worker/mcp/audit.ts, D-MCP26).
  async queue(batch, env) {
    await drainLog(batch, env.DB, Date.now())
  },
} satisfies ExportedHandler<Env, LogRow>
