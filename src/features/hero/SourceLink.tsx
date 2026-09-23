import { sourceLink } from '../../content/profile'
import { GitHubMark } from '../../ui/GitHubMark'

/**
 * Atalho para o código do portfólio: só o ícone do GitHub, com nome acessível próprio ("View source on GitHub") para
 * não se confundir com a pílula "GitHub", que leva ao perfil. A posição vem de quem usa (canto no largo, junto das
 * pílulas no celular).
 */
export function SourceLink({ className, iconClassName }: { className: string; iconClassName: string }) {
  return (
    <a
      href={sourceLink.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={sourceLink.label}
      title="View source"
      className={className}
    >
      <GitHubMark className={iconClassName} />
    </a>
  )
}
