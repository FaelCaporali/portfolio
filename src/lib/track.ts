/**
 * Registro de visitas no navegador (D-MON1/D-MON2, .wai/monitoramento/02-plano.md; contrato em shared/visits.ts).
 * Nada fica gravado no aparelho: a visita é um id aleatório em memória, que morre com a aba. Cada página junta o tempo
 * visível e o que a pessoa fez, e manda um sendBeacon só ao esconder a aba, ao fechar ou ao trocar de página. Sem
 * biblioteca de terceiro, sem mudar a CSP (o mesmo endereço do site).
 */
import { VISIT_LIMITS, VISITS_PATH, type EventName, type VisitBeat } from '../../shared/visits'

/** Fora do que o Worker aceita no detalhe (shared/visits.ts, DETAIL): sai, para um rótulo não derrubar o envio. */
const NOT_DETAIL = /[^\p{L}\p{N} .:/+#_()-]/gu

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

function newVisitId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

interface PageState {
  path: string
  /** Tempo visível já somado (ms) e desde quando está visível (performance.now), se estiver. */
  visible: number
  since: number | null
  events: VisitBeat['e']
  /** Evento repetido na mesma página conta uma vez (arrastar o busto 50 vezes = 1). */
  seen: Set<string>
}

let visit = ''
let page: PageState | null = null

const now = () => performance.now()
const isVisible = () => document.visibilityState === 'visible'

function open(path: string): PageState {
  return { path, visible: 0, since: isVisible() ? now() : null, events: [], seen: new Set() }
}

function pause(p: PageState) {
  if (p.since !== null) p.visible += now() - p.since
  p.since = null
}

/** Manda o que a página juntou e zera. Página sem tempo nem evento não manda nada. */
function flush(p: PageState) {
  pause(p)
  if (p.visible < 1 && p.events.length === 0) return
  const beat: VisitBeat = {
    v: visit,
    p: p.path,
    t: Math.min(Math.round(p.visible), VISIT_LIMITS.visibleMs),
    e: p.events,
  }
  const body = JSON.stringify(beat)
  // Texto puro: o sendBeacon com JSON vira requisição "não simples" em alguns navegadores. O Worker lê o corpo igual.
  if (!navigator.sendBeacon(VISITS_PATH, body)) {
    void fetch(VISITS_PATH, { method: 'POST', body, keepalive: true }).catch(() => undefined)
  }
  p.visible = 0
  p.events = []
  p.seen.clear()
}

/** Algo que a pessoa fez nesta página. Antes de começar (ou no build), não faz nada. */
export function track(name: EventName, detail = '') {
  if (!page) return
  const clean = detail.replace(NOT_DETAIL, '').slice(0, VISIT_LIMITS.detail)
  const key = `${name}\u0000${clean}`
  if (page.seen.has(key) || page.events.length >= VISIT_LIMITS.events) return
  page.seen.add(key)
  page.events.push([name, clean])
}

/** A página mudou pelo roteador: manda a anterior e começa a nova. */
export function trackPage(path: string) {
  if (!page) return
  if (page.path === path) return
  flush(page)
  page = open(path)
}

/** Começa o registro na aba (uma vez). Devolve a função que para (os testes usam). */
export function startTracking(path: string): () => void {
  if (page) return () => undefined
  visit = newVisitId()
  page = open(path)
  const onVisibility = () => {
    if (!page) return
    if (isVisible()) page.since = now()
    else flush(page)
  }
  const onHide = () => {
    if (page) flush(page)
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onHide)
  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onHide)
    page = null
  }
}
