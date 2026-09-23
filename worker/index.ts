import { handleContact, json } from './contact'
import { retryAndPurge } from './messages'

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/contact') return handleContact(request, env)
    if (pathname.startsWith('/api/')) return json(404, { ok: false, error: 'not_found' })
    return env.ASSETS.fetch(request)
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      retryAndPurge(env, controller.scheduledTime).then((r) => console.log(JSON.stringify({ event: 'contact_cron', ...r }))),
    )
  },
} satisfies ExportedHandler<Env>
