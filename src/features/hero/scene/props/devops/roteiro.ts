/**
 * Roteiro da vida devops (FICHA-PRODUCAO.md, FECHAMENTO, "Roteiro"; D12–D14). c = s desde o começo do ciclo; o ciclo 0
 * começa na MONTAGEM da vida (auge do furacão: o busto se reconstrói em 1 s; pausa de 5 s, a saída começa em 6,0).
 * Os textos do fundo vêm ADIANTADOS às batidas (lição do QA). Ritmo da pausa de 5 s (.wai/3d/estudio/RITMO.md):
 * O tempo a mais sai do FIM, nunca do começo: até as decisões, os tempos homologados (pausa de 3,5 s); depois,
 * um pouco mais devagar:
 *   0,1–1,4   análise (D14): na planta, o MONÓLITO (ícone do Lightsail) se desenha, é riscado e decomposto; o ADR;
 *   1,4–2,0   sai do papel (D12): os traços SOBEM da folha e, no fundo, viram o diagrama (grupos, ícones, setas);
 *   2,0–2,85  DECISÕES (clímax, D18): os pares de tradeoff crescem lado a lado, ✓, corte e encaixe (SQS ✓, RabbitMQ
 *             cortado; Fargate ✓, Swarm cortado); as setas ganham contrato; RESPIRO de 0,3 s com tudo pousado;
 *   3,15–5,25 entrega e produção: a sequência homologada inteira × 1,05 (CloudFormation, pipeline, blue → green,
 *             tráfego, alarme, tasks, alarme normal); o estado final completo fica parado de 5,25 até a saída.
 * Os offsets internos dos blocos escalam pelo fator do seu evento (ESCALA sobre o homologado).
 * Com a pausa segurada o ciclo recomeça com o fundo limpo (Arquiteto.tsx). Só números: o estado sai num objeto
 * reaproveitado.
 */
import { GRUPO } from './revela'

/**
 * Fator de cada evento sobre o tempo homologado (RITMO.md, regra 5): da planta às decisões, 1 (os tempos e os
 * offsets homologados); do CloudFormation ao normal, 1,05 (um pouco mais devagar, nunca mais rápido).
 */
export const ESCALA = {
  planta: 1,
  risca: 1,
  decompoe: 1,
  sobe: 1,
  decisoes: 1,
  entrega: 1.05,
  producao: 1.05,
} as const
const K = ESCALA
const SOBE = 1.4
const DECIDE = 2.0
/** Respiro de 0,3 s depois do último pouso das decisões (2,85). */
const CFN = DECIDE + 0.85 * K.decisoes + 0.3
/** Instante homologado da entrega e da produção (CFN em 2,35) levado ao CFN novo, × 1,05. */
const ent = (t: number) => CFN + (t - 2.35) * K.entrega

export const T = {
  /** Planta (folha.ts). */
  monolito: [0.1, 0.6],
  risca: [0.75, 0.95],
  decompoe: [0.95, 1.4],
  /** Traços sobem da folha ao fundo (tracos.ts). */
  sobe: [SOBE, 2.0],
  /** Fundo (instantes de revelação pintados no canvas; diagrama.ts e cartoes.ts). */
  adr: 0.1 + 0.05 * K.planta,
  grupos: SOBE,
  icones: [SOBE + 0.1 * K.sobe, SOBE + 0.55 * K.sobe],
  apoio: [SOBE + 0.35 * K.sobe, SOBE + 0.75 * K.sobe],
  contratos: DECIDE + 0.1 * K.decisoes,
  openapi: SOBE + 0.15 * K.sobe,
  cfn: CFN,
  entrega: ent(2.55),
  /** Decisões (clímax): os pares em movimento (decisoes.ts, JANELA) pousam até 2,85; respiro até o CFN. */
  decisoes: [DECIDE, DECIDE + 0.85 * K.decisoes],
  /** Estado B do grupo `decisao` (alternativa esmaecida e riscada), antes do primeiro pouso (decisoes.ts, D18). */
  decide: [DECIDE + 0.2 * K.decisoes, DECIDE + 0.4 * K.decisoes],
  blueGreen: [ent(3.0), ent(3.4)],
  deploy: [ent(3.35), ent(3.5)],
  trafego: [ent(3.45), ent(3.7)],
  alarme: [ent(3.75), ent(3.85)],
  tasks: ent(3.95),
  normal: [ent(4.2), ent(4.35)],
  /** Fim do ciclo (início da saída do carrossel: 1 s de reconstrução + 5 s de pausa). */
  fim: 6,
} as const

const liso = (x: number) => {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}
const entre = (c: number, [a, b]: readonly [number, number]) => liso((c - a) / (b - a))

export interface Quadro {
  /** Instante do desenho (revela.ts: uT) e o relógio do tráfego. */
  t: number
  /** Estado de cada grupo (0 = A, 1 = B). */
  est: Float32Array
  fluxo: number
  /** Planta: monólito desenhado (0–1), riscado (0–1), decomposição (0–1). */
  monolito: number
  risca: number
  decompoe: number
  /** Subida dos traços (0–1). */
  sobe: number
  /** Peso do olhar e o alvo: planta, fundo (o diagrama se formando) ou o alarme. */
  olhar: number
  alvo: 'folha' | 'fundo' | 'alarme'
}

export const criarQuadro = (): Quadro => ({
  t: 0,
  est: new Float32Array(8),
  fluxo: 0,
  monolito: 0,
  risca: 0,
  decompoe: 0,
  sobe: 0,
  olhar: 0,
  alvo: 'folha',
})

/** Estado no instante c do ciclo. */
export function quadroEm(c: number, q: Quadro) {
  q.t = c
  q.est.fill(0)
  q.est[GRUPO.decisao] = entre(c, T.decide)
  q.est[GRUPO.blueGreen] = entre(c, T.blueGreen)
  q.est[GRUPO.deploy] = entre(c, T.deploy)
  q.est[GRUPO.alarme] = entre(c, T.alarme) * (1 - entre(c, T.normal))
  // A decomposição esmaece no papel enquanto os traços sobem.
  q.est[GRUPO.monolito] = entre(c, T.sobe)
  q.fluxo = entre(c, T.trafego)
  q.monolito = entre(c, T.monolito)
  q.risca = entre(c, T.risca)
  q.decompoe = entre(c, T.decompoe)
  q.sobe = Math.min(1, Math.max(0, (c - T.sobe[0]) / (T.sobe[1] - T.sobe[0])))
  q.olhar = entre(c, [T.monolito[0] + 0.4 * K.planta, T.risca[0] + 0.15 * K.risca])
  q.alvo = 'folha'
  if (c >= T.sobe[0] + 0.2 * K.sobe) q.alvo = 'fundo'
  if (c >= T.alarme[0] - 0.1 * K.producao && c < T.normal[1]) q.alvo = 'alarme'
  return q
}

/** Estado final parado (movimento reduzido): tudo desenhado, green no ar, alarme normal, tráfego parado. */
export function quadroFinal(q: Quadro) {
  quadroEm(T.fim, q)
  q.olhar = 0
  return q
}
