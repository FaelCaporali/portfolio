/**
 * Registro de visitas do site no Workers Analytics Engine (binding VISITS; D-MON1/D-MON2,
 * .wai/monitoramento/02-plano.md). Grátis no plano Free (100 mil pontos por dia), com cota própria: não divide o D1
 * com o contato e o MCP. Guarda 3 meses (fixo). Nunca o IP; nada no aparelho de quem visita.
 *
 * Dois tipos de ponto (index1):
 * - 'view': cada página HTML entregue pelo Worker, inclusive a robôs, que não rodam JavaScript. Diz de onde a pessoa
 *   veio (origem, UTM), onde está (país, região, cidade), a rede (asOrganization: a empresa, quando a rede é dela) e
 *   quem pediu (pessoa, robô de busca, assistente buscando para alguém, robô de treino).
 * - 'page' e 'event': o que o navegador manda em POST /api/e (src/lib/track.ts) ao esconder ou trocar de página: o
 *   tempo visível e o que a pessoa fez nela.
 */
import { classifyAgent } from '../shared/bots'
import { langFromPath, SITE_ORIGIN, SITE_PAGES, stripLang } from '../shared/i18n'
import { DETAIL, isEventName, VISIT_ID, VISIT_LIMITS, type VisitBeat } from '../shared/visits'
import { csvSet, readCapped } from './http'

type Cf = IncomingRequestCfProperties | undefined

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Celular, tablet ou computador, pelo User-Agent. */
function deviceOf(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/iPad|Tablet/i.test(ua)) return 'tablet'
  return /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop'
}

/** O host de quem mandou para cá; vazio quando é o próprio site ou não veio. */
function referrerHost(request: Request): string {
  try {
    const host = new URL(request.headers.get('Referer') ?? '').hostname
    return host === new URL(SITE_ORIGIN).hostname ? '' : host
  } catch {
    return ''
  }
}

/**
 * Só as páginas do site são gravadas pelo nome; o resto (404 de varredor, caminho inventado num envio forjado) vira
 * '(outra)': nenhum texto livre de fora chega ao registro nem ao resumo por e-mail.
 */
const PAGES = new Set<string>(SITE_PAGES)
const pageOf = (pathname: string) => {
  const page = stripLang(pathname)
  return PAGES.has(page) ? page : '(outra)'
}

/**
 * UTM com os mesmos caracteres do detalhe dos eventos (shared/visits.ts): sem "@", então um e-mail ou outro texto que
 * uma ferramenta de newsletter ponha no link não é guardado; vira '(outro)'.
 */
function utm(url: URL, key: string): string {
  const value = (url.searchParams.get(`utm_${key}`) ?? '').slice(0, VISIT_LIMITS.detail)
  return DETAIL.test(value) ? value : '(outro)'
}

/**
 * Página HTML entregue: grava um ponto 'view'. Só GET de página (o .data da navegação dentro do site e os arquivos não
 * contam; o prefetch do navegador também não). Falha do Analytics Engine nunca chega a quem visita.
 */
export function recordView(request: Request, env: Env, response: Response): void {
  if (request.method !== 'GET') return
  if (!(response.headers.get('Content-Type') ?? '').startsWith('text/html')) return
  if (request.headers.get('Sec-Purpose')?.includes('prefetch')) return
  const url = new URL(request.url)
  const cf = request.cf as Cf
  const ua = request.headers.get('User-Agent') ?? ''
  const { client, bot } = classifyAgent(ua)
  try {
    env.VISITS.writeDataPoint({
      indexes: ['view'],
      blobs: [
        'view',
        pageOf(url.pathname),
        langFromPath(url.pathname),
        referrerHost(request),
        utm(url, 'source'),
        utm(url, 'medium'),
        utm(url, 'campaign'),
        str(cf?.country),
        str(cf?.region),
        str(cf?.city),
        str(cf?.asOrganization),
        client,
        bot,
        deviceOf(ua),
        String(response.status),
      ],
      doubles: [typeof cf?.asn === 'number' ? cf.asn : 0],
    })
  } catch {
    // Registro é acessório: a página sai mesmo assim.
  }
}

/** O corpo validado, ou null. Tudo o que não está no contrato (shared/visits.ts) é recusado inteiro. */
export function parseBeat(data: unknown): VisitBeat | null {
  if (typeof data !== 'object' || data === null) return null
  const { v, p, t, e } = data as Record<string, unknown>
  if (typeof v !== 'string' || !VISIT_ID.test(v)) return null
  if (typeof p !== 'string' || !p.startsWith('/') || p.length > 200) return null
  if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > VISIT_LIMITS.visibleMs) return null
  if (!Array.isArray(e) || e.length > VISIT_LIMITS.events) return null
  const events: VisitBeat['e'] = []
  for (const item of e) {
    if (!Array.isArray(item) || item.length !== 2) return null
    const [name, detail] = item as unknown[]
    if (!isEventName(name) || typeof detail !== 'string') return null
    if (detail.length > VISIT_LIMITS.detail || !DETAIL.test(detail)) return null
    events.push([name, detail])
  }
  return { v, p, t: Math.round(t), e: events }
}

const noContent = (status = 204) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * POST /api/e: só do próprio site, com teto de corpo e limite por IP. Responde 204 até ao que recusa (o navegador não
 * lê a resposta de um sendBeacon), menos método errado e excesso, que têm código próprio.
 */
export async function handleVisit(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } })
  const origin = request.headers.get('Origin')
  const site = request.headers.get('Sec-Fetch-Site')
  if (!origin || !csvSet(env.ALLOWED_ORIGINS).has(origin) || (site && site !== 'same-origin')) return noContent(403)
  const ip = request.headers.get('CF-Connecting-IP')
  if (!(await env.VISITS_LIMITER.limit({ key: `visit:${ip ?? 'unknown'}` })).success) return noContent(429)

  let beat: VisitBeat | null
  try {
    const raw = await readCapped(request, VISIT_LIMITS.body)
    beat = raw === null ? null : parseBeat(JSON.parse(raw))
  } catch {
    beat = null
  }
  if (!beat) return noContent()

  const cf = request.cf as Cf
  const page = pageOf(new URL(beat.p, SITE_ORIGIN).pathname)
  const lang = langFromPath(beat.p)
  const ua = request.headers.get('User-Agent') ?? ''
  const where = [str(cf?.country), str(cf?.region), str(cf?.city)]
  try {
    env.VISITS.writeDataPoint({
      indexes: ['page'],
      blobs: ['page', page, lang, beat.v, ...where, classifyAgent(ua).client, deviceOf(ua)],
      doubles: [beat.t, beat.e.length],
    })
    for (const [name, detail] of beat.e) {
      env.VISITS.writeDataPoint({
        indexes: ['event'],
        blobs: ['event', page, lang, beat.v, ...where, name, detail],
      })
    }
  } catch {
    // Idem: o registro nunca vira erro para o navegador.
  }
  return noContent()
}

/** Nome do conjunto no Analytics Engine (wrangler.jsonc); as consultas da semana leem dele. */
const DATASET = 'fael_caporali_visits'
const SQL_URL = (account: string) => `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`

type Row = { k: string; n: number }

/** "2026-09-28 11:00:00", em UTC: o formato de data das consultas do Analytics Engine. */
const sqlTime = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')

/**
 * As contagens da semana [from, to) para o resumo semanal (worker/mcp/notify.ts), pela API SQL do Analytics Engine.
 * Contagem certa = SUM(_sample_interval) (a amostragem da Cloudflare); sem concat na SQL do AE, só format(). Sem
 * token (passo manual do Fael, 02-plano.md): 'no_token'. Cada consulta falha sozinha (null, "falhou" na linha dela);
 * todas falhando: 'failed'. Nada disso impede o resumo do MCP.
 */
export async function weekVisits(
  env: Env,
  from: number,
  to: number,
): Promise<(Row[] | null)[] | 'no_token' | 'failed'> {
  if (!env.CF_API_TOKEN) return 'no_token'
  const window = `timestamp >= toDateTime('${sqlTime(from)}') AND timestamp < toDateTime('${sqlTime(to)}')`
  const top = (key: string, where: string, value = 'SUM(_sample_interval)') =>
    `SELECT ${key} AS k, ${value} AS n FROM ${DATASET} WHERE ${window} AND ${where} GROUP BY k ORDER BY n DESC LIMIT 10 FORMAT JSON`
  const human = "index1 = 'view' AND blob12 = 'human'"
  /** Os envios do navegador de quem não se declara robô (blob8 = a classe pelo User-Agent). */
  const humanPages = "index1 = 'page' AND blob8 = 'human'"
  const queries = [
    top('blob12', "index1 = 'view'"), // páginas por quem pediu
    top('blob2', `${human} AND blob15 = '200'`), // páginas mais vistas por pessoas (só as que existem)
    top("if(blob4 = '', '(direto)', blob4)", human), // de onde vieram
    top("format('{} / {} / {}', blob5, blob6, blob7)", `${human} AND blob5 != ''`), // UTM
    top("format('{} {}', blob8, blob10)", human), // país e cidade
    top('blob11', human), // rede (empresa, quando a rede é dela)
    top('blob13', "index1 = 'view' AND blob13 != ''"), // robôs e assistentes por nome
    top('blob14', human), // dispositivo
    top("format('{} {}', blob8, blob9)", "index1 = 'event'"), // eventos por nome e detalhe
    // Tempo visível por página: a soma dividida pelas abas que a viram (a aba manda um envio a cada vez que some).
    top('blob2', humanPages, 'round(SUM(double1 * _sample_interval) / count(DISTINCT blob4) / 1000)'),
    // Visitas de pessoas: abas distintas que mandaram algo.
    `SELECT 'abas' AS k, count(DISTINCT blob4) AS n FROM ${DATASET} WHERE ${window} AND ${humanPages} FORMAT JSON`,
  ]
  const results = await Promise.allSettled(
    queries.map(async (q) => {
      const r = await fetch(SQL_URL(env.CF_ACCOUNT_ID), {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
        body: q,
      })
      if (!r.ok) throw new Error(`analytics_engine ${r.status}`)
      const body = await r.json<{ data?: { k: unknown; n: unknown }[] }>()
      return (body.data ?? []).map((d) => ({ k: String(d.k), n: Number(d.n) }))
    }),
  )
  const rows = results.map((r) => (r.status === 'fulfilled' ? r.value : null))
  return rows.every((r) => r === null) ? 'failed' : rows
}
