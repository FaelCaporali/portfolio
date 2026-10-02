import { LANGS, SITE_PAGES } from '../../shared/i18n'
import { absoluteUrl, alternates } from '../i18n/meta'
import { shareImageUrl } from '../i18n/structured-data'

/**
 * O sitemap: as páginas nos dois idiomas, cada uma com os alternates recíprocos (hreflang) e a imagem de
 * compartilhamento do idioma (sitemap de imagens do Google), da mesma fonte das metas (src/i18n/meta.ts). Sem lastmod:
 * o dia do build mudaria em todo deploy, e o Google ignora lastmod que não acompanha a mudança real do conteúdo.
 * Rota de recurso pré-renderizada: sai do build como build/client/sitemap.xml.
 */
export function sitemapXml(): string {
  const urls = SITE_PAGES.flatMap((path) =>
    LANGS.map((lang) => {
      const links = alternates(path).map(
        (a) => `    <xhtml:link rel="alternate" hreflang="${a.hrefLang}" href="${a.href}"/>`,
      )
      return [
        '  <url>',
        `    <loc>${absoluteUrl(lang, path)}</loc>`,
        ...links,
        `    <image:image><image:loc>${shareImageUrl(lang)}</image:loc></image:image>`,
        '  </url>',
      ].join('\n')
    }),
  )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}

export function loader() {
  return new Response(sitemapXml(), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
