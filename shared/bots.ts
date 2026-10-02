/**
 * Os robôs de busca e de IA nomeados (03-pesquisa-geo.md, docs de cada provedor), por papel. O robots.txt dá um grupo
 * a cada um (src/routes/robots.ts); o registro de visitas do Worker (worker/visits.ts) separa pessoa, robô de busca,
 * assistente buscando a página para alguém e robô de treino pelo User-Agent.
 */
const SEARCH = [
  // Buscadores
  'Googlebot',
  'Bingbot',
  'DuckDuckBot',
  'Applebot',
  'YandexBot',
  // Busca dos assistentes
  'OAI-SearchBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'DuckAssistBot',
] as const
/** Buscam a página na hora, a pedido de quem conversa com o assistente. */
const ASSISTANT = ['ChatGPT-User', 'Claude-User', 'Perplexity-User', 'meta-externalfetcher', 'MistralAI-User'] as const
/** Treino e uso em IA generativa. Google-Extended e Applebot-Extended são só nomes no robots.txt, não User-Agent. */
const TRAINING = [
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'meta-externalagent',
  'CCBot',
  'Amazonbot',
] as const

export const NAMED_BOTS = [...SEARCH, ...ASSISTANT, ...TRAINING] as const

/** Quem pediu a página: uma pessoa, um robô nomeado (pelo papel) ou outro robô que se declara. */
export type Client = 'human' | 'search' | 'assistant' | 'training' | 'bot'

const ROLES: readonly [Client, readonly string[]][] = [
  ['search', SEARCH],
  ['assistant', ASSISTANT],
  ['training', TRAINING],
]

/** Robô que não está na lista, mas se declara, e as ferramentas de linha de comando. */
const OTHER_BOT = /bot\b|crawl|spider|slurp|fetch|scrape|headless|curl\/|wget\/|python-|go-http|java\/|httpclient/i

/** O papel e o nome do robô pelo User-Agent; nome vazio para pessoa e para robô sem nome na lista. */
export function classifyAgent(userAgent: string | null): { client: Client; bot: string } {
  const ua = userAgent ?? ''
  if (!ua) return { client: 'bot', bot: '' }
  const lower = ua.toLowerCase()
  for (const [client, names] of ROLES) {
    const bot = names.find((n) => lower.includes(n.toLowerCase()))
    if (bot) return { client, bot }
  }
  return OTHER_BOT.test(ua) ? { client: 'bot', bot: '' } : { client: 'human', bot: '' }
}
