/**
 * O servidor MCP do portfólio (fael.caporali.dev/mcp): ferramentas de leitura sobre o conteúdo público do site, para o
 * assistente de quem recruta perguntar sobre o Fael sem raspar a página. Sem estado: uma instância por requisição
 * (createMcpHandler do SDK), protocolo 2026-07-28 e clientes 2025 na mesma rota. Plano: .wai/mcp/02-plano.md.
 */
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { LANGS } from '../../shared/i18n'
import { LIMITS } from '../../shared/contact/contract'
import { csvSet } from '../http'
import type { TagGroup } from '../../src/i18n/tags'
import {
  checkpointIds,
  getCheckpoint,
  getDelivered,
  getProfile,
  listFilters,
  MAX_TEXT_WORDS,
  PARTS,
  searchJourney,
  TAG_VALUES,
} from './content'

const INSTRUCTIONS = `Public portfolio of Fael Caporali, software engineer (AI products, full-stack, QA, tech lead).
Everything here is the same content as https://fael.caporali.dev, in English (lang "en") or Brazilian Portuguese ("pt").
Start with get_profile. search_journey filters by stack (tools), concepts, skills, years, part and text; its input
schema lists every accepted stack, concept and skill value, and list_filters adds how many steps cite each one and the
Portuguese labels. get_checkpoint gives the full story of one step. Every answer carries the page URL of what it
describes: cite it.`

const lang = z.enum(LANGS).default('en').describe('Language of the answer: "en" (English) or "pt" (Portuguese).')
/** Lista fechada com os valores que existem: o assistente lê os seletores no próprio tools/list. */
const tagList = (group: TagGroup, what: string) =>
  z
    .array(z.enum(TAG_VALUES[group] as [string, ...string[]]))
    .max(20)
    .optional()
    .describe(`${what}: exact values, most cited first; any of them matches`)
const year = (what: string) => z.number().int().min(1990).max(2100).optional().describe(what)

/** Só leitura e só o que o site já mostra: o cliente pode chamar sem pedir confirmação. */
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

/** A resposta como texto JSON (o que todo cliente lê). */
const ok = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }] })
const error = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true })

/** O ano corrente na hora da chamada (no Worker, `new Date()` fora de uma requisição devolve 1970). */
const thisYear = () => new Date().getUTCFullYear()

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'fael-caporali-portfolio', title: 'Fael Caporali · portfolio', version: '1.0.0' },
    { instructions: INSTRUCTIONS },
  )

  server.registerTool(
    'get_profile',
    {
      title: 'Profile',
      description:
        'Who Fael is: titles, current roles, summary, what he can be hired for (with proof), direct contacts, links and résumé PDFs.',
      inputSchema: z.object({ lang }),
      annotations: READ_ONLY,
    },
    ({ lang }) => ok(getProfile(lang)),
  )

  server.registerTool(
    'list_filters',
    {
      title: 'Journey filters',
      description:
        'Every stack item (tools), concept and skill in the career journey with how many steps cite it and its label in the chosen language, plus the parts and the year range. The values are the ones search_journey accepts.',
      inputSchema: z.object({ lang }),
      annotations: READ_ONLY,
    },
    ({ lang }) => ok(listFilters(lang, thisYear())),
  )

  server.registerTool(
    'search_journey',
    {
      title: 'Search the journey',
      description:
        'Find steps of the career journey by stack, concepts, skills, years, part (prologue = before tech, story = tech career) and free text. Within a group any value matches; across groups all must match. Returns summaries with URLs and the filtered journey page.',
      inputSchema: z.object({
        lang,
        tools: tagList('tools', 'Stack (languages, frameworks, services, tools)'),
        concepts: tagList('concepts', 'Concepts'),
        skills: tagList('skills', 'Skills'),
        from: year('Earliest year'),
        to: year('Latest year'),
        part: z.enum(PARTS).optional().describe('"prologue" (before tech) or "story" (tech career)'),
        text: z
          .string()
          .max(200)
          .optional()
          .describe(
            `Up to ${MAX_TEXT_WORDS} words that must all appear, in English or Portuguese (accents and case ignored). Words of up to 3 letters match whole words only; longer ones also match the start of a word.`,
          ),
      }),
      annotations: READ_ONLY,
    },
    (input) => ok(searchJourney(input, thisYear())),
  )

  server.registerTool(
    'get_checkpoint',
    {
      title: 'Journey step',
      description:
        'One step of the journey in full: period, role, headline, highlights, the whole story and tags. Takes the id from search_journey (or a hero role anchor such as "ai", "qa", "techlead").',
      inputSchema: z.object({ lang, id: z.string().max(80).describe('Step id') }),
      annotations: READ_ONLY,
    },
    ({ lang, id }) => {
      const c = getCheckpoint(lang, id)
      return c ? ok(c) : error(`Unknown step "${id}". Existing ids: ${checkpointIds().join(', ')}.`)
    },
  )

  server.registerTool(
    'get_delivered',
    {
      title: 'Delivered work, stack and FAQ',
      description:
        'What Fael has delivered (context, role and results, each linked to its journey step), his main stack in groups and the frequently asked questions from the home page.',
      inputSchema: z.object({ lang }),
      annotations: READ_ONLY,
    },
    ({ lang }) => ok(getDelivered(lang)),
  )

  return server
}

/**
 * Um handler por isolate; o servidor é recriado a cada requisição. Resposta em JSON (nenhuma ferramenta manda
 * progresso, então o modo padrão do SDK não abre SSE). Corpo com o teto do formulário: argumento de leitura não passa
 * de poucas centenas de bytes.
 */
let handler: ReturnType<typeof createMcpHandler> | undefined

/**
 * /mcp para clientes MCP. Navegador que abre o endereço (GET pedindo HTML) recebe a página de instruções, não isto
 * (worker/index.ts). O SDK não confere a Origin: requisição de outra página no navegador (DNS rebinding, CSRF) é
 * recusada aqui; cliente de servidor (Claude, ChatGPT, IDEs) não manda Origin. Nenhum cabeçalho CORS.
 */
export function handleMcp(request: Request, env: Env): Promise<Response> | Response {
  const origin = request.headers.get('Origin')
  if (origin && !csvSet(env.ALLOWED_ORIGINS).has(origin)) return new Response('Forbidden', { status: 403 })
  handler ??= createMcpHandler(createServer, { maxRequestBodySize: LIMITS.body })
  return handler.fetch(request)
}
