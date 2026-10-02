/**
 * Contrato do registro de visitas entre o site (src/lib/track.ts) e o Worker (worker/visits.ts), D-MON1/D-MON2
 * (.wai/monitoramento/02-plano.md). Sem cookie nem nada gravado no aparelho: a visita é um id aleatório em memória,
 * por aba. O navegador manda, ao esconder ou trocar de página, o tempo visível e o que a pessoa fez nela.
 */

export const VISITS_PATH = '/api/e'

/** O que o site conta. Nome fora da lista é recusado: o Worker não grava texto livre. */
const EVENTS = [
  'bust_drag', // arrastou o busto
  'life_pick', // escolheu uma vida no indicador (detalhe: a vida)
  'journey_open', // "See the full journey"
  'cta_down', // CTA do herói que desce para o conteúdo
  'resume', // baixou o currículo (detalhe: o idioma do PDF)
  'profile', // abriu o LinkedIn ou o GitHub (detalhe)
  'copy_contact', // copiou o e-mail ou o telefone (detalhe)
  'contact_open', // abriu o formulário (detalhe: a oferta, quando veio de uma)
  'contact_sent', // a mensagem foi aceita
  'offer_cta', // "Start a project" de uma oferta (detalhe: a página da oferta)
  'lang_switch', // trocou o idioma (detalhe: o novo)
  'mcp_copy', // copiou o endereço ou uma configuração na /mcp (detalhe)
  'journey_filter', // filtrou a trajetória (detalhe: a ferramenta, conceito ou habilidade)
] as const
export type EventName = (typeof EVENTS)[number]

export const VISIT_LIMITS = {
  /** Corpo inteiro, em bytes. */
  body: 4096,
  /** Eventos por página: a trava contra repetição (arrastar o busto 50 vezes conta como 1, src/lib/track.ts). */
  events: 30,
  detail: 60,
  /** Tempo visível numa página: no máximo um dia. */
  visibleMs: 24 * 60 * 60 * 1000,
} as const

/** Corpo do POST: visita, página, tempo visível em ms e os eventos [nome, detalhe]. */
export interface VisitBeat {
  v: string
  p: string
  t: number
  e: [EventName, string][]
}

export const VISIT_ID = /^[a-z0-9]{12}$/
/** Detalhe curto e sem marcação: rótulos do próprio site (vida, idioma, oferta, ferramenta da trajetória). */
export const DETAIL = /^[\p{L}\p{N} .:/+#_()-]*$/u

export const isEventName = (v: unknown): v is EventName => EVENTS.some((e) => e === v)
