/**
 * Secret opcional, fora do `wrangler types` (que só tipa os secrets que acha no .dev.vars): o token da API SQL do
 * Analytics Engine para o resumo semanal (worker/visits.ts). Sem ele, o resumo diz que falta e o resto segue.
 */
interface Env {
  CF_API_TOKEN?: string
}
