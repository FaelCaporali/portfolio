import type { Config } from '@react-router/dev/config'
import { LANGS, localePath, SITE_PAGES } from './shared/i18n'

/**
 * Um app React só (J87), com o React Router em modo framework e as páginas geradas no build (J89): o HTML de cada
 * endereço sai pronto, com o texto (SEO, GEO, LCP), e o navegador o hidrata; daí em diante a troca de página é do
 * roteador, sem recarregar. Saída em build/client, servida pelo Worker (wrangler.jsonc, assets), que só acrescenta a
 * CSP e a API do contato: sem servidor de renderização.
 */
export default {
  appDirectory: 'src',
  ssr: false,
  // Cada página em cada idioma (/, /journey, /pt, /pt/journey: o HTML com o texto e as metas do idioma), o sitemap e o
  // robots.txt (rotas de recurso, src/routes.ts).
  prerender: [...SITE_PAGES.flatMap((p) => LANGS.map((l) => localePath(l, p))), '/sitemap.xml', '/robots.txt'],
  // O comportamento do React Router v8 já agora (a v8 pede Node 22.22+; a máquina de dev tem 22.21): build por
  // ambientes do Vite e os padrões novos, que aqui não mudam nada (sem loader, action nem middleware).
  future: {
    v8_viteEnvironmentApi: true,
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
} satisfies Config
