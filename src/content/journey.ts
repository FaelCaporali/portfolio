/**
 * Vidas do herói: "Today I am a [slot]" / "Yesterday I was a [slot]".
 * Decisão do Fael (23/09): vidas em ordem cronológica (é a ordem do indicador); o carrossel abre em OPENING e segue
 * embaralhado (model/lineup.ts). São 9 desde 27/09: o Tech Consultant saiu ("Tech consultant... serão 9 cenas").
 * Fatos e comprovação moram na página da trajetória, não aqui.
 */
type ExprKey = 'mouthSmile' | 'browInnerUp' | 'browOuterUp' | 'browDown'

export type PropId = 'ai' | 'qa' | 'ledger' | 'fullstack' | 'rocket' | 'techlead' | 'sailor' | 'uber' | 'architect'

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
  accent: string
  /** Adereço da vida (blockout em src/features/hero/scene/props/). */
  prop: PropId
  expr: Expression
  /** Pausa própria da vida no carrossel (s); ausente = a padrão (model/carousel.ts TIMING). */
  hold?: number
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
    expr: { mouthSmile: 0.8, browOuterUp: 0.3 },
  },
  {
    id: 'vela',
    past: true,
    prop: 'sailor',
    slot: 'Sailing Instructor',
    track: 'antes',
    accent: '#2ea8ff',
    expr: { mouthSmile: 1 },
  },
  {
    id: 'uber',
    past: true,
    prop: 'uber',
    slot: 'Uber Driver',
    track: 'antes',
    accent: '#8a8a8a',
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
    prop: 'qa',
    slot: 'QA Analyst',
    track: 'tech',
    accent: '#e0324b',
    fact: 'Estruturou a área de qualidade da Brickup. Feature flags e monitoramento levaram os defeitos abertos de cerca de 300 para menos de 100.',
    where: 'Brickup · desde 2023 · CTFL ISTQB',
    expr: { browDown: 0.5 },
    // A narrativa do adereço (alerta, lupa, bug report, caso de teste, caixa) pede 3,5 s: máximo do Fael (Q17).
    hold: 3.5,
  },
  {
    id: 'devops',
    prop: 'architect',
    // Decisão do Fael (27/09, REQUISITOS D1): "Solutions Architect", sem AWS no título (a AWS está nos ícones da cena).
    slot: 'Solutions Architect',
    track: 'tech',
    accent: '#ff6ec7',
    expr: { browDown: 0.2, mouthSmile: 0.2 },
    // Da planta à produção (monólito, decomposição, diagrama, decisões, entrega, produção): 5 s (regra do Fael:
    // máximo global; RITMO.md).
    hold: 5,
  },
  {
    id: 'techlead',
    prop: 'techlead',
    slot: 'Tech Lead',
    track: 'tech',
    accent: '#b388ff',
    fact: 'Desenhou e implantou a arquitetura AWS da Beamble e a migração do legado para microsserviços, com logística integrada a Uber, UPS e DHL.',
    where: 'La Fabrique Flottante · 2025',
    // Escuta atenta (REQUISITOS T1): sobrancelhas soltas e sorriso leve, só com chaves que já existem.
    expr: { browInnerUp: 0.25, mouthSmile: 0.25 },
    // Da escuta ao burndown, com a destrava (6 batidas: props/techlead/roteiro.ts): 5 s (regra do Fael: máximo
    // global; RITMO.md).
    hold: 5,
  },
  {
    id: 'ai',
    prop: 'ai',
    // Decisão do Fael (27/09, REQUISITOS I1): "AI Product Engineer", o termo do mercado para quem faz produto com LLM.
    slot: 'AI Product Engineer',
    track: 'tech',
    accent: '#00e5ff',
    fact: 'Plataforma multi-tenant de agentes de IA para atendimento via WhatsApp em produção: RAG, avaliação automatizada de agentes e cobrança por consumo de tokens.',
    where: 'Marketing para Cartórios – AI · 2026',
    // Foco sereno (FICHA-PRODUCAO 2.5): sobrancelhas levemente baixas e sorriso contido, com chaves que já existem.
    expr: { browDown: 0.18, mouthSmile: 0.22 },
    // A história em 5 cenas (props/ai/roteiro.ts) pede 5 s, o máximo global do Fael (REQUISITOS I10).
    hold: 5,
  },
]
