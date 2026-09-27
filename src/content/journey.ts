/**
 * Vidas do herói: "Today I am a [slot]" / "Yesterday I was a [slot]".
 * Decisão do Fael (23/09): 10 vidas em ordem cronológica (é a ordem do indicador); o carrossel abre em OPENING e segue
 * embaralhado (model/lineup.ts). Fatos e comprovação moram na página da trajetória, não aqui.
 */
export type ExprKey = 'mouthSmile' | 'browInnerUp' | 'browOuterUp' | 'browDown'

export type PropId =
  'neural' | 'magnifier' | 'ledger' | 'fullstack' | 'rocket' | 'headset' | 'sailor' | 'compass' | 'uber' | 'infinity'

export type Expression = Partial<Record<ExprKey, number>>

export interface Stage {
  id: string
  slot: string
  track: 'tech' | 'antes'
  /** Vida que ficou no passado: o herói diz "Yesterday I was" em vez de "Today I am" (decisão do Fael, 23/09). */
  past?: true
  /** Uma linha de fato, com fonte. */
  fact?: string
  /** Onde e quando, como no CV/Lattes. */
  where?: string
  /** Pergunta da entrevista que ainda falta responder. */
  pending?: string
  accent: string
  /** Adereço da vida (blockout em src/features/hero/scene/props/). */
  prop: PropId
  expr: Expression
}

/** Vida em que o carrossel abre: a de IA, que chama atenção (decisão do Fael, 23/09). */
export const OPENING = 'ai'

/** Em ordem cronológica. */
export const stages: Stage[] = [
  {
    id: 'financeiro',
    past: true,
    prop: 'ledger',
    slot: 'Financial Assistant',
    track: 'antes',
    accent: '#c9a227',
    fact: 'Coordenador financeiro: planejamento com a diretoria e relatórios gerenciais automatizados em VBA.',
    where: 'Immersus Ensino de Idiomas · 2013–2017',
    expr: { browDown: 0.4, mouthSmile: 0.15 },
  },
  {
    id: 'empreendedor',
    prop: 'rocket',
    slot: 'Entrepreneur',
    track: 'antes',
    accent: '#ff7a1a',
    fact: 'Negócios próprios: SUP LagoaSanta, confeitaria, hostel e escola de vela.',
    where: '2009–2022',
    pending: 'A2 — ordem, anos e qual negócio vira a imagem',
    expr: { mouthSmile: 0.8, browOuterUp: 0.3 },
  },
  {
    id: 'vela',
    past: true,
    prop: 'sailor',
    slot: 'Sailing Instructor',
    track: 'antes',
    accent: '#2ea8ff',
    pending: 'A3 — onde, que barco, escola própria ou não',
    expr: { mouthSmile: 1 },
  },
  {
    id: 'uber',
    past: true,
    prop: 'uber',
    slot: 'Uber Driver',
    track: 'antes',
    accent: '#8a8a8a',
    pending: 'A4 — período e tom',
    expr: { browInnerUp: 0.8 },
  },
  {
    id: 'fullstack',
    prop: 'fullstack',
    slot: 'FullStack Dev',
    track: 'tech',
    accent: '#3ddc84',
    fact: 'Consolidou cinco MVPs de uma plataforma de trade-in em um monorepo React/TypeScript com PostgreSQL, multi-tenancy por RLS e Terraform.',
    where: 'BID Tecnologia · 2025–2026',
    expr: { mouthSmile: 0.4 },
  },
  {
    id: 'qa',
    prop: 'magnifier',
    slot: 'QA Analyst',
    track: 'tech',
    accent: '#e0324b',
    fact: 'Estruturou a área de qualidade da Brickup. Feature flags e monitoramento levaram os defeitos abertos de cerca de 300 para menos de 100.',
    where: 'Brickup · desde 2023 · CTFL ISTQB',
    expr: { browDown: 0.5 },
  },
  {
    id: 'devops',
    prop: 'infinity',
    slot: 'DevOps Engineer',
    track: 'tech',
    accent: '#ff6ec7',
    expr: { browDown: 0.2, mouthSmile: 0.2 },
  },
  {
    id: 'techlead',
    prop: 'headset',
    slot: 'Tech Lead',
    track: 'tech',
    accent: '#b388ff',
    fact: 'Desenhou e implantou a arquitetura AWS da Beamble e a migração do legado para microsserviços, com logística integrada a Uber, UPS e DHL.',
    where: 'La Fabrique Flottante · 2025',
    expr: { mouthSmile: 0.5 },
  },
  {
    id: 'ai',
    prop: 'neural',
    slot: 'AI Software Developer',
    track: 'tech',
    accent: '#00e5ff',
    fact: 'Plataforma multi-tenant de agentes de IA para atendimento via WhatsApp em produção: RAG, avaliação automatizada de agentes e cobrança por consumo de tokens.',
    where: 'Marketing para Cartórios – AI · 2026',
    expr: { mouthSmile: 0.3 },
  },
  {
    id: 'consultant',
    prop: 'compass',
    slot: 'Tech Consultant',
    track: 'tech',
    accent: '#ffd166',
    fact: 'Assumiu o legado de uma plataforma de trade-in e definiu stack, precificação e roadmap com fundadores de clientes.',
    where: 'BID Tecnologia · Marketing para Cartórios – AI · 2025–2026',
    pending: 'revisão do slot',
    expr: { browDown: 0.3, mouthSmile: 0.2 },
  },
]
