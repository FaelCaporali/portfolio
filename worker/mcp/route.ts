/**
 * A rota do MCP, sem o SDK: o Worker é um só, e cada página do site acorda o mesmo isolate. O servidor (server.ts, com
 * o SDK e o zod) só é importado quando um cliente MCP chama /mcp; página nenhuma paga para avaliá-lo na partida a frio
 * (medido em 01/10: partida de ~30 ms com o import sob demanda, ~80 ms com o import direto).
 */
export const MCP_PATH = '/mcp'

/**
 * O endereço do MCP para os agentes: https://fael-caporali.rafaelhon.workers.dev/mcp (D-MCP11). O workers.dev fica fora
 * da zona caporali.dev, onde o Bot Fight Mode (que no plano grátis não aceita exceção por caminho) desafiaria as
 * chamadas que saem dos datacenters da Anthropic e da OpenAI. Lá só o MCP responde; o resto vai para o site.
 */
export const isWorkersDev = (url: URL) => url.hostname.endsWith('.workers.dev')

/**
 * GET ou HEAD que não abre o fluxo SSE do protocolo de 2025 (Accept: text/event-stream) é de navegador, de gerador de
 * prévia de link ou de curl (Accept: * / *): vai para a página /mcp do site. Cliente MCP manda POST (os dois
 * protocolos) ou esse GET de SSE.
 */
export const wantsPage = (request: Request) =>
  (request.method === 'GET' || request.method === 'HEAD') &&
  !(request.headers.get('Accept') ?? '').includes('text/event-stream')

/**
 * A resposta de página em /mcp (a página, o redirect de idioma, o 404) depende do Accept, porque o mesmo endereço é o
 * servidor para o cliente MCP: um cache não pode servir uma no lugar da outra.
 */
export function varyOnAccept(response: Response): Response {
  const page = new Response(response.body, response)
  page.headers.append('Vary', 'Accept')
  return page
}

/**
 * Limite por rede (ASN), antes de carregar o SDK: uma rede que dispara chamadas não gasta a CPU do servidor nem as
 * cotas do dia (mcp/audit.ts). Responde no formato JSON-RPC, que todo cliente MCP lê.
 */
export async function limitMcp(request: Request, env: Env): Promise<Response | null> {
  const asn = (request.cf as IncomingRequestCfProperties | undefined)?.asn
  const { success } = await env.MCP_LIMITER.limit({ key: `mcp:${typeof asn === 'number' ? asn : 'unknown'}` })
  if (success) return null
  const body = { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Too many requests from this network.' } }
  return Response.json(body, { status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } })
}
