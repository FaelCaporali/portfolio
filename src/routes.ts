import { index, route, type RouteConfig } from '@react-router/dev/routes'
import { SITE_PAGES, type SitePage } from '../shared/i18n'

/**
 * O módulo de cada página. As páginas vêm de SITE_PAGES (shared/i18n.ts), a mesma lista que o build pré-renderiza nos
 * dois idiomas (react-router.config.ts), que o sitemap lista e que a detecção de idioma do Worker cobre: página nova
 * entra lá, e o tipo exige o módulo aqui. Nada disso se atualiza à mão.
 */
const PAGE_MODULES: Record<SitePage, string> = {
  '/': 'routes/home.tsx',
  '/journey': 'routes/journey.tsx',
  '/mcp': 'routes/mcp-page.tsx',
}

/**
 * As páginas do site dentro de uma rota de layout com o idioma como segmento opcional: / e /journey em inglês, /pt e
 * /pt/journey em português. Os ids das páginas são os mesmos nos dois idiomas: trocar de idioma não desmonta a página
 * (a cena 3D segue). Segmento que não é "pt" = "Page not found" (routes/lang.tsx). O endereço da trajetória é o do
 * botão do herói (journeyPath, src/content/profile.ts). O sitemap e o robots.txt saem do build como arquivos (rotas
 * de recurso pré-renderizadas).
 */
export default [
  route('sitemap.xml', 'routes/sitemap.ts'),
  route('robots.txt', 'routes/robots.ts'),
  route(
    ':lang?',
    'routes/lang.tsx',
    SITE_PAGES.map((path) => (path === '/' ? index(PAGE_MODULES[path]) : route(path.slice(1), PAGE_MODULES[path]))),
  ),
] satisfies RouteConfig
