import { LANGS, SITE_PAGES } from '../../shared/i18n'
import { absoluteUrl, alternates } from '../i18n/meta'

/**
 * O sitemap: as páginas nos dois idiomas (4 endereços), cada uma com os alternates recíprocos (hreflang), da mesma
 * fonte das metas (src/i18n/meta.ts). Rota de recurso pré-renderizada: sai do build como build/client/sitemap.xml.
 */
export function sitemapXml(): string {
  const urls = SITE_PAGES.flatMap((path) =>
    LANGS.map((lang) => {
      const links = alternates(path).map(
        (a) => `    <xhtml:link rel="alternate" hreflang="${a.hrefLang}" href="${a.href}"/>`,
      )
      return ['  <url>', `    <loc>${absoluteUrl(lang, path)}</loc>`, ...links, '  </url>'].join('\n')
    }),
  )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}

export function loader() {
  return new Response(sitemapXml(), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
