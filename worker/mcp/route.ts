/**
 * A rota do MCP, sem o SDK: o Worker é um só, e cada página do site acorda o mesmo isolate. O servidor (server.ts, com
 * o SDK e o zod) só é importado quando um cliente MCP chama /mcp; página nenhuma paga para avaliá-lo na partida a frio
 * (medido em 01/10: partida de ~30 ms com o import sob demanda, ~80 ms com o import direto).
 */
export const MCP_PATH = '/mcp'

/**
 * GET ou HEAD que não abre o fluxo SSE do protocolo de 2025 (Accept: text/event-stream) é de navegador, de gerador de
 * prévia de link ou de curl (Accept: * / *): vai para a página /mcp do site. Cliente MCP manda POST (os dois
 * protocolos) ou esse GET de SSE.
 */
export const wantsPage = (request: Request) =>
  (request.method === 'GET' || request.method === 'HEAD') &&
  !(request.headers.get('Accept') ?? '').includes('text/event-stream')
