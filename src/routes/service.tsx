import type { MetaFunction } from 'react-router'
import { useLoaderData } from 'react-router'
import { stripLang } from '../../shared/i18n'
import { serviceTools } from '../content/service-tools'
import { serviceByPath } from '../content/services'
import { ServicePage } from '../features/services/ServicePage'
import { pageMeta } from '../i18n/meta'

/** A oferta pelo endereço, sem o idioma (/pt/services/ai-agents → /services/ai-agents). */
const servicePage = (pathname: string) => serviceByPath(stripLang(pathname))

/**
 * Roda só no build (ssr: false, pré-render): as ferramentas dos marcos vêm de journey.json, que assim não vai para o
 * pacote da página; o resultado sai no HTML.
 */
export function loader({ url }: { url: URL }) {
  // As rotas são só os endereços de SERVICE_PAGES (src/routes.ts): sem oferta é erro de configuração, não 404.
  // `url`, não `request.url`: com v8_passThroughRequests o pedido do pré-render traz o sufixo .data.
  const service = servicePage(url.pathname)
  if (!service) throw new Error(`service.tsx: sem oferta em ${url.pathname}`)
  return { path: service.path, tools: serviceTools(service) }
}

export const meta: MetaFunction = ({ params, location }) => {
  const service = servicePage(location.pathname)
  return service ? pageMeta(params.lang, service.path) : []
}

/**
 * Uma página de oferta (/services/…): a mesma rota para as quatro (src/routes.ts, um id por endereço), a oferta vem do
 * endereço. Sai pronta do build nos dois idiomas.
 */
export default function Service() {
  const { path, tools } = useLoaderData<typeof loader>()
  const service = serviceByPath(path)
  if (!service) throw new Error(`service.tsx: sem oferta em ${path}`)
  return <ServicePage service={service} tools={tools} />
}
