import { SITE_ORIGIN } from '../../shared/i18n'

/**
 * Os robôs de busca e de IA nomeados (03-pesquisa-geo.md, docs de cada provedor): o portfólio quer ser achado, citado
 * e lembrado por todos, inclusive no treino dos modelos. Cada um ganha um grupo próprio porque o robô que acha o seu
 * nome segue só o grupo dele e ignora o `*`.
 */
export const NAMED_BOTS = [
  // Buscadores
  'Googlebot',
  'Bingbot',
  'DuckDuckBot',
  'Applebot',
  'YandexBot',
  // Busca e respostas dos assistentes
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'DuckAssistBot',
  'meta-externalfetcher',
  'MistralAI-User',
  // Treino e uso em IA generativa
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'meta-externalagent',
  'CCBot',
  'Amazonbot',
] as const

/** A API do contato e do MCP não é página: fica fora do índice. */
const PRIVATE = ['/api/']

/**
 * robots.txt: tudo liberado (menos a API), os robôs de busca e de IA nomeados e o sitemap. Sem a linha Content-Signal
 * (contentsignals.org): com tudo liberado ela não acrescenta nada, e o validador do Lighthouse a reprova como diretiva
 * desconhecida (SEO 92, medido em 02/10). Rota de recurso pré-renderizada, com a origem da mesma constante das metas:
 * sai do build como build/client/robots.txt.
 */
export function robotsTxt(): string {
  const group = (agents: readonly string[]) => [
    ...agents.map((a) => `User-agent: ${a}`),
    'Allow: /',
    ...PRIVATE.map((p) => `Disallow: ${p}`),
    '',
  ]
  return [
    '# Fael Caporali: portfólio público. Busca, respostas de IA e treino são bem-vindos.',
    '# Também em markdown para assistentes: /llms.txt',
    '',
    ...group(['*']),
    ...group(NAMED_BOTS),
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    '',
  ].join('\n')
}

export function loader() {
  return new Response(robotsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
