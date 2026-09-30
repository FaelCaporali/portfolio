import { createContext, use } from 'react'
import type { Lang } from '../../shared/i18n'
import { en, type Messages } from './messages/en'
import { pt } from './messages/pt'

export { langFromPath, localePath, stripLang, type Lang } from '../../shared/i18n'

/**
 * O idioma da página: BCP-47 do <html lang> e do hreflang, o og:locale e o idioma do Turnstile. A fonte única dos
 * dois idiomas; as mensagens moram em messages/ (en.ts é o contrato de tipo do pt.ts).
 */
export const LOCALES: Record<Lang, { tag: string; og: string; turnstile: string }> = {
  en: { tag: 'en', og: 'en_US', turnstile: 'en' },
  pt: { tag: 'pt-BR', og: 'pt_BR', turnstile: 'pt-br' },
}

export const MESSAGES: Record<Lang, Messages> = { en, pt }

/** O outro idioma: o destino do controle PT/EN. */
export const otherLang = (lang: Lang): Lang => (lang === 'en' ? 'pt' : 'en')

/**
 * O parâmetro opcional da rota (src/routes.ts, `:lang?`): ausente = inglês, "pt" = português, qualquer outro = página
 * que não existe (null).
 */
export function langFromParam(param: string | undefined): Lang | null {
  if (param === undefined) return 'en'
  return param === 'pt' ? 'pt' : null
}

/**
 * O idioma da página, dado pela rota de layout (src/routes/lang.tsx) a partir do parâmetro. Fora dela (testes de um
 * componente sozinho), inglês.
 */
export const LangContext = createContext<Lang>('en')

export const useLang = (): Lang => use(LangContext)
export const useMessages = (): Messages => MESSAGES[useLang()]
