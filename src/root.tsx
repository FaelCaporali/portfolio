import { useEffect, type ReactNode } from 'react'
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useMatches,
} from 'react-router'
import { langFromPath, LOCALES } from './i18n/lang'
import { startTracking, trackPage } from './lib/track'
import { ErrorPage } from './ui/ErrorPage'
import { NavigationProgress } from './ui/NavigationProgress'
import './index.css'
// As cores das vidas como classes e variáveis (a trajetória e o anel do "Contact me"), geradas de journey.ts
// (vite.config.ts): a CSP não aceita estilo inline.
import 'virtual:journey-accents.css'

/**
 * A variante dos robôs da home (routes/home-bot.tsx, D-ROBO-HIDR de 03-plano-versao-robos.md) não hidrata: o
 * roteador casaria as rotas pela URL da janela (sempre `/` ou `/pt`), montaria o herói humano por cima e as vidas
 * extras desapareceriam do DOM renderizado. Nenhuma rota casada com esse `handle` recebe <Scripts /> (nem os
 * modulepreload que ela injeta) nem <ScrollRestoration /> (também um <script>): HTML puro, sem JavaScript do app.
 */
function useHydrate(): boolean {
  return useMatches().every((m) => (m.handle as { hydrate?: boolean } | undefined)?.hydrate !== false)
}

/**
 * O documento de todas as páginas. As metas vêm de cada rota (meta, em src/routes/, calculadas do idioma em
 * src/i18n/meta.ts); o <html lang> é o do endereço (/pt… = pt-BR), e a troca de idioma pelo roteador o refaz. Os
 * <script> que o roteador escreve no HTML recebem o nonce da CSP no Worker (worker/page.ts).
 */
export function Layout({ children }: { children: ReactNode }) {
  const tag = LOCALES[langFromPath(useLocation().pathname)].tag
  const hydrate = useHydrate()
  // A página vazia do build (__spa-fallback.html) sai com lang="en" e a hidratação não corrige atributo: /pt/… que
  // não existe ganha o lang certo aqui. Rota sem hidratação: não roda, o atributo do build já é o certo.
  useEffect(() => {
    if (document.documentElement.lang !== tag) document.documentElement.lang = tag
  }, [tag])
  return (
    <html lang={tag}>
      <head>
        <meta charSet="UTF-8" />
        {/* A cor da barra do navegador no celular: o fundo da página (--color-page). */}
        <meta name="theme-color" content="#0b0b0e" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        {hydrate && <ScrollRestoration />}
        {hydrate && <Scripts />}
      </body>
    </html>
  )
}

/**
 * Todas as páginas, com a barra de carregamento da troca de página pelo roteador (U2) e o registro de visitas
 * (src/lib/track.ts): começa na hidratação e marca cada troca de página.
 */
export default function Root() {
  const { pathname } = useLocation()
  useEffect(() => startTracking(window.location.pathname), [])
  useEffect(() => trackPage(pathname), [pathname])
  return (
    <>
      <NavigationProgress />
      <Outlet />
    </>
  )
}

/**
 * A página vazia do build (__spa-fallback.html, só para endereço que não existe): nada até o roteador achar a rota,
 * ou mostrar o ErrorBoundary.
 */
export function HydrateFallback() {
  return null
}

/**
 * Endereço que não existe (o Worker responde 404 com a página vazia do roteador) ou erro inesperado, no idioma do
 * endereço (ErrorPage).
 */
export function ErrorBoundary({ error }: { error: unknown }) {
  const lang = langFromPath(useLocation().pathname)
  return <ErrorPage lang={lang} missing={isRouteErrorResponse(error) && error.status === 404} />
}
