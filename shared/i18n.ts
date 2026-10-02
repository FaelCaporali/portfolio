/**
 * Idiomas do site e a regra de detecção, iguais no Worker (redirect da primeira visita) e no navegador (o dev, que não
 * passa pelo Worker). Inglês sem prefixo (/ e /journey, os endereços já divulgados); português em /pt e /pt/journey.
 */
export type Lang = 'en' | 'pt'

export const LANGS: readonly Lang[] = ['en', 'pt']

/** Origem pública do site: canonical, og:url, hreflang e o sitemap saem dela. */
export const SITE_ORIGIN = 'https://fael.caporali.dev'

/** As páginas que existem nos dois idiomas, no endereço inglês (sem prefixo). */
export const SITE_PAGES = ['/', '/journey', '/mcp'] as const
export type SitePage = (typeof SITE_PAGES)[number]

/** Cookie da escolha manual (o controle PT/EN): a detecção nunca desfaz o que a pessoa escolheu. */
export const LANG_COOKIE = 'lang'
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** O endereço de uma página no idioma: '/' → '/pt', '/journey' → '/pt/journey'; em inglês, igual. */
export function localePath(lang: Lang, path: string): string {
  if (lang === 'en') return path
  return path === '/' ? '/pt' : `/pt${path}`
}

/** O idioma pelo endereço: /pt e /pt/… são português; o resto, inglês. */
export function langFromPath(pathname: string): Lang {
  return pathname === '/pt' || pathname.startsWith('/pt/') ? 'pt' : 'en'
}

/**
 * A página do endereço, sem o prefixo do idioma e sem a barra no fim (o build pré-renderiza /journey/, o navegador
 * pede /journey): '/pt/journey' → '/journey', '/pt' → '/', '/journey/' → '/journey'.
 */
export function stripLang(pathname: string): string {
  let path = pathname
  while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  if (langFromPath(path) === 'en') return path
  return path.slice(3) || '/'
}

/** Os idiomas do Accept-Language em ordem de preferência (q maior primeiro; empate mantém a ordem do cabeçalho). */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return []
  return header
    .split(',')
    .map((part, i) => {
      const [tag = '', ...params] = part.trim().split(';')
      const q = params.map((p) => /^\s*q\s*=\s*([\d.]+)\s*$/i.exec(p)?.[1]).find((v) => v !== undefined)
      return { tag: tag.trim(), q: q === undefined ? 1 : Number(q), i }
    })
    .filter((l) => l.tag && l.tag !== '*' && Number.isFinite(l.q) && l.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
    .map((l) => l.tag)
}

/** A escolha salva no cookie `lang`, se houver. */
export function savedLang(cookie: string | null | undefined): Lang | null {
  const match = new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=(en|pt)(?:;|$)`).exec(cookie ?? '')
  return (match?.[1] as Lang | undefined) ?? null
}

/**
 * A regra: a escolha salva vale; sem ela, o primeiro idioma suportado da lista de preferências (en-* ou pt-*) decide;
 * sem nenhum suportado, inglês (o robô sem Accept-Language também recebe o inglês e acha o português pelo hreflang).
 */
export function preferredLang(languages: readonly string[], saved: Lang | null): Lang {
  if (saved) return saved
  for (const l of languages) {
    const base = l.toLowerCase().split('-')[0]
    if (base === 'pt') return 'pt'
    if (base === 'en') return 'en'
  }
  return 'en'
}
