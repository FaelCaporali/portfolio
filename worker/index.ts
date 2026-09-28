/**
 * Roteamento do Worker único do site: a API do contato, 404 JSON no resto de /api/ e as páginas HTML (com a CSP de
 * nonce). Arquivos estáticos não passam por aqui (run_worker_first no wrangler.jsonc).
 */
import { CONTACT_PATH } from '../shared/contact/contract'
import { handleContact } from './contact'
import { retryAndPurge } from './cron'
import { json } from './http'
import { withPageCsp } from './page'

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (pathname === CONTACT_PATH) return handleContact(request, env)
    if (pathname.startsWith('/api/')) return json(404, { ok: false, error: 'not_found' })
    return withPageCsp(await env.ASSETS.fetch(request))
  },

  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      retryAndPurge(env, controller.scheduledTime).then((r) =>
        console.log(JSON.stringify({ event: 'contact_cron', ...r })),
      ),
    )
  },
} satisfies ExportedHandler<Env>
