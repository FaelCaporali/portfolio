/**
 * As páginas de oferta (/services/…, SERVICE_PAGES em shared/i18n.ts): uma por oferta da home, com o texto e as provas
 * que a home já mostra (overview.json) e os resultados do que foi entregue nos mesmos marcos (experience); as
 * ferramentas desses marcos saem de service-tools.ts (journey.json, só no build). O que é só desta página: a descrição
 * e as palavras-chave das metas, resumidas do texto da oferta e dos fatos de contratação
 * (.wai/seo-geo/05-palavras-contratacao.md). Leve de propósito: as metas de todas as páginas o importam.
 */
import { SERVICE_PAGES, type Lang, type ServicePage } from '../../shared/i18n'
import { overview } from './overview'

type Text = Record<Lang, string>

interface ServiceMeta {
  /** O título da página: a consulta principal do mapa (05-palavras) e o nome, ≤ 60 caracteres. */
  title: Text
  description: Text
  keywords: Text
}

/** Na ordem das ofertas e de SERVICE_PAGES. */
const META: readonly ServiceMeta[] = [
  {
    title: {
      en: 'AI Agent Development & AI Consulting · Fael Caporali',
      pt: 'Agentes de IA e consultoria de IA em BH · Fael Caporali',
    },
    description: {
      en: 'AI agents from idea to production: agents with human review, WhatsApp agents, RAG, agent evaluation and usage-based billing. Remote or in Belo Horizonte.',
      pt: 'Agentes de IA da ideia à produção: agentes com revisão humana, agentes no WhatsApp, RAG, avaliação de agentes e cobrança por consumo. Remoto ou em BH.',
    },
    keywords: {
      en: 'AI agent development, AI agents, WhatsApp AI agent, RAG, LangChain, LangGraph, n8n, agent evaluation, AI product engineer, AI consulting, Belo Horizonte, remote',
      pt: 'desenvolvimento de agentes de IA, agentes de IA, agente de IA no WhatsApp, RAG, LangChain, LangGraph, n8n, avaliação de agentes, consultoria de IA, Belo Horizonte, remoto',
    },
  },
  {
    title: {
      en: 'From MVP to Scalable Product, Lovable MVPs · Fael Caporali',
      pt: 'Do MVP ao produto que escala, MVP no Lovable · Fael Caporali',
    },
    description: {
      en: 'MVPs, Lovable ones included, turned into software a team can maintain and grow: monorepo, multi-tenancy, CI/CD, infrastructure as code and cloud.',
      pt: 'MVPs, inclusive os feitos no Lovable, transformados em software que o time mantém e faz crescer: monorepo, multi-tenancy, CI/CD e infraestrutura como código.',
    },
    keywords: {
      en: 'MVP to product, scale an MVP, Lovable MVP, monorepo, multi-tenant, CI/CD, infrastructure as code, Terraform, AWS, GCP, software architecture, full-stack developer',
      pt: 'transformar MVP em produto, escalar MVP, MVP no Lovable, monorepo, multi-tenant, CI/CD, infraestrutura como código, Terraform, AWS, GCP, arquitetura de software, desenvolvedor full-stack',
    },
  },
  {
    title: {
      en: 'QA and Test Automation Consulting · Fael Caporali',
      pt: 'QA e automação de testes · Fael Caporali',
    },
    description: {
      en: 'Test strategy and automation, feature flags and observability, and a QA function that stays with the team. E2E testing with Cypress and Cucumber.',
      pt: 'Estratégia e automação de testes, feature flags e observabilidade, e uma área de qualidade que fica com o time. Testes E2E com Cypress e Cucumber.',
    },
    keywords: {
      en: 'QA, test automation, E2E testing, Cypress, Cucumber, Gherkin, feature flags, observability, Datadog, quality assurance consulting',
      pt: 'QA, automação de testes, testes E2E, Cypress, Cucumber, Gherkin, feature flags, observabilidade, Datadog, consultoria de qualidade de software',
    },
  },
  {
    title: {
      en: 'Remote Tech Lead and Team Training · Fael Caporali',
      pt: 'Tech lead remoto e formação de times · Fael Caporali',
    },
    description: {
      en: 'A tech lead from the problem to the delivery: requirements, cadence and deadlines, hiring and training until the team runs on its own. Portuguese or English.',
      pt: 'Tech lead do problema à entrega: requisitos, cadência e prazos, contratação e formação de pessoas até o time andar sozinho. Em português ou inglês.',
    },
    keywords: {
      en: 'tech lead, technical leadership, team training, mentoring, hiring developers, delivery cadence, remote tech lead',
      pt: 'tech lead, liderança técnica, gestão de time de desenvolvimento, formação de times, mentoria, contratação de desenvolvedores, cadência de entrega, tech lead remoto',
    },
  },
]

export interface Service {
  path: ServicePage
  index: number
  offer: (typeof overview.offers.items)[number]
  meta: ServiceMeta
  /** O que foi entregue nos marcos das provas (overview.experience), sem empresa nem período. */
  delivered: typeof overview.experience.items
  /** Os marcos da trajetória que provam a oferta (journey.json). */
  journeyIds: string[]
}

export const services: readonly Service[] = SERVICE_PAGES.map((path, index) => {
  const offer = overview.offers.items[index]
  const meta = META[index]
  if (!offer || !meta) throw new Error(`services.ts: falta a oferta ou as metas de ${path}`)
  const journeyIds = [...new Set(offer.proof.map((p) => p.journeyId))]
  return {
    path,
    index,
    offer,
    meta,
    delivered: overview.experience.items.filter((e) => journeyIds.includes(e.journeyId)),
    journeyIds,
  }
})

/** A página de uma oferta pelo endereço (sem idioma). */
export const serviceByPath = (path: string) => services.find((s) => s.path === path)
