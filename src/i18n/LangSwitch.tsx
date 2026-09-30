import { Link, useLocation, useNavigate } from 'react-router'
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE } from '../../shared/i18n'
import { rememberPlace } from './keepPlace'
import { LOCALES, localePath, MESSAGES, otherLang, stripLang, useLang, type Lang } from './lang'

/** A escolha manual fica no cookie `lang` (1 ano): a detecção (Worker e navegador) não a desfaz. */
function saveLang(lang: Lang) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${LANG_COOKIE}=${lang}; Max-Age=${LANG_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`
}

interface Props {
  className: string
  /** Texto por extenso ("Ler em português") em vez da sigla: no menu do mapa do celular. */
  full?: boolean
  /** Antes de navegar (o menu do mapa fecha e troca a entrada dele no histórico pela do destino). */
  onSwitch?: (href: string) => void
  /** A entrada do histórico é substituída, não acrescentada (o menu já tinha a sua). */
  replace?: boolean
}

/**
 * O controle PT/EN: um link para a mesma página no outro idioma (funciona sem JavaScript; hreflang e lang do destino).
 * Com JavaScript, vai pelo roteador sem recarregar: a página não desmonta (a cena 3D segue), a rolagem fica e o marco
 * à vista também (keepPlace), e os filtros da trajetória vão junto (a query, lida na hora: o filtro escreve no
 * endereço sem passar pelo roteador).
 */
export function LangSwitch({ className, full = false, onSwitch, replace = false }: Props) {
  const lang = otherLang(useLang())
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const target = localePath(lang, stripLang(pathname))
  const { short, switchTo } = MESSAGES[lang].lang
  return (
    <Link
      to={{ pathname: target, search }}
      hrefLang={LOCALES[lang].tag}
      lang={LOCALES[lang].tag}
      aria-label={full ? undefined : switchTo}
      title={full ? undefined : switchTo}
      className={className}
      onClick={(e) => {
        saveLang(lang)
        // Nova aba ou janela: o navegador cuida.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        const href = `${target}${window.location.search}`
        rememberPlace()
        onSwitch?.(href)
        void navigate({ pathname: target, search: window.location.search }, { preventScrollReset: true, replace })
      }}
    >
      {full ? switchTo : short}
    </Link>
  )
}
