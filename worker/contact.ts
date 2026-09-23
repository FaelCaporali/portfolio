import { DAILY_CAP, countSince, deliver, insert, record, type Message } from './messages'
import { list, verifyTurnstile } from './turnstile'
import { LIMITS, type ContactErrorCode, type ContactResponse } from '../shared/contact/contract'
import { parseContact } from '../shared/contact/validation'

/** Resposta da API: só JSON, nunca em cache, sem conteúdo ativo. Erros genéricos, sem detalhe interno. */
export function json(
  status: number,
  body: ContactResponse | { ok: false; error: 'not_found' },
  extra?: HeadersInit,
): Response {
  const headers = new Headers(extra)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  return new Response(JSON.stringify(body), { status, headers })
}

const fail = (status: number, error: ContactErrorCode, extra?: HeadersInit) => json(status, { ok: false, error }, extra)

/** Log sem dado pessoal: evento, desfecho e, no máximo, o id da mensagem e o código do erro. */
const log = (outcome: string, extra: Record<string, string | number> = {}) =>
  console.log(JSON.stringify({ event: 'contact', outcome, ...extra }))

/** Lê o corpo até o limite, sem confiar no Content-Length (pode faltar ou mentir). */
async function readCapped(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get('Content-Length') ?? 0)
  if (declared > max) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const all = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    all.set(c, offset)
    offset += c.byteLength
  }
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(all)
}

/** POST /api/contact. A ordem das checagens vai da mais barata à mais cara; o token do Turnstile só é gasto no fim. */
export async function handleContact(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return fail(405, 'method', { Allow: 'POST' })

  // Só o próprio site: bloqueia envio disparado de outra página (CSRF). Nenhum cabeçalho CORS é devolvido.
  const origin = request.headers.get('Origin')
  if (!origin || !list(env.ALLOWED_ORIGINS).has(origin)) return fail(403, 'forbidden')
  const site = request.headers.get('Sec-Fetch-Site')
  if (site && site !== 'same-origin') return fail(403, 'forbidden')

  if (!/^application\/json(\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) return fail(415, 'unsupported')

  const ip = request.headers.get('CF-Connecting-IP')
  const { success } = await env.CONTACT_LIMITER.limit({ key: `contact:${ip ?? 'unknown'}` })
  if (!success) {
    log('rate_limited')
    return fail(429, 'rate_limited', { 'Retry-After': '60' })
  }

  let raw: string | null
  try {
    raw = await readCapped(request, LIMITS.body)
  } catch {
    return fail(400, 'invalid')
  }
  if (raw === null) return fail(413, 'too_large')

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return fail(400, 'invalid')
  }

  const parsed = parseContact(data)
  if (!parsed.ok) return json(422, { ok: false, error: 'invalid', fields: parsed.fields })
  const input = parsed.value

  // Robô que preencheu a isca: responde como sucesso para não ensinar o que foi detectado.
  if (input.honeypot) {
    log('honeypot')
    return json(200, { ok: true })
  }

  if (!(await verifyTurnstile(env, input.token, ip))) {
    log('verification_failed')
    return fail(403, 'verification_failed')
  }

  const now = Date.now()
  try {
    if ((await countSince(env.DB, now - 24 * 60 * 60 * 1000)) >= DAILY_CAP) {
      log('daily_cap')
      return fail(429, 'busy')
    }
  } catch {
    // Banco fora do ar não impede o envio: Turnstile e limite por IP continuam valendo.
  }

  const message: Message = {
    id: crypto.randomUUID(),
    created_at: now,
    name: input.name,
    contact: input.contact,
    reply_email: input.replyEmail,
    body: input.message,
    country: typeof request.cf?.country === 'string' ? request.cf.country : null,
    attempts: 0,
  }

  let stored = true
  try {
    await insert(env.DB, message)
  } catch {
    stored = false
  }

  const delivery = await deliver(env, message)
  if (stored) {
    try {
      await record(env.DB, message.id, 1, delivery, Date.now())
    } catch {
      // O registro fica 'pending' e o cron reenvia. Se o envio tinha dado certo, chega duplicado: melhor que perdido.
    }
  }

  if (delivery.ok) {
    log('sent', { id: message.id })
    return json(200, { ok: true })
  }
  if (stored) {
    log('queued', { id: message.id, code: delivery.code })
    return json(200, { ok: true })
  }
  log('lost', { code: delivery.code })
  return fail(503, 'unavailable')
}
