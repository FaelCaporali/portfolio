import type { MetaFunction } from 'react-router'
import { ContactWidget } from '../features/contact/ContactWidget'
import { BotHero } from '../features/hero/BotHero'
import { McpLink } from '../features/mcp/McpLink'
import { Overview } from '../features/overview/Overview'
import { pageMeta } from '../i18n/meta'

export const meta: MetaFunction = ({ params }) => pageMeta(params.lang, 'home')

/**
 * Rota interna da variante dos robôs da home (camada 1 de 03-plano-versao-robos.md, D-ROBO-HIDR): mesma meta de `/`
 * (canonical, hreflang, @graph, OG idênticos, por construção — a mesma chamada `pageMeta`, Capítulo 2 do plano), mas
 * SEM hidratar: `handle.hydrate` = false faz o Layout (src/root.tsx) omitir <Scripts /> e os modulepreload. O Worker
 * troca por esta página só para quem não é pessoa (shared/bots.ts, classifyAgent), na MESMA URL (worker/index.ts);
 * nunca um endereço anunciado — rota interna fora de SITE_PAGES, bloqueada a pedido direto em worker/index.ts.
 */
export const handle = { hydrate: false }

export default function HomeBot() {
  return (
    <>
      <main>
        <BotHero />
        <Overview />
      </main>
      <McpLink />
      <ContactWidget />
    </>
  )
}
