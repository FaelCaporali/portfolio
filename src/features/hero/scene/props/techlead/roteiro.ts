/**
 * Roteiro da vida techlead, "Da conversa à cadência" (REQUISITOS T1, T2, T8, T10; FICHA-PRODUCAO, FECHAMENTO). c = s
 * desde o começo do ciclo; o ciclo 0 começa na MONTAGEM da vida (auge do furacão: o busto se reconstrói em 1 s; pausa
 * de 3,5 s, a saída começa em 4,5). As 6 batidas (BATIDAS, em s da pausa; a primeira começa em c = INICIO) são o único
 * lugar dos tempos: todo o resto sai delas, com os textos do fundo ADIANTADOS a cada batida.
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
/** Batidas em s da pausa de 3,5 s (combinadas com o Fael, T10). */
export const BATIDAS = {
  escuta: [0, 0.55],
  entendimento: [0.55, 1.05],
  solucao: [1.05, 1.55],
  coordenacao: [1.55, 2.05],
  destrava: [2.05, 2.8],
  cadencia: [2.8, 3.5],
} as const
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
  balao: ES - 0.35,
  onda: [ES - 0.3, ES + 0.15],
  legenda: [ES - 0.15, b1('escuta') - 0.05],
  /** LED aceso e a voz correndo pela onda. */
  escuta: [ES - 0.35, b1('escuta') + 0.1],
  /** Entendimento: trechos destacados na legenda; post-its (um a cada 0,15 s). */
  destaca: [EN - 0.05, EN + 0.15],
  postits: EN - 0.25,
  /** Solução: mockup e o fluxo em Mermaid. */
  mockup: [SO - 0.25, SO + 0.3],
  fluxo: [SO - 0.1, b1('solucao')],
  /** Coordenação: quadro, equipe e cartões (movimentos em cartoes.ts, a partir de CO). */
  quadro: CO - 0.3,
  equipe: [CO - 0.2, CO + 0.1],
  cartoes: [CO - 0.15, CO + 0.1],
  coordenacao: CO,
  /** Destrava: bloqueio, conversa, log, a voz que sai do microfone, o conselho, o diff, 2 min, teste verde. */
  bloqueio: DE - 0.25,
  conversa: [DE - 0.3, DE + 0.05],
  log: [DE - 0.05, DE + 0.2],
  saida: [DE + 0.12, DE + 0.55],
  conselho: [DE + 0.25, DE + 0.42],
  diff: DE + 0.42,
  doisMin: DE + 0.5,
  verde: DE + 0.56,
  destrava: DE,
  /** Cadência: sprints, burndown (o platô antes, o degrau agora), release e o novo balão. */
  sprint: [CA - 0.3, CA + 0.4],
  plato: [CO + 0.1, DE + 0.3],
  degrau: [CA - 0.15, CA + 0.3],
  release: CA + 0.45,
  novoBalao: CA + 0.6,
  /** Fim do ciclo (início da saída do carrossel). */
  fim: 4.5,
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
  const escuta = entre(c, [e0, e0 + 0.12]) * (1 - entre(c, [e1 - 0.15, e1]))
  q.fluxo = escuta
  const [s0, s1] = T.saida
  q.saida = entre(c, [s0, s0 + 0.08]) * (1 - entre(c, [s1 - 0.1, s1]))
  // O LED acende quando ele escuta e quando ele fala.
  q.led = Math.max(escuta, q.saida)
  q.olhar = entre(c, [T.balao, T.balao + 0.35])
  q.alvo = 'cliente'
  if (c >= EN) q.alvo = 'postits'
  if (c >= SO) q.alvo = 'solucao'
  if (c >= CO) q.alvo = 'quadro'
  if (c >= DE - 0.1) q.alvo = 'bloqueado'
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
