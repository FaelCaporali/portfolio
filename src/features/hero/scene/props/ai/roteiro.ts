/**
 * Roteiro da vida ai, "O que ele decide de dia protege o cliente à noite" (FICHA-PRODUCAO §4.2; REQUISITOS I8, I10,
 * I11). c = s desde a MONTAGEM da vida (auge do furacão: o busto se reconstrói em 1 s; pausa de 5 s, a saída começa
 * em 6). As 5 CENAS (em s da pausa; a primeira começa em c = INICIO) são o ÚNICO lugar dos tempos; os textos aparecem
 * ANTES da batida deles e ficam à vista.
 *   1 construir, 18:40: o agente de código terminou o harness; o cursor DELE troca 0.6 → 0.8 e clica Approve;
 *   2 deploy: o fio sai da IDE, passa por trás da cabeça e chega à mesa; o robô se monta e a tela liga;
 *   3 o produto, 02:14: a cliente escreve; sob o balão o trace aparece span a span; o robô responde com a fonte;
 *   4 o conflito: confidence 0.71 bate no guardrail(0.8), um fio liga o 0.8 da IDE ao escudo; o caso cruza até o n8n
 *     (nós acendem em ordem) e o app do operador; ele edita e aceita; "Refund approved ✓"; o robô comemora;
 *   5 de volta a ele, 09:02: o fio sobe a borda esquerda até a IDE; o caso vira teste, evals sobem, nasce o prompt v2.
 * Só números: o estado sai num objeto reaproveitado (nada alocado por quadro).
 */

/**
 * Início de cada cena em c (s desde a montagem; a pausa de 5 s vai de 1 a 6). Ritmo (.wai/3d/estudio/RITMO.md): o
 * gancho começa com o busto se formando, um evento visível a cada ≥ 0,25 s (≥ 0,4 s depois de uma linha a ler), o
 * conflito é o clímax (~1,7 s, com 0,3 s de respiro antes do "Refund approved ✓") e o estado final fica 0,55 s parado.
 */
const C1 = 0.3
const C2 = 1.85
const C3 = 2.3
const C4 = 3.5
const C5 = 5.2

/** Grupos de estado da revelação (0–7; revela.ts): cada um com o seu uEst (0 = estado A, 1 = B). */
export const GRUPO = {
  fixo: 0,
  edicao: 1,
  cursorIde: 2,
  aprova: 3,
  cursorOp: 4,
  aceita: 5,
  volta: 6,
} as const

export const T = {
  /** Cena 1 (gancho, com o busto se formando): a IDE às 18:40 com o harness; o agente; o cursor dele e o Approve. */
  ide: C1,
  codigo: [C1, C1 + 0.2],
  agente: C1 + 0.4,
  mcp: [C1 + 0.4, C1 + 0.55],
  testes: C1 + 0.4,
  faixa: C1 + 0.4,
  cursor: C1 + 0.8,
  edicao: [C1 + 1.05, C1 + 1.12],
  clique: [C1 + 1.3, C1 + 1.34],
  aprova: [C1 + 1.3, C1 + 1.38],
  /** Cena 2: o fio vai da IDE à mesa e o robô se monta (dos `explodido_m` para o lugar). */
  montagem: [C2, C2 + 0.4],
  /** Cena 3: a tela liga e a cliente escreve (02:14); o trace span a span; a resposta com a fonte; o valor. */
  liga: C3,
  chat: C3,
  cliente: C3,
  spans: [C3 + 0.3, C3 + 0.35, C3 + 0.4, C3 + 0.45, C3 + 0.5, C3 + 0.55],
  escolha: C3 + 0.5,
  resposta: C3 + 0.8,
  valor: C3 + 1.2,
  /** Cena 4 (clímax): confidence no escudo, o elo do 0.8, o n8n e o operador, Edit, Accept, o respiro, a aprovação. */
  confianca: C4 + 0.25,
  escudo: C4 + 0.25,
  elo: [C4 + 0.5, C4 + 0.65],
  n8n: C4 + 0.75,
  nos: [C4 + 0.75, C4 + 0.8, C4 + 0.85, C4 + 0.9, C4 + 0.95],
  operador: C4 + 0.75,
  cursorOp: C4 + 0.75,
  editaOp: [C4 + 1.15, C4 + 1.2],
  cliqueOp: [C4 + 1.4, C4 + 1.44],
  aceita: [C4 + 1.4, C4 + 1.48],
  aprovado: C5,
  /** Cena 5: o fio volta à IDE; 09:02, o caso vira teste, evals, prompt v2 (um evento só). */
  volta: [C5 + 0.25, C5 + 0.29],
  caso: C5 + 0.25,
  evals: C5 + 0.25,
  /** O fio (o 8) na ordem da história: [instante, trecho] — IDE, mesa, chat, n8n, IDE. */
  fio: {
    sai: C2,
    mesa: C2 + 0.4,
    chat: C3 + 0.05,
    cruza: [C4 + 0.55, C4 + 0.75],
    volta: [C5, C5 + 0.22],
  },
  /** Tudo legível no fim (o 8 completo): estado final parado de 5,45 a 6. */
  legivel: C5 + 0.25,
  /** Fim do ciclo (início da saída do carrossel: montagem 1 s + pausa 5 s). */
  fim: 6,
} as const

const liso = (x: number) => {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}
const entre = (c: number, [a, b]: readonly [number, number]) => liso((c - a) / (b - a))
const degrau = (c: number, t: number) => liso((c - t) / 0.15)

/** Para onde os olhos vão (pontos do fundo registrados pelos blocos e a mesa). */
export type Alvo = 'ide' | 'limiar' | 'robo' | 'chat' | 'escudo' | 'humano'
/** Estados do rosto do robô (tela em canvas): a mesma linguagem dos avatares do fundo. */
export type Rosto = 'desligado' | 'escuta' | 'pensa' | 'fala' | 'pergunta' | 'comemora'
/** Para onde o robô vira a cabeça: câmera (neutro), a cena ativa (chat, humano) ou o Fael (handoff). */
export type Mira = 'camera' | 'chat' | 'humano' | 'fael'
/** Painéis do fundo (as três janelas da história). */
export type Cena = 'ide' | 'chat' | 'humano'

export interface Quadro {
  /** Instante do desenho (revela.ts: uT). */
  t: number
  est: Float32Array
  /** Foco de cada janela: 1 = cena ativa; ~0,35 = passada (silhueta). */
  foco: Record<Cena, number>
  /** O fio de 0.8 ao escudo (0 → 1 desenhado) e o brilho dele. */
  elo: number
  eloBrilho: number
  olhar: number
  alvo: Alvo
  /** Montagem do robô (0 explodido → 1 montado). */
  montagem: number
  rosto: Rosto
  mira: Mira
}

export const criarQuadro = (): Quadro => ({
  t: 0,
  est: new Float32Array(8),
  foco: { ide: 1, chat: 1, humano: 1 },
  elo: 0,
  eloBrilho: 0,
  olhar: 0,
  alvo: 'ide',
  montagem: 0,
  rosto: 'desligado',
  mira: 'camera',
})

/** Silhueta das cenas passadas. */
const PASSADA = 0.35
const foco = (c: number, ativa: readonly [number, number][]) => {
  let f = PASSADA
  for (const [a, b] of ativa) f = Math.max(f, Math.min(degrau(c, a - 0.1), 1 - degrau(c, b)) * (1 - PASSADA) + PASSADA)
  return Math.max(f, PASSADA + (1 - PASSADA) * degrau(c, T.legivel))
}

function olharEm(c: number): Alvo {
  if (c >= C5) return 'ide'
  if (c >= T.n8n) return 'humano'
  if (c >= T.confianca) return 'escudo'
  if (c >= C3) return 'chat'
  if (c >= C2) return 'robo'
  if (c >= T.cursor) return 'limiar'
  return 'ide'
}

function rostoEm(c: number): Rosto {
  if (c >= T.aprovado) return 'comemora'
  if (c >= T.escudo) return 'pergunta'
  if (c >= T.resposta) return 'fala'
  if (c >= T.spans[0]) return 'pensa'
  if (c >= T.liga) return 'escuta'
  return 'desligado'
}

function miraEm(c: number): Mira {
  if (c >= T.aprovado) return 'camera'
  if (c >= T.n8n) return 'humano'
  if (c >= T.escudo) return 'fael'
  if (c >= T.chat) return 'chat'
  return 'camera'
}

/** Estado no instante c do ciclo. */
export function quadroEm(c: number, q: Quadro) {
  q.t = c
  q.est.fill(0)
  q.est[GRUPO.edicao] = entre(c, T.edicao)
  q.est[GRUPO.cursorIde] = entre(c, T.clique)
  q.est[GRUPO.aprova] = entre(c, T.aprova)
  q.est[GRUPO.cursorOp] = entre(c, T.cliqueOp)
  q.est[GRUPO.aceita] = entre(c, T.aceita)
  q.est[GRUPO.volta] = entre(c, T.volta)
  q.foco.ide = foco(c, [
    [0, C2],
    [C5, 99],
  ])
  q.foco.chat = foco(c, [
    [T.chat, T.n8n],
    [T.aprovado, C5 + 0.25],
  ])
  q.foco.humano = foco(c, [[T.n8n, C5]])
  q.elo = entre(c, T.elo)
  q.eloBrilho = entre(c, T.elo) * (1 - entre(c, [T.elo[1] + 0.2, T.elo[1] + 0.6]))
  q.montagem = entre(c, T.montagem)
  q.olhar = entre(c, [C1, C1 + 0.4])
  q.alvo = olharEm(c)
  q.rosto = rostoEm(c)
  q.mira = miraEm(c)
  return q
}

/** Estado final parado (movimento reduzido): o 8 completo, as decisões aprovadas, olhar livre. */
export function quadroFinal(q: Quadro) {
  quadroEm(T.fim, q)
  q.olhar = 0
  q.eloBrilho = 0
  return q
}
