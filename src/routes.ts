import { index, route, type RouteConfig } from '@react-router/dev/routes'

/**
 * As páginas do site: o herói e a trajetória (as duas pré-renderizadas, react-router.config.ts). O endereço da
 * trajetória é o do botão do herói (journeyLink, src/content/profile.ts).
 */
export default [index('routes/home.tsx'), route('journey', 'routes/journey.tsx')] satisfies RouteConfig
