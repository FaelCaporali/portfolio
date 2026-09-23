/** Apoio dos testes do Worker: requisições prontas, dublês do Turnstile e da binding de e-mail, leitura do D1. */
import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, vi } from 'vitest'
import { CONTACT_PATH } from '../../shared/contact/contract'
import worker from '../index'
import type { Message } from '../message'

export const ORIGIN = 'https://fael.caporali.dev'
export const CONTACT_URL = `${ORIGIN}${CONTACT_PATH}`

/** IP novo por requisição (o limite por IP é testado à parte). IPv6 de documentação, distinto entre arquivos de teste. */
const run = crypto.randomUUID().slice(0, 4)
let ipSeq = 0
const nextIp = () => `2001:db8:${run}::${(++ipSeq).toString(16)}`

export const valid = {
  name: 'Maria Silva',
  contact: 'maria@example.com',
  message: 'Olá, Fael! Vamos conversar sobre uma vaga.',
  token: 'tok',
  website: '',
}

export function post(body: unknown, init: { headers?: Record<string, string>; raw?: string; ip?: string } = {}) {
  return new Request(CONTACT_URL, {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      'CF-Connecting-IP': init.ip ?? nextIp(),
      ...init.headers,
    },
    body: init.raw ?? JSON.stringify(body),
    cf: { country: 'BR' },
  })
}

const sendOk = async (_mail: EmailMessageBuilder) => ({ messageId: 'msg-1' })

/** Dublês renovados a cada teste: a binding de e-mail, a resposta do siteverify e o env que os usa. */
export const t = {
  send: vi.fn(sendOk),
  siteverify: {} as Record<string, unknown>,
  env: env as Env,
}

/** Registra os dublês no arquivo de teste: D1 vazio, e-mail aceito, siteverify aprovando e nenhum outro fetch. */
export function useWorkerDoubles() {
  beforeEach(async () => {
    await env.DB.exec('DELETE FROM messages')
    t.send = vi.fn(sendOk)
    t.env = { ...env, EMAIL: { send: t.send } as unknown as SendEmail }
    t.siteverify = { success: true, action: 'contact', hostname: 'fael.caporali.dev' }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.startsWith('https://challenges.cloudflare.com/turnstile/v0/siteverify'))
        return Response.json(t.siteverify)
      throw new Error(`fetch inesperado: ${url}`)
    })
  })
  afterEach(() => vi.restoreAllMocks())
}

/** E-mail entregue à binding na primeira chamada de send. */
export const sentMail = () => t.send.mock.calls[0]?.[0] as EmailMessageBuilder

export const call = (req: Request, e: Env = t.env) =>
  worker.fetch(req as Request<unknown, IncomingRequestCfProperties>, e)

export const rows = () =>
  env.DB.prepare('SELECT * FROM messages ORDER BY created_at')
    .all<Message & { status: string; last_error: string | null; message_id: string | null }>()
    .then((r) => r.results)

/** D1 que falha em qualquer consulta. */
export const brokenDb = {
  prepare: () => {
    throw new Error('D1 down')
  },
} as unknown as D1Database
