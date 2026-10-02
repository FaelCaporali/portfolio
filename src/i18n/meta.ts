import type { MetaDescriptor } from 'react-router'
import { LANGS, localePath, markdownPath, SITE_ORIGIN, type Lang, type SitePage } from '../../shared/i18n'
import { profile } from '../content/profile'
import { serviceByPath, services } from '../content/services'
import { langFromParam, LOCALES, MESSAGES, otherLang } from './lang'
import {
  company,
  faq,
  pageGraph,
  person,
  PERSON_ID,
  service as serviceNode,
  SHARE_IMAGE,
  shareImageUrl,
  type PageGraph,
} from './structured-data'

/** As páginas com metas nas mensagens; as de oferta (/services/…) têm as delas em src/content/services.ts. */
type NamedPage = 'home' | 'journey' | 'mcp'

const PATHS: Record<NamedPage, SitePage> = { home: '/', journey: '/journey', mcp: '/mcp' }
const NAMED = new Map<string, NamedPage>(Object.entries(PATHS).map(([k, v]) => [v, k as NamedPage]))

/** Endereço absoluto de uma página num idioma (canonical, og:url, hreflang e sitemap). */
export const absoluteUrl = (lang: Lang, path: string) => `${SITE_ORIGIN}${localePath(lang, path)}`

/** Os alternates de uma página: um por idioma e o x-default, que é o inglês (o endereço sem prefixo). */
export function alternates(path: string) {
  return [
    ...LANGS.map((l) => ({ hrefLang: LOCALES[l].tag, href: absoluteUrl(l, path) })),
    { hrefLang: 'x-default', href: absoluteUrl('en', path) },
  ]
}

/**
 * Trecho e imagem grandes liberados no Google e nos resumos de IA (developers.google.com/search/docs/crawling-indexing/
 * robots-meta-tag): sem max-snippet:-1 e max-image-preview:large o buscador pode encurtar o que mostra.
 */
const ROBOTS = 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'

interface PageText {
  path: SitePage
  title: string
  description: string
  keywords: string
}

/** Título, descrição e palavras-chave de uma página num idioma (as de oferta: src/content/services.ts). */
export function pageText(lang: Lang, page: NamedPage | SitePage): PageText {
  const named = NAMED.get(page) ?? (page in PATHS ? (page as NamedPage) : undefined)
  if (named) return { path: PATHS[named], ...MESSAGES[lang].meta[named] }
  const s = serviceByPath(page)
  if (!s) throw new Error(`meta.ts: página sem metas: ${page}`)
  return {
    path: s.path,
    title: s.meta.title[lang],
    description: s.meta.description[lang],
    keywords: s.meta.keywords[lang],
  }
}

/** A pessoa nas páginas que não são a home: o que o cabeçalho delas mostra (o nome) e o endereço. */
const personRef = () => ({
  '@type': 'Person',
  '@id': PERSON_ID,
  name: profile.name,
  alternateName: 'Rafael Caporali',
  url: `${SITE_ORIGIN}/`,
})

/**
 * O @graph de cada página: a home leva a pessoa completa, a empresa com as ofertas (cada uma com o endereço da página
 * dela) e o FAQ; as outras, o caminho de volta, a pessoa pelo nome e, na de oferta, o serviço.
 */
function graph(lang: Lang, text: PageText, url: string): ReturnType<typeof pageGraph> {
  const base: PageGraph = {
    lang,
    url,
    type: text.path === '/' || text.path === '/journey' ? 'ProfilePage' : 'WebPage',
    name: text.title,
    description: text.description,
  }
  if (text.path === '/') {
    const serviceUrl = (i: number) => {
      const s = services[i]
      return s ? absoluteUrl(lang, s.path) : undefined
    }
    return pageGraph({ ...base, extra: [person(lang), company(lang, serviceUrl), faq(lang, url)] })
  }
  const s = serviceByPath(text.path)
  return pageGraph({
    ...base,
    breadcrumb: [{ name: MESSAGES[lang].meta.breadcrumbHome, url: absoluteUrl(lang, '/') }],
    extra: [personRef(), ...(s ? [serviceNode(lang, s, url)] : [])],
  })
}

/**
 * As metas de uma página no idioma da rota, calculadas aqui para os dois idiomas (nada escrito à mão por idioma): o
 * build as grava no HTML de cada endereço, e no navegador a troca de idioma as refaz sem recarregar. Parâmetro que não
 * é idioma: a página não existe (a rota de layout mostra "Page not found"), sem metas próprias. Lista completa em
 * .wai/seo-geo/04-plano.md (F1); o e2e (e2e/seo.spec.ts) confere cada uma no HTML entregue.
 */
export function pageMeta(param: string | undefined, page: NamedPage | SitePage): MetaDescriptor[] {
  const lang = langFromParam(param)
  if (!lang) return []
  const text = pageText(lang, page)
  const url = absoluteUrl(lang, text.path)
  const image = shareImageUrl(lang)
  const imageAlt = MESSAGES[lang].meta.imageAlt
  const profilePage = text.path === '/' || text.path === '/journey'
  return [
    { title: text.title },
    { name: 'description', content: text.description },
    { name: 'keywords', content: text.keywords },
    { name: 'author', content: profile.name },
    { name: 'robots', content: ROBOTS },
    { property: 'og:site_name', content: profile.name },
    { property: 'og:type', content: profilePage ? 'profile' : 'website' },
    { property: 'og:title', content: text.title },
    { property: 'og:description', content: text.description },
    { property: 'og:url', content: url },
    { property: 'og:locale', content: LOCALES[lang].og },
    { property: 'og:locale:alternate', content: LOCALES[otherLang(lang)].og },
    { property: 'og:image', content: image },
    { property: 'og:image:secure_url', content: image },
    { property: 'og:image:type', content: SHARE_IMAGE.type },
    { property: 'og:image:width', content: String(SHARE_IMAGE.width) },
    { property: 'og:image:height', content: String(SHARE_IMAGE.height) },
    { property: 'og:image:alt', content: imageAlt },
    ...(profilePage
      ? [
          { property: 'profile:first_name', content: 'Fael' },
          { property: 'profile:last_name', content: 'Caporali' },
        ]
      : []),
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: text.title },
    { name: 'twitter:description', content: text.description },
    { name: 'twitter:image', content: image },
    { name: 'twitter:image:alt', content: imageAlt },
    { tagName: 'link', rel: 'canonical', href: url },
    ...alternates(text.path).map((a) => ({ tagName: 'link', rel: 'alternate', ...a })),
    {
      tagName: 'link',
      rel: 'alternate',
      type: 'text/markdown',
      title: text.title,
      href: `${SITE_ORIGIN}${markdownPath(lang, text.path)}`,
    },
    { 'script:ld+json': graph(lang, text, url) },
  ]
}
