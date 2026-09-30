import type { MetaDescriptor } from 'react-router'
import { LANGS, localePath, SITE_ORIGIN, type Lang, type SitePage } from '../../shared/i18n'
import { profileLinks } from '../content/profile'
import { langFromParam, LOCALES, MESSAGES, otherLang } from './lang'

type Page = 'home' | 'journey'

const PATHS: Record<Page, SitePage> = { home: '/', journey: '/journey' }

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
 * As metas de uma página no idioma da rota, calculadas aqui para os dois idiomas (nada escrito à mão por idioma): o
 * build as grava no HTML de cada endereço, e no navegador a troca de idioma as refaz sem recarregar. Parâmetro que não
 * é idioma: a página não existe (a rota de layout mostra "Page not found"), sem metas próprias.
 */
export function pageMeta(param: string | undefined, page: Page): MetaDescriptor[] {
  const lang = langFromParam(param)
  if (!lang) return []
  const m = MESSAGES[lang].meta[page]
  const path = PATHS[page]
  const url = absoluteUrl(lang, path)
  return [
    { title: m.title },
    { name: 'description', content: m.description },
    { property: 'og:site_name', content: 'Fael Caporali' },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: m.title },
    { property: 'og:description', content: m.description },
    { property: 'og:url', content: url },
    { property: 'og:locale', content: LOCALES[lang].og },
    { property: 'og:locale:alternate', content: LOCALES[otherLang(lang)].og },
    { tagName: 'link', rel: 'canonical', href: url },
    ...alternates(path).map((a) => ({ tagName: 'link', rel: 'alternate', ...a })),
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        name: m.title,
        description: m.description,
        url,
        inLanguage: LOCALES[lang].tag,
        mainEntity: {
          '@type': 'Person',
          name: 'Fael Caporali',
          alternateName: 'Rafael Caporali',
          url: absoluteUrl(lang, '/'),
          sameAs: profileLinks.map((l) => l.href),
        },
      },
    },
  ]
}
