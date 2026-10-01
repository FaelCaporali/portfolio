/** Apoio dos testes do MCP: o Worker chamado direto e o cliente oficial ligado a ele, fechado ao fim de cada teste. */
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { afterEach } from 'vitest'
import worker from '../index'

export const MCP_URL = 'https://fael.caporali.dev/mcp'

/** Rede nova por requisição (o limite por rede é testado à parte), como a Cloudflare a descreve em `request.cf`. */
const asnBase = 64_512 + Math.floor(Math.random() * 1000) * 1000
let asnSeq = 0
export const network = (asn = asnBase + ++asnSeq) => ({ asn, asOrganization: 'Rede de Teste', country: 'BR' })

/** Uma requisição ao Worker, esperando o que ele deixou para depois de responder (o registro no D1). */
export async function fetchWorker(url: string | URL, init?: RequestInit, e: Env = env) {
  const ctx = createExecutionContext()
  const request = new Request(url, { cf: network(), ...init })
  const response = await worker.fetch(request as Request<unknown, IncomingRequestCfProperties>, e, ctx)
  await waitOnExecutionContext(ctx)
  return response
}

export const open: Client[] = []
afterEach(async () => {
  await Promise.all(open.splice(0).map((c) => c.close()))
})

/**
 * Um cliente conectado ao Worker: o protocolo 2026-07-28 (envelope por requisição, sem initialize) fixado, ou o de
 * 2025 (initialize), que é o que o cliente oficial usa quando ninguém pede outro.
 */
export async function connect(legacy = false, e: Env = env) {
  const client = new Client(
    { name: 'teste-portfolio', version: '1.0.0' },
    { versionNegotiation: { mode: legacy ? 'legacy' : { pin: '2026-07-28' } } },
  )
  const fetch = (url: string | URL, init?: RequestInit) => fetchWorker(url, init, e)
  await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL), { fetch }))
  open.push(client)
  return client
}
