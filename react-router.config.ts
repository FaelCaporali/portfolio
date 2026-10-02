import type { Config } from '@react-router/dev/config'
import { LANGS, localePath, markdownPath, SITE_PAGES } from './shared/i18n'

/**
 * Um app React só (J87), com o React Router em modo framework e as páginas geradas no build (J89): o HTML de cada
 * endereço sai pronto, com o texto (SEO, GEO, LCP), e o navegador o hidrata; daí em diante a troca de página é do
 * roteador, sem recarregar. Saída em build/client, servida pelo Worker (wrangler.jsonc, assets), que só acrescenta a
 * CSP e a API do contato: sem servidor de renderização.
 */
export default {
  appDirectory: 'src',
  ssr: false,
  // Cada página em cada idioma (/, /journey, /pt, /pt/journey: o HTML com o texto e as metas do idioma), a versão em
  // markdown de cada uma, o sitemap, o robots.txt e o llms.txt (rotas de recurso, src/routes.ts).
  prerender: [
    ...SITE_PAGES.flatMap((p) => LANGS.flatMap((l) => [localePath(l, p), markdownPath(l, p)])),
    '/sitemap.xml',
    '/robots.txt',
    '/llms.txt',
    // Rota interna da variante dos robôs da home (camada 1, 03-plano-versao-robos.md): fora de SITE_PAGES de
    // propósito (não pode entrar no sitemap nem na detecção de idioma do Worker). Bloqueada a pedido direto
    // (worker/index.ts); só alcançada por env.ASSETS.fetch, com a mesma precedência de '/__spa-fallback'.
    '/__hero-bot',
    '/pt/__hero-bot',
  ],
  // O comportamento do React Router v8 já agora (a v8 pede Node 22.22+; a máquina de dev tem 22.21): build por
  // ambientes do Vite e os padrões novos, que aqui não mudam nada (sem action nem middleware; os loaders
  // das rotas de recurso e das páginas de oferta rodam só no pré-render, e com v8_passThroughRequests leem `url`, não
  // `request.url`, que traz o sufixo .data).
  future: {
    v8_viteEnvironmentApi: true,
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
} satisfies Config
