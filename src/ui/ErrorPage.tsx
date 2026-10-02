import { Link } from 'react-router'
import { useHydrated } from '../lib/useHydrated'
import { localePath, MESSAGES, type Lang } from '../i18n/lang'

/**
 * "Page not found" (endereço que não existe) ou "Something went wrong" (erro inesperado), no idioma do endereço. A
 * página vazia do build (__spa-fallback.html) sai sem nada no corpo: o aviso só aparece depois da hidratação, para as
 * duas árvores serem iguais.
 */
export function ErrorPage({ lang, missing }: { lang: Lang; missing: boolean }) {
  const hydrated = useHydrated()
  if (!hydrated) return null
  const e = MESSAGES[lang].errors
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 px-5 text-fg">
      <title>{missing ? e.notFoundTitle : e.failedTitle}</title>
      <h1 className="text-3xl font-semibold tracking-tight">{missing ? e.notFound : e.failed}</h1>
      <p className="text-fg/70">{missing ? e.notFoundText : e.failedText}</p>
      <Link to={localePath(lang, '/')} className="text-fg underline underline-offset-4 hover:text-fg/80">
        {e.home}
      </Link>
    </main>
  )
}
