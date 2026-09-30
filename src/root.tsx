import type { ReactNode } from 'react'
import { isRouteErrorResponse, Link, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import { useHydrated } from './lib/useHydrated'
import { NavigationProgress } from './ui/NavigationProgress'
import './index.css'
// As cores das vidas como classes e variáveis (a trajetória e o anel do "Contact me"), geradas de journey.ts
// (vite.config.ts): a CSP não aceita estilo inline.
import 'virtual:journey-accents.css'

/**
 * O documento de todas as páginas. Título e descrição vêm de cada rota (meta, em src/routes/); os <script> que o
 * roteador escreve no HTML recebem o nonce da CSP no Worker (worker/page.ts).
 */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
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
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

/** Todas as páginas, com a barra de carregamento da troca de página pelo roteador (U2). */
export default function Root() {
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
 * Endereço que não existe (o Worker responde 404 com a página vazia do roteador) ou erro inesperado. A página vazia
 * sai do build sem nada no corpo (HydrateFallback): o aviso só aparece depois da hidratação, para as duas árvores
 * serem iguais.
 */
export function ErrorBoundary({ error }: { error: unknown }) {
  const hydrated = useHydrated()
  if (!hydrated) return null
  const missing = isRouteErrorResponse(error) && error.status === 404
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 px-5 text-white">
      <title>{missing ? 'Page not found · Fael Caporali' : 'Something went wrong · Fael Caporali'}</title>
      <h1 className="text-3xl font-semibold tracking-tight">{missing ? 'Page not found' : 'Something went wrong'}</h1>
      <p className="text-white/70">
        {missing ? 'There is nothing at this address.' : 'The page could not be shown. Please try again.'}
      </p>
      <Link to="/" className="text-white underline underline-offset-4 hover:text-white/80">
        Back to the home page
      </Link>
    </main>
  )
}
