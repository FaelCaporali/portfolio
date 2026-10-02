import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { localePath, preferredLang, savedLang, stripLang, type Lang } from '../../shared/i18n'

/** Uma vez por carga da página: a detecção não volta a rodar a cada troca de página nem depois da escolha manual. */
let checked = false

/**
 * A mesma regra do Worker (shared/i18n.ts), no navegador, logo depois da hidratação: quem prefere português e abriu o
 * endereço inglês sem escolha salva vai para /pt, pelo roteador, sem recarregar. Cobre o dev (5199), que não passa
 * pelo Worker; em produção o Worker já resolveu no primeiro pedido e aqui nada muda. Endereço /pt nunca volta ao
 * inglês por detecção (link compartilhado vale).
 */
export function useDetectLang(lang: Lang | null) {
  const navigate = useNavigate()
  useEffect(() => {
    if (checked) return
    checked = true
    if (lang !== 'en') return
    // Vinda do próprio site (o controle EN antes da hidratação, sem JS ou em outra aba): a pessoa escolheu o inglês.
    if (document.referrer && new URL(document.referrer).origin === window.location.origin) return
    const languages = navigator.languages.length ? navigator.languages : [navigator.language]
    const target = preferredLang(languages, savedLang(document.cookie))
    if (target === 'en') return
    const { pathname, search, hash } = window.location
    void navigate(
      { pathname: localePath(target, stripLang(pathname)), search, hash },
      { replace: true, preventScrollReset: true },
    )
  }, [lang, navigate])
}
