/** Utilidades HTTP da API: resposta JSON endurecida, leitura de corpo com teto e listas de configuração. */
import type { ContactResponse } from '../shared/contact/contract'

export type ApiBody = ContactResponse | { ok: false; error: 'not_found' }

/** Resposta da API: só JSON, nunca em cache, sem conteúdo ativo. Erros genéricos, sem detalhe interno. */
export function json(status: number, body: ApiBody, extra?: HeadersInit): Response {
  const headers = new Headers(extra)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  return new Response(JSON.stringify(body), { status, headers })
}

/** Lê o corpo até o limite, sem confiar no Content-Length (pode faltar ou mentir). null = passou do limite. */
export async function readCapped(request: Request, max: number): Promise<string | null> {
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

/** Variável de ambiente com valores separados por vírgula (origens, hostnames). */
export const csvSet = (csv: string) =>
  new Set(
    csv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
