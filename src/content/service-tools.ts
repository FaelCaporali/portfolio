import { checkpoints } from './journey-timeline'
import type { Service } from './services'

/**
 * As ferramentas dos marcos que provam uma oferta, como estão na trajetória, sem repetir e na ordem em que aparecem.
 * Importa journey.json: só no build (o loader da página de oferta e o markdown), nunca no pacote do navegador.
 */
export function serviceTools(service: Service): string[] {
  const ids = new Set(service.journeyIds)
  return [...new Set(checkpoints.filter((c) => ids.has(c.id)).flatMap((c) => c.tags?.tools ?? []))]
}
