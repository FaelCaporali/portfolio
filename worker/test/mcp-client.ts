/** Apoio dos testes do MCP: o Worker chamado direto e o cliente oficial ligado a ele, fechado ao fim de cada teste. */
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { env } from 'cloudflare:workers'
import { afterEach } from 'vitest'
import worker from '../index'

export const MCP_URL = 'https://fael.caporali.dev/mcp'

export const fetchWorker = (url: string | URL, init?: RequestInit) =>
  worker.fetch(new Request(url, init) as Request<unknown, IncomingRequestCfProperties>, env)

export const open: Client[] = []
afterEach(async () => {
  await Promise.all(open.splice(0).map((c) => c.close()))
})

/**
 * Um cliente conectado ao Worker: o protocolo 2026-07-28 (envelope por requisição, sem initialize) fixado, ou o de
 * 2025 (initialize), que é o que o cliente oficial usa quando ninguém pede outro.
 */
export async function connect(legacy = false) {
  const client = new Client(
    { name: 'teste-portfolio', version: '1.0.0' },
    { versionNegotiation: { mode: legacy ? 'legacy' : { pin: '2026-07-28' } } },
  )
  await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL), { fetch: fetchWorker }))
  open.push(client)
  return client
}
