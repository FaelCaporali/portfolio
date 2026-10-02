import { LANGS, SITE_ORIGIN, type Lang } from '../../shared/i18n'
import { OPENING } from '../content/journey'
import { overview } from '../content/overview'
import { directContacts, profile, profileLinks, sourceHref } from '../content/profile'
import type { Service } from '../content/services'
import { LOCALES, MESSAGES } from './lang'
import { homeTagLabel } from './tags'

/**
 * Os dados estruturados (JSON-LD, schema.org) das páginas, num @graph com ids estáveis: o site, a pessoa, a empresa
 * dela e a página. Regra do Google: o dado estruturado repete o texto visível da página. Por isso a pessoa completa
 * (cargos, stack, cidade, contatos), as ofertas e as perguntas frequentes vão na home, onde aparecem; as outras páginas
 * citam a pessoa pelo @id. Sem empregador, cliente nem formação (a home não os mostra).
 */

export const PERSON_ID = `${SITE_ORIGIN}/#person`
const WEBSITE_ID = `${SITE_ORIGIN}/#website`
const COMPANY_ID = `${SITE_ORIGIN}/#company`

/** A imagem de compartilhamento do idioma (F3, 1200 × 630), a mesma da og:image. */
export const SHARE_IMAGE = { width: 1200, height: 630, type: 'image/jpeg' } as const
export const shareImageUrl = (lang: Lang) => `${SITE_ORIGIN}/og/fael-caporali-${lang}.jpg`

type Node = Record<string, unknown>

export interface PageGraph {
  lang: Lang
  url: string
  /** ProfilePage nas páginas sobre a pessoa (home e trajetória); WebPage nas outras. */
  type: 'ProfilePage' | 'WebPage'
  name: string
  description: string
  /** O caminho de volta até a home (BreadcrumbList), sem a própria página quando ela é a home. */
  breadcrumb?: { name: string; url: string }[]
  /** Nós a mais desta página (a pessoa completa, as ofertas e o FAQ na home). */
  extra?: Node[]
}

/** O site: o nome que o Google mostra na busca (WebSite name/alternateName). */
function website(): Node {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: `${SITE_ORIGIN}/`,
    name: profile.name,
    alternateName: ['Rafael Caporali', 'fael.caporali.dev'],
    inLanguage: LANGS.map((l) => LOCALES[l].tag),
    publisher: { '@id': PERSON_ID },
  }
}

/** A pessoa como a home a mostra: cargos do herói, cidade, idiomas, stack, contatos e perfis. */
export function person(lang: Lang): Node {
  const m = MESSAGES[lang]
  const email = directContacts.find((c) => c.kind === 'email')
  const phone = directContacts.find((c) => c.kind === 'phone')
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: profile.name,
    alternateName: 'Rafael Caporali',
    url: `${SITE_ORIGIN}/`,
    image: shareImageUrl(lang),
    description: overview.offers.lede[lang],
    // A vida de abertura (a frase do herói, no HTML do build desde D-SEO7) e os títulos abaixo dela.
    jobTitle: [m.hero.slots[OPENING], ...m.hero.titles],
    knowsAbout: overview.stack.groups.flatMap((g) => g.items.map((t) => homeTagLabel(lang, t))),
    knowsLanguage: ['pt-BR', 'en'],
    homeLocation: {
      '@type': 'Place',
      name: overview.offers.facts[0]?.[lang],
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Belo Horizonte',
        addressCountry: 'BR',
      },
    },
    email: email?.value,
    telephone: phone?.value,
    worksFor: { '@id': COMPANY_ID },
    sameAs: [...profileLinks.map((l) => l.href), sourceHref],
  }
}

/**
 * A empresa pela qual ele é contratado (o FAQ da home: "Through HC Consultorias, my company"), com as ofertas da home
 * como catálogo de serviços. Sem fundador nem funcionário: a página não diz mais que isso.
 */
export function company(lang: Lang, serviceUrl: (index: number) => string | undefined): Node {
  const offers = overview.offers
  return {
    '@type': 'ProfessionalService',
    '@id': COMPANY_ID,
    name: 'HC Consultorias',
    url: `${SITE_ORIGIN}/`,
    image: shareImageUrl(lang),
    address: { '@type': 'PostalAddress', addressLocality: 'Belo Horizonte', addressCountry: 'BR' },
    areaServed: ['BR', 'Worldwide'],
    knowsLanguage: ['pt-BR', 'en'],
    email: directContacts.find((c) => c.kind === 'email')?.value,
    telephone: directContacts.find((c) => c.kind === 'phone')?.value,
    description: offers.lede[lang],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: offers.title[lang],
      itemListElement: offers.items.map((item, i) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: item.title[lang],
          description: item.text[lang],
          serviceType: item.tags.map((t) => homeTagLabel(lang, t)).join(', '),
          url: serviceUrl(i),
          provider: { '@id': COMPANY_ID },
          areaServed: ['BR', 'Worldwide'],
        },
      })),
    },
  }
}

/** As perguntas frequentes da home, com a resposta inteira como está na página. */
export function faq(lang: Lang, pageUrl: string): Node {
  return {
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    isPartOf: { '@id': `${pageUrl}#webpage` },
    inLanguage: LOCALES[lang].tag,
    mainEntity: overview.faq.items.map((item) => ({
      '@type': 'Question',
      name: item.q[lang],
      acceptedAnswer: { '@type': 'Answer', text: item.a[lang] },
    })),
  }
}

/**
 * O @graph de uma página. `dateModified`: o dia do build (vite.config.ts, __BUILD_DATE__), o mesmo no HTML e na
 * hidratação.
 */
export function pageGraph(g: PageGraph) {
  const page: Node = {
    '@type': g.type,
    '@id': `${g.url}#webpage`,
    url: g.url,
    name: g.name,
    description: g.description,
    inLanguage: LOCALES[g.lang].tag,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': PERSON_ID },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: shareImageUrl(g.lang),
      width: SHARE_IMAGE.width,
      height: SHARE_IMAGE.height,
      encodingFormat: SHARE_IMAGE.type,
    },
    dateModified: __BUILD_DATE__,
    ...(g.type === 'ProfilePage' ? { mainEntity: { '@id': PERSON_ID } } : {}),
    ...(g.breadcrumb ? { breadcrumb: { '@id': `${g.url}#breadcrumb` } } : {}),
  }
  const breadcrumb: Node[] = g.breadcrumb
    ? [
        {
          '@type': 'BreadcrumbList',
          '@id': `${g.url}#breadcrumb`,
          itemListElement: [...g.breadcrumb, { name: g.name, url: g.url }].map((b, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: b.name,
            item: b.url,
          })),
        },
      ]
    : []
  return { '@context': 'https://schema.org', '@graph': [website(), page, ...breadcrumb, ...(g.extra ?? [])] }
}

/** A oferta da página dela: o serviço, quem presta, onde e o tipo (as etiquetas da oferta). */
export function service(lang: Lang, s: Service, pageUrl: string): Node {
  return {
    '@type': 'Service',
    '@id': `${pageUrl}#service`,
    name: s.offer.title[lang],
    description: s.offer.text[lang],
    serviceType: s.offer.tags.map((t) => homeTagLabel(lang, t)).join(', '),
    url: pageUrl,
    provider: { '@id': PERSON_ID },
    areaServed: ['BR', 'Worldwide'],
    availableLanguage: ['pt-BR', 'en'],
    mainEntityOfPage: { '@id': `${pageUrl}#webpage` },
  }
}
