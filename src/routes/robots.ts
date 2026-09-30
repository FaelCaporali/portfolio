import { SITE_ORIGIN } from '../../shared/i18n'

/**
 * robots.txt: tudo liberado e o endereço do sitemap (os dois idiomas). Rota de recurso pré-renderizada, com a origem
 * da mesma constante das metas: sai do build como build/client/robots.txt.
 */
export function loader() {
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${SITE_ORIGIN}/sitemap.xml`, ''].join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
