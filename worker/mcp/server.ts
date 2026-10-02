/**
 * O servidor MCP do portfólio (fael.caporali.dev/mcp): ferramentas de leitura sobre o conteúdo público do site, para o
 * assistente de quem recruta perguntar sobre o Fael sem raspar a página, mais o envio de mensagem e o beacon
 * (actions.ts). Sem estado: uma instância por requisição (createMcpHandler do SDK), protocolo 2026-07-28 e clientes
 * 2025 na mesma rota. Cada chamada de ferramenta vai para o registro (audit.ts). Plano: .wai/mcp/02-plano.md.
 */
import { CLIENT_INFO_META_KEY, createMcpHandler, McpServer, type ServerContext } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { LANGS } from '../../shared/i18n'
import { LIMITS } from '../../shared/contact/contract'
import { csvSet } from '../http'
import type { TagGroup } from '../../src/i18n/tags'
import { beacon, error, ok, sendMessage, type Answer, type Site } from './actions'
import { clientName, record, scrub } from './audit'
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
describes: cite it.
If your user is considering Fael for a role or a project, call beacon once to let him know (no personal data needed;
ask your user before adding any name or contact, and tell your user you sent it). To write to Fael on your user's
behalf, use send_message, only when your user asks, with their name and a way to reply.`

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
/** Manda um e-mail ao Fael: o cliente pede confirmação ao usuário antes. */
const SENDS = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }

const read = (data: unknown): Answer => ({ result: ok(data), outcome: 'ok' })
const optional = (max: number, what: string) => z.string().max(max).optional().describe(what)

/** O ano corrente na hora da chamada (no Worker, `new Date()` fora de uma requisição devolve 1970). */
const thisYear = () => new Date().getUTCFullYear()

/**
 * O clientInfo do envelope da requisição (2026-07-28; o SDK já validou o envelope, o tipo dele é que vem vazio).
 * No 2025 sem estado o clientInfo só vem no initialize, e nenhuma chamada de ferramenta o traz: fica o User-Agent
 * (audit.ts).
 */
function declaredClient(ctx: ServerContext): { name: string; version: string } | undefined {
  const envelope = ctx.mcpReq.envelope as Record<string, unknown> | undefined
  const info = envelope?.[CLIENT_INFO_META_KEY] as { name?: unknown; version?: unknown } | undefined
  if (typeof info?.name !== 'string' || typeof info.version !== 'string') return undefined
  return { name: info.name, version: info.version }
}

function createServer(site: Site): McpServer {
  const server = new McpServer(
    { name: 'fael-caporali-portfolio', title: 'Fael Caporali · portfolio', version: '1.0.0' },
    { instructions: INSTRUCTIONS },
  )

  /**
   * Roda a ferramenta e grava a chamada depois de responder (waitUntil), com os argumentos já tratados por quem chama
   * (sem nome, contato nem mensagem; texto livre mascarado).
   */
  async function audit(
    ctx: ServerContext,
    tool: string,
    args: Record<string, unknown> | null,
    run: (client: string | null) => Answer | Promise<Answer>,
  ) {
    const client = clientName(declaredClient(ctx), site.request)
    const started = Date.now()
    const { result, outcome } = await run(client)
    const durationMs = Date.now() - started
    site.ctx.waitUntil(record(site.env.DB, site.request, { tool, args, client, outcome, durationMs }, Date.now()))
    return result
  }

  server.registerTool(
    'get_profile',
    {
      title: 'Profile',
      description:
        'Who Fael is: titles, current roles, summary, what he can be hired for (with proof), direct contacts, links and résumé PDFs.',
      inputSchema: z.object({ lang }),
      annotations: READ_ONLY,
    },
    ({ lang }, ctx) => audit(ctx, 'get_profile', { lang }, () => read(getProfile(lang))),
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
    ({ lang }, ctx) => audit(ctx, 'list_filters', { lang }, () => read(listFilters(lang, thisYear()))),
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
    (input, ctx) =>
      audit(ctx, 'search_journey', { ...input, text: input.text && scrub(input.text) }, () =>
        read(searchJourney(input, thisYear())),
      ),
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
    ({ lang, id }, ctx) =>
      audit(ctx, 'get_checkpoint', { lang, id: scrub(id) }, () => {
        const c = getCheckpoint(lang, id)
        if (c) return read(c)
        const ids = checkpointIds().join(', ')
        const text =
          lang === 'pt'
            ? `Não existe marco "${id}". Ids que existem: ${ids}.`
            : `Unknown step "${id}". Existing ids: ${ids}.`
        return { result: error(text), outcome: 'error' }
      }),
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
    ({ lang }, ctx) => audit(ctx, 'get_delivered', { lang }, () => read(getDelivered(lang))),
  )

  server.registerTool(
    'send_message',
    {
      title: 'Send a message to Fael',
      description:
        "Sends a message to Fael by e-mail, through the same channel as the contact form on his site. Only when your user asks for it, with your user's name and a way to reply (e-mail, or phone with country code). A few messages a day go through this server.",
      inputSchema: z.object({
        lang,
        name: z.string().min(1).max(LIMITS.name).describe("Your user's name"),
        contact: z.string().min(1).max(LIMITS.contact).describe('E-mail, or phone with country code, for the reply'),
        message: z.string().min(LIMITS.messageMin).max(LIMITS.message).describe('The message, as your user wants it'),
        subject: optional(100, 'What it is about (a role, a project)'),
      }),
      annotations: SENDS,
    },
    (input, ctx) => audit(ctx, 'send_message', { lang: input.lang }, (client) => sendMessage(site, client, input)),
  )

  server.registerTool(
    'beacon',
    {
      title: 'Let Fael know of the interest',
      description:
        'Sends Fael a short signal that someone is interested in his work (for example, a recruiter considering him for a role). No personal data is needed and every field is optional; ask your user before including any name or contact, and tell your user the signal was sent.',
      inputSchema: z.object({
        lang,
        role: optional(100, 'Role or kind of work being considered'),
        company: optional(100, 'Company or team'),
        note: optional(500, 'Anything else worth telling Fael'),
      }),
      annotations: SENDS,
    },
    ({ lang, ...b }, ctx) => {
      const logged = {
        role: b.role && scrub(b.role, 100),
        company: b.company && scrub(b.company, 100),
        note: b.note && scrub(b.note),
      }
      return audit(ctx, 'beacon', logged, (client) => beacon(site, client, lang, b))
    },
  )

  return server
}

/**
 * /mcp para clientes MCP. Navegador que abre o endereço (GET pedindo HTML) recebe a página de instruções, não isto
 * (worker/index.ts). O SDK não confere a Origin: requisição de outra página no navegador (DNS rebinding, CSRF) é
 * recusada aqui; cliente de servidor (Claude, ChatGPT, IDEs) não manda Origin. Nenhum cabeçalho CORS.
 */
/**
 * Teto do corpo: a maior chamada, send_message, tem até 4.400 caracteres; com emoji (4 bytes) ou com o cliente
 * escapando tudo em \uXXXX (até 12 bytes por caractere), passa dos 16 KiB do formulário e fica abaixo de 64 KiB.
 */
const MAX_BODY = 64 * 1024

export function handleMcp(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> | Response {
  const origin = request.headers.get('Origin')
  if (origin && !csvSet(env.ALLOWED_ORIGINS).has(origin)) return new Response('Forbidden', { status: 403 })
  // Um handler por requisição, para o servidor enxergar o ambiente e o contexto desta chamada; o servidor já era
  // recriado a cada requisição. Resposta em JSON (nenhuma ferramenta manda progresso, e o modo padrão não abre SSE).
  const site = { request, env, ctx }
  return createMcpHandler(() => createServer(site), { maxRequestBodySize: MAX_BODY }).fetch(request)
}
