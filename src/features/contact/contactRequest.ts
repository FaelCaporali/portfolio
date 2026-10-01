/**
 * Pedido de abrir o contato vindo de fora do botão flutuante (os CTAs da home): o ContactWidget da página escuta e abre
 * o MESMO painel, sem segunda instância do formulário nem da verificação anti-robô. Quem pede passa o próprio botão: ao
 * fechar com Esc, o foco volta a ele, não ao "Contact me". Um CTA de oferta passa também o assunto (o título dela), que
 * o formulário mostra e junta à mensagem; os outros abrem sem assunto. O widget publica aqui se o painel está aberto e
 * o id dele, para cada botão que o abre ter aria-expanded e aria-controls.
 */
type Listener = (opener?: HTMLElement, topic?: string) => void
const listeners = new Set<Listener>()

/**
 * Abre o formulário do ContactWidget montado na página; `opener` recebe o foco de volta quando ele fecha; `topic`, o
 * assunto (sem ele, o formulário abre sem assunto e esquece o anterior).
 */
export function requestContact(opener?: HTMLElement, topic?: string) {
  for (const l of listeners) l(opener, topic)
}

/** O ContactWidget se inscreve ao montar; devolve a saída (para o efeito do React). */
export function onContactRequest(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** O estado do painel, como o ContactWidget publica: aberto ou não e o id dele (useSyncExternalStore). */
export interface ContactPanelState {
  open: boolean
  panelId?: string
}
const CLOSED: ContactPanelState = { open: false }
let state = CLOSED
const watchers = new Set<() => void>()

export function publishContactPanel(next: ContactPanelState) {
  if (next.open === state.open && next.panelId === state.panelId) return
  state = next
  for (const w of watchers) w()
}

export function watchContactPanel(watcher: () => void): () => void {
  watchers.add(watcher)
  return () => {
    watchers.delete(watcher)
  }
}

export const contactPanelState = () => state
/** No HTML do build o painel está fechado e ainda sem id. */
export const contactPanelServerState = () => CLOSED
