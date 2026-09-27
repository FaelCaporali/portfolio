/**
 * Roteiro da vida devops (FICHA-PRODUCAO.md, FECHAMENTO, "Roteiro"; D12–D14). c = s desde o começo do ciclo; o ciclo 0
 * começa na MONTAGEM da vida (auge do furacão: o busto se reconstrói em 1 s; pausa de 3,5 s, a saída começa em 4,5).
 * Os textos do fundo vêm ADIANTADOS às batidas (lição do QA):
 *   0,0–0,7  análise (D14): na planta, o MONÓLITO (ícone do Lightsail) se desenha; o ADR já se escreve no fundo;
 *   0,7–1,4  análise: o monólito é riscado e decomposto em serviços (traço técnico);
 *   1,4–2,0  sai do papel (D12): os traços SOBEM da folha e, no fundo, viram o diagrama (grupos, ícones, setas);
 *   2,0–2,8  decisões e contratos: os pares de tradeoff se marcam (SQS ✓, RabbitMQ riscado; Fargate ✓, Swarm
 *            riscado), as setas ganham contrato; o cartão OpenAPI já está escrito;
 *   2,8–3,6  entrega: CloudFormation e pipeline se escrevem; no ALB o tráfego passa do target group blue ao green;
 *   3,6–4,5  produção: tráfego corre pelas setas, o alarme do CloudWatch acende, o ECS ganha tasks (auto scale) e o
 *            alarme volta ao normal; estado final completo.
 * Com a pausa segurada o ciclo recomeça com o fundo limpo (Arquiteto.tsx). Só números: o estado sai num objeto
 * reaproveitado.
 */
import { GRUPO } from './revela'

export const T = {
  /** Planta (folha.ts). */
  monolito: [0.1, 0.6],
  risca: [0.75, 0.95],
  decompoe: [0.95, 1.4],
  /** Traços sobem da folha ao fundo (tracos.ts). */
  sobe: [1.4, 2.0],
  /** Fundo (instantes de revelação pintados no canvas; diagrama.ts e cartoes.ts). */
  adr: 0.15,
  grupos: 1.4,
  icones: [1.5, 1.95],
  apoio: [1.75, 2.15],
  contratos: 2.1,
  openapi: 1.55,
  cfn: 2.35,
  entrega: 2.55,
  /** Estado B do grupo `decisao` (alternativa esmaecida e riscada), antes do primeiro pouso (decisoes.ts, D18). */
  decide: [2.2, 2.4],
  blueGreen: [3.0, 3.4],
  deploy: [3.35, 3.5],
  trafego: [3.45, 3.7],
  alarme: [3.75, 3.85],
  tasks: 3.95,
  normal: [4.2, 4.35],
  /** Fim do ciclo (início da saída do carrossel). */
  fim: 4.5,
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
  q.olhar = entre(c, [0.5, 0.9])
  q.alvo = 'folha'
  if (c >= T.sobe[0] + 0.2) q.alvo = 'fundo'
  if (c >= T.alarme[0] - 0.1 && c < T.normal[1]) q.alvo = 'alarme'
  return q
}

/** Estado final parado (movimento reduzido): tudo desenhado, green no ar, alarme normal, tráfego parado. */
export function quadroFinal(q: Quadro) {
  quadroEm(T.fim, q)
  q.olhar = 0
  return q
}
