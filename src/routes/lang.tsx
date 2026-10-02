import { Outlet, useParams } from 'react-router'
import { LangContext, langFromParam } from '../i18n/lang'
import { useDetectLang } from '../i18n/useDetectLang'
import { ErrorPage } from '../ui/ErrorPage'

/**
 * A rota de layout do idioma (src/routes.ts, `:lang?`): dá o idioma do endereço às páginas (useLang) e roda a detecção
 * do navegador uma vez. Um segmento que não é idioma (/xx, /xx/journey) é endereço que não existe: "Page not found",
 * como o de qualquer outro (o Worker já responde 404, porque o build não tem esse arquivo).
 */
export default function LangLayout() {
  const lang = langFromParam(useParams().lang)
  useDetectLang(lang)
  if (!lang) return <ErrorPage lang="en" missing />
  return (
    <LangContext value={lang}>
      <Outlet />
    </LangContext>
  )
}
