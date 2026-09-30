import { sourceHref } from '../../content/profile'
import { useMessages } from '../../i18n/lang'
import { GitHubMark } from '../../ui/GitHubMark'

/**
 * Atalho para o código do portfólio: só o ícone do GitHub, com nome acessível próprio ("View source on GitHub") para
 * não se confundir com a pílula "GitHub", que leva ao perfil, e longe dela: canto superior direito em todos os
 * tamanhos de tela.
 */
export function SourceLink({ className, iconClassName }: { className: string; iconClassName: string }) {
  const { source, sourceTitle } = useMessages().hero
  return (
    <a
      href={sourceHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={source}
      title={sourceTitle}
      className={className}
    >
      <GitHubMark className={iconClassName} />
    </a>
  )
}
