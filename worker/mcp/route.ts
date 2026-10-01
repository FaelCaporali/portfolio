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
