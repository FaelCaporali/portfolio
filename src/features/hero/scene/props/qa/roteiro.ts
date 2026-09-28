/**
 * Roteiro da vida qa (FICHA-PRODUCAO.md, "FICHA v2 — NARRATIVA"; REQUISITOS N1–N5, Q17, Q18). c = s desde o começo
 * do ciclo. O ciclo 0 começa na MONTAGEM da vida (auge do furacão; o busto se reconstrói em 1 s e a pausa da vida qa é
 * de 3,5 s: a saída começa em c = 4,5). O bug já nasce solto (Q11):
 *   0,0–1,72  N1 voo errático com rastro (visível a partir de ~0,7, quando o busto chega à altura do voo); os olhos
 *             passam do ponteiro ao bug, um pouco à frente dele;
 *   0,9       N1 o ALERTA dispara no ponto de captura e pulsa (monitoramento: início de Q18);
 *   1,4–1,72  N2 a lupa sobe em linha reta até o anel; o bug chega e TRAVA sob a lente até 1,9 (anel apaga);
 *   Os textos do fundo vêm ADIANTADOS (Q22), completos cedo: à esquerda o BUG REPORT (Q20, Q24) se escreve desde o voo
 *   (0,3–1,2 cabeçalho e triagem; 1,2–1,95 passos, Expected / Actual); à direita o CASO DE TESTE em Gherkin (logo do
 *   Cucumber) surge enquanto o report termina (1,7–2,5) e o Cypress roda (2,55–2,95): passos verdes (N3, N4);
 *   3,3–3,9   N5 a lupa leva o bug até a VAGA da caixa, onde ele é alfinetado (catalogado; com o caso de teste verde
 *             no fundo, a documentação que impede a volta do bug: fim de Q18);
 *   3,9–4,5   estado final: a caixa com o bug novo catalogado e os dois textos completos; a lupa sai vazia.
 * Com a pausa segurada (Q17), o ciclo recomeça (Qa.tsx) com o fundo limpo: o bug escapa da vaga e tudo se repete.
 * Só números: o estado sai num objeto reaproveitado.
 */
import { ROTAS } from './voo'

export const T = {
  olhar: [0.5, 0.85],
  alerta: 0.9,
  lupa: [1.4, 1.72],
  chega: 1.72,
  trava: 1.9,
  reportA: [0.3, 1.2],
  reportB: [1.2, 1.95],
  gherkin: [1.7, 2.5],
  cypress: [2.55, 2.95],
  verdes: [2.62, 2.88],
  leva: [3.3, 3.72],
  pino: [3.72, 3.9],
  lupaSai: [3.95, 4.4],
  /** Fim do ciclo (início da saída do carrossel). */
  fim: 4.5,
  /** Repetição: o bug sai da vaga em `escapa` s (élitros abrem). */
  escapa: 0.18,
} as const

/** Passos do cenário que o Cypress deixa verdes (Given, When, Then). */
const PASSOS = 3

const liso = (x: number) => {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}
const entre = (c: number, [a, b]: readonly [number, number]) => liso((c - a) / (b - a))
/** Digitação: ritmo constante na janela. */
const linear = (c: number, [a, b]: readonly [number, number]) => Math.min(1, Math.max(0, (c - a) / (b - a)))
/** Quantas das n linhas já apareceram na janela [a, b] (a primeira em a). */
const contar = (c: number, [a, b]: readonly [number, number], n: number) =>
  c < a ? 0 : Math.min(n, 1 + Math.floor(((c - a) / (b - a)) * n))

/** Para onde os olhos vão: o bug (um pouco à frente), a lente (o bug preso) ou a vaga da caixa. */
type Alvo = 'bug' | 'lente' | 'vaga'

export interface Quadro {
  /** Índice da rota em ROTAS e s de voo nela (a rota é esticada até a chegada em T.chega). */
  rota: number
  tv: number
  /** 1 voando (élitros abertos, patas encolhidas, tamanho natural), 0 parado (na lente ou na vaga). */
  voo: number
  /** Peso do alvo do olhar (0 = ponteiro) e o alvo. */
  olhar: number
  alvo: Alvo
  /** Intensidade do anel de alerta (0 apagado). */
  anel: number
  /** Subida da lupa na linha reta (0 fora, 1 no anel), ida até a vaga (0–1) e saída vazia (0–1). */
  lupa: number
  leva: number
  lupaSai: number
  /** Descida do bug da lente ao alfinete (0–1); `preso` = já na caixa (o bug catalogado). */
  pino: number
  preso: boolean
  /** Texto do fundo (fundo.ts): progresso de cada bloco (0–1) e passos verdes no Cypress. */
  a: number
  b: number
  g: number
  c: number
  verdes: number
}

export const criarQuadro = (): Quadro => ({
  rota: 0,
  tv: 0,
  voo: 1,
  olhar: 0,
  alvo: 'bug',
  anel: 0,
  lupa: 0,
  leva: 0,
  lupaSai: 0,
  pino: 0,
  preso: false,
  a: 0,
  b: 0,
  g: 0,
  c: 0,
  verdes: 0,
})

/** Estado no instante c do ciclo `ciclo` (0 = entrada da vida; ≥ 1 = repetições, que saem da vaga). */
export function quadroEm(c: number, ciclo: number, q: Quadro) {
  const rotas = ROTAS.length - 1
  q.rota = ciclo === 0 ? 0 : 1 + ((ciclo - 1) % rotas)
  const chega = ROTAS[q.rota]?.chega ?? 1
  // A rota inteira até a chegada em T.chega; depois dela, o tempo segue (o rastro desbota).
  q.tv = c < T.chega ? (c / T.chega) * chega : chega + (c - T.chega)
  q.olhar = ciclo === 0 ? entre(c, T.olhar) : 1
  const travado = liso((c - T.chega) / (T.trava - T.chega))
  const escapa = ciclo === 0 ? 1 : liso(c / T.escapa)
  q.voo = Math.min(escapa, 1 - travado)
  q.anel = liso((c - T.alerta) / 0.12) * (1 - liso((c - T.trava + 0.1) / 0.1))
  q.lupa = entre(c, T.lupa)
  q.leva = entre(c, T.leva)
  q.pino = entre(c, T.pino)
  q.preso = c >= T.pino[1]
  q.lupaSai = entre(c, T.lupaSai)
  q.a = linear(c, T.reportA)
  q.b = linear(c, T.reportB)
  q.g = linear(c, T.gherkin)
  q.c = linear(c, T.cypress)
  q.verdes = contar(c, T.verdes, PASSOS)
  q.alvo = 'vaga'
  if (c < T.leva[0]) q.alvo = 'lente'
  if (c < T.chega - 0.1) q.alvo = 'bug'
  return q
}

/** Estado final parado (movimento reduzido): o bug catalogado na vaga, textos completos; lupa fora. */
export function quadroFinal(q: Quadro) {
  return quadroEm(T.fim, 0, q)
}

/** Fase do pulso do anel (0–1, dente de serra) no instante c: uma onda a cada 0,7 s. */
export const fasePulso = (c: number) => (c % 0.7) / 0.7
