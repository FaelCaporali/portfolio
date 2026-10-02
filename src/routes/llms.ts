import { llmsTxt } from '../seo/llms'

/** O /llms.txt (llmstxt.org): o índice do portfólio para assistentes de IA. Rota de recurso pré-renderizada. */
export function loader() {
  return new Response(llmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
