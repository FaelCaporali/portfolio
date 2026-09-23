/**
 * POST /api/contact. Orquestra as checagens, da mais barata à mais cara (o token do Turnstile só é gasto no fim),
 * e a entrega. Cada passo recusa com um código do contrato; os logs levam só evento, id e código, nunca dado pessoal.
 */
import { LIMITS, type ContactErrorCode } from '../shared/contact/contract'
import { parseContact, type ContactInput } from '../shared/contact/validation'
import { csvSet, json, readCapped } from './http'
import { deliver } from './mail'
import { DAILY_CAP, DAY_MS, type Message } from './message'
import { countSince, insert, record } from './repository'
import { verifyTurnstile } from './turnstile'

const fail = (status: number, error: ContactErrorCode, extra?: HeadersInit) => json(status, { ok: false, error }, extra)

const log = (outcome: string, extra: Record<string, string | number> = {}) => {
  console.log(JSON.stringify({ event: 'contact', outcome, ...extra }))
}

/** Só o próprio site, por POST e com JSON. Bloqueia envio disparado de outra página (CSRF); nenhum cabeçalho CORS. */
function rejectRequest(request: Request, env: Env): Response | null {
  if (request.method !== 'POST') return fail(405, 'method', { Allow: 'POST' })
  const origin = request.headers.get('Origin')
  if (!origin || !csvSet(env.ALLOWED_ORIGINS).has(origin)) return fail(403, 'forbidden')
  const site = request.headers.get('Sec-Fetch-Site')
  if (site && site !== 'same-origin') return fail(403, 'forbidden')
  if (!/^application\/json(\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) return fail(415, 'unsupported')
  return null
}

/** Corpo com teto, UTF-8 estrito e JSON → entrada validada, ou a resposta de recusa. */
async function readInput(request: Request): Promise<ContactInput | Response> {
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
  return parsed.ok ? parsed.value : json(422, { ok: false, error: 'invalid', fields: parsed.fields })
}

/** Teto global por 24 h. Banco fora do ar não impede o envio: Turnstile e limite por IP continuam valendo. */
async function overDailyCap(db: D1Database, now: number): Promise<boolean> {
  try {
    return (await countSince(db, now - DAY_MS)) >= DAILY_CAP
  } catch {
    return false
  }
}

function toMessage(input: ContactInput, request: Request, now: number): Message {
  return {
    id: crypto.randomUUID(),
    created_at: now,
    name: input.name,
    contact: input.contact,
    reply_email: input.replyEmail,
    body: input.message,
    country: typeof request.cf?.country === 'string' ? request.cf.country : null,
    attempts: 0,
  }
}

/**
 * Grava antes de enviar. Falhou o envio com a mensagem gravada: o visitante vê sucesso e o cron reenvia.
 * Falharam envio e banco: o visitante vê o erro (e os contatos diretos).
 */
async function storeAndDeliver(env: Env, message: Message): Promise<Response> {
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

export async function handleContact(request: Request, env: Env): Promise<Response> {
  const rejected = rejectRequest(request, env)
  if (rejected) return rejected

  const ip = request.headers.get('CF-Connecting-IP')
  const { success } = await env.CONTACT_LIMITER.limit({ key: `contact:${ip ?? 'unknown'}` })
  if (!success) {
    log('rate_limited')
    return fail(429, 'rate_limited', { 'Retry-After': '60' })
  }

  const input = await readInput(request)
  if (input instanceof Response) return input

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
  if (await overDailyCap(env.DB, now)) {
    log('daily_cap')
    return fail(429, 'busy')
  }

  return storeAndDeliver(env, toMessage(input, request, now))
}
