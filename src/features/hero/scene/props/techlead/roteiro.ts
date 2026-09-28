/**
 * Roteiro da vida techlead, "Da conversa à cadência" (REQUISITOS T1, T2, T8, T10; FICHA-PRODUCAO, FECHAMENTO). c = s
 * desde o começo do ciclo; o ciclo 0 começa na MONTAGEM da vida (auge do furacão: o busto se reconstrói em 1 s; pausa
 * de 5 s, a saída começa em 6,0). As 6 batidas (BATIDAS, em s da pausa; a primeira começa em c = INICIO) são o único
 * lugar dos tempos: todo o resto sai delas, com os textos do fundo ADIANTADOS a cada batida. Ritmo (.wai/3d/estudio/
 * RITMO.md): a DESTRAVA é o clímax (1,5 s, oito eventos e o respiro no teste verde antes do Done); a cadência fecha
 * até 5,5 e o estado final fica parado até a saída. Os offsets internos dos blocos escalam pelo fator da batida
 * (ESCALA: batida de 5 s sobre a de 3,5 s homologada).
 *   escuta: o balão do cliente e a onda que ENTRA pela concha (LED aceso); a fala vira legenda rolando;
 *   entendimento: trechos da fala se destacam e viram post-its de traço Excalidraw (Problem, Need, Requirement);
 *   solução: mockup low-fi (Excalidraw / Figma) e o fluxo de uso em Mermaid;
 *   coordenação: issues do Jira no Kanban; avatares genéricos puxam cartões; o `</>` do Fael ligado a todos;
 *   DESTRAVA (ponto alto): o cartão em In Progress fica Blocked (`blocked · 5h`), a equipe tenta (restart, timeout,
 *   pods), o log mostra o checkout estourando o tempo com a mesma query; a onda SAI do microfone rumo à equipe; o
 *   `</>` diz "it's an N+1 — batch the query" com o diff de 1 linha; `2 min`, teste verde, o cartão corre para Done;
 *   cadência: o burndown dá o degrau, a release sai e um novo balão do cliente recomeça o ciclo.
 * Olhar: cliente → post-its → mockup/fluxo → quadro → cartão bloqueado → burndown. Com a pausa segurada o ciclo
 * recomeça com o fundo limpo (TechLead.tsx). Só números: o estado sai num objeto reaproveitado.
 */
import { GRUPO } from './estilo'

/** c em que a primeira batida começa (o busto já quase inteiro). */
const INICIO = 0.8
/** Batidas em s da pausa de 5 s (RITMO.md; a de 3,5 s foi combinada com o Fael, T10). */
export const BATIDAS = {
  escuta: [0, 0.7],
  entendimento: [0.7, 1.25],
  solucao: [1.25, 1.9],
  coordenacao: [1.9, 2.5],
  destrava: [2.5, 4.0],
  cadencia: [4.0, 4.5],
} as const
/**
 * Fator de cada batida sobre a de 3,5 s (0,55 / 0,5 / 0,5 / 0,5 / 0,75 / 0,7 s): os offsets internos dos blocos
 * (`t + 0.05 * ESCALA.x`) andam com a sua batida. A destrava não escala por igual (os eventos estão distribuídos
 * em T); 1,5 vale para os seus offsets de desenho. A cadência encolhe: o estado final precisa de 0,5 s parado.
 */
export const ESCALA = {
  escuta: 0.7 / 0.55,
  entendimento: 0.55 / 0.5,
  solucao: 0.65 / 0.5,
  coordenacao: 0.6 / 0.5,
  destrava: 1.5,
  cadencia: 0.5 / 0.7,
} as const
const K = ESCALA
const b0 = (k: keyof typeof BATIDAS) => INICIO + BATIDAS[k][0]
const b1 = (k: keyof typeof BATIDAS) => INICIO + BATIDAS[k][1]
const ES = b0('escuta')
const EN = b0('entendimento')
const SO = b0('solucao')
const CO = b0('coordenacao')
const DE = b0('destrava')
const CA = b0('cadencia')

export const T = {
  /** Escuta: balão (adiantado), onda desenhada, legenda (3 linhas). */
  balao: ES - 0.35 * K.escuta,
  onda: [ES - 0.3 * K.escuta, ES + 0.15 * K.escuta],
  legenda: [ES - 0.15 * K.escuta, b1('escuta') - 0.05 * K.escuta],
  /** LED aceso e a voz correndo pela onda. */
  escuta: [ES - 0.35 * K.escuta, b1('escuta') + 0.1 * K.escuta],
  /** Entendimento: trechos destacados na legenda; post-its (um a cada 0,165 s). */
  destaca: [EN - 0.05 * K.entendimento, EN + 0.15 * K.entendimento],
  postits: EN - 0.25 * K.entendimento,
  /** Solução: mockup e o fluxo em Mermaid. */
  mockup: [SO - 0.25 * K.solucao, SO + 0.3 * K.solucao],
  fluxo: [SO - 0.1 * K.solucao, b1('solucao')],
  /** Coordenação: quadro, equipe e cartões (movimentos em cartoes.ts, a partir de CO). */
  quadro: CO - 0.3 * K.coordenacao,
  equipe: [CO - 0.2 * K.coordenacao, CO + 0.1 * K.coordenacao],
  cartoes: [CO - 0.15 * K.coordenacao, CO + 0.1 * K.coordenacao],
  coordenacao: CO,
  /**
   * Destrava (clímax, ritmo constante de ~0,14 s entre as falas): conversa e bloqueio (adiantados), log, a voz que
   * sai do microfone, o conselho, o diff, 2 min, teste verde; o RESPIRO (0,32 s parado no verde) e o cartão corre
   * para Done; em seguida o APP-103 é puxado para In Progress.
   */
  conversa: [DE - 0.3, DE + 0.24],
  bloqueio: DE - 0.25,
  log: [DE + 0.22, DE + 0.5],
  saida: [DE + 0.5, DE + 1.1],
  conselho: [DE + 0.64, DE + 0.78],
  diff: DE + 0.8,
  doisMin: DE + 0.92,
  verde: DE + 1.06,
  done: [DE + 1.38, DE + 1.54],
  puxa: [DE + 1.54, DE + 1.66],
  destrava: DE,
  /**
   * Cadência: sprints, burndown (o platô enquanto trava, o degrau junto com o Done), release e o novo balão
   * (~0,16 s entre eles); o novo balão termina de se escrever em ~5,48 e tudo fica parado até a saída.
   */
  sprint: [CA - 0.3 * K.cadencia, CA + 0.4 * K.cadencia],
  plato: [CO + 0.1 * K.coordenacao, DE + 0.72],
  degrau: [DE + 1.38, CA + 0.2],
  release: CA + 0.18,
  novoBalao: CA + 0.36,
  /** Fim do ciclo (início da saída do carrossel: 1 s de reconstrução + 5 s de pausa). */
  fim: 6,
} as const

const liso = (x: number) => {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}
const entre = (c: number, [a, b]: readonly [number, number]) => liso((c - a) / (b - a))

/** Para onde os olhos vão (pontos do fundo registrados pelos blocos). */
export type Alvo = 'cliente' | 'postits' | 'solucao' | 'quadro' | 'bloqueado' | 'burndown'

export interface Quadro {
  /** Instante do desenho (revela.ts: uT). */
  t: number
  /** Estado de cada grupo (0 = A, 1 = B). */
  est: Float32Array
  /** Voz do cliente correndo pela onda de entrada (0–1) e o LED do headset (0–1). */
  fluxo: number
  led: number
  /** Voz do Fael saindo do microfone rumo à equipe (0–1). */
  saida: number
  olhar: number
  alvo: Alvo
}

export const criarQuadro = (): Quadro => ({
  t: 0,
  est: new Float32Array(8),
  fluxo: 0,
  led: 0,
  saida: 0,
  olhar: 0,
  alvo: 'cliente',
})

/** Estado no instante c do ciclo. */
export function quadroEm(c: number, q: Quadro) {
  q.t = c
  q.est.fill(0)
  q.est[GRUPO.destaque] = entre(c, T.destaca)
  const [e0, e1] = T.escuta
  const escuta = entre(c, [e0, e0 + 0.12 * K.escuta]) * (1 - entre(c, [e1 - 0.15 * K.escuta, e1]))
  q.fluxo = escuta
  const [s0, s1] = T.saida
  q.saida = entre(c, [s0, s0 + 0.08 * K.destrava]) * (1 - entre(c, [s1 - 0.1 * K.destrava, s1]))
  // O LED acende quando ele escuta e quando ele fala.
  q.led = Math.max(escuta, q.saida)
  q.olhar = entre(c, [T.balao, T.balao + 0.35 * K.escuta])
  q.alvo = 'cliente'
  if (c >= EN) q.alvo = 'postits'
  if (c >= SO) q.alvo = 'solucao'
  if (c >= CO) q.alvo = 'quadro'
  if (c >= DE - 0.1 * K.destrava) q.alvo = 'bloqueado'
  if (c >= CA) q.alvo = 'burndown'
  return q
}

/** Estado final parado (movimento reduzido): tudo desenhado, cartões no lugar final, LED apagado, olhar livre. */
export function quadroFinal(q: Quadro) {
  quadroEm(T.fim, q)
  q.olhar = 0
  q.fluxo = 0
  q.saida = 0
  q.led = 0
  return q
}
