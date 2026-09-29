import { renderToReadableStream } from 'react-dom/server'
import { ServerRouter, type EntryContext } from 'react-router'

/**
 * Só roda no build (ssr: false, react-router.config.ts): gera o HTML de cada página pré-renderizada. Espera a árvore
 * inteira (allReady), porque o arquivo é estático; erro de renderização derruba o build em vez de sair uma página
 * quebrada. Sem isbot nem @react-router/node: não há servidor respondendo a visitantes.
 */
export default async function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  context: EntryContext,
): Promise<Response> {
  const errors: unknown[] = []
  const body = await renderToReadableStream(<ServerRouter context={context} url={request.url} />, {
    onError(error: unknown) {
      errors.push(error)
    },
  })
  await body.allReady
  if (errors.length) throw new AggregateError(errors, `prerender de ${new URL(request.url).pathname} falhou`)
  headers.set('Content-Type', 'text/html; charset=utf-8')
  return new Response(body, { headers, status })
}
