import { resumes } from '../../content/profile'
import { cx } from '../../lib/cx'
import { usePopover } from '../../ui/usePopover'

/**
 * Botão do currículo: abre a escolha de idioma e o clique já baixa o PDF.
 * Abre para cima porque no celular os botões ficam no rodapé da tela. Fecha com Esc, clique fora ou após escolher.
 */
export function ResumeMenu({ className }: { className: string }) {
  const { open, close, root, panelId, triggerProps } = usePopover()

  return (
    <div ref={root} className="relative">
      <button {...triggerProps} className={cx('w-full', className)}>
        Résumé
        <svg
          aria-hidden
          viewBox="0 0 10 6"
          className={cx('h-1.5 w-2.5 text-fg/45 transition-transform', !open && 'rotate-180')}
        >
          <path
            d="M1 5l4-4 4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <ul
        id={panelId}
        hidden={!open}
        className="absolute bottom-full left-0 z-popover mb-2 min-w-full overflow-hidden rounded-2xl border border-fg/15 bg-raised/95 py-1 shadow-xl backdrop-blur"
      >
        {resumes.map((r) => (
          <li key={r.href}>
            <a
              href={r.href}
              download
              onClick={close}
              className="flex items-center justify-between gap-3 px-4 py-2 text-sm whitespace-nowrap text-fg/80 hover:bg-fg/10 hover:text-fg focus-visible:bg-fg/10 focus-visible:outline-none"
            >
              {r.label}
              <span aria-hidden className="text-xs text-fg/40">
                PDF ↓
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
