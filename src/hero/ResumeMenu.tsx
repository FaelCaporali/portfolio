import { useCallback, useId, useRef, useState } from 'react'
import { resumes } from '../content/profile'
import { useDismiss } from '../components/useDismiss'

/**
 * Botão do currículo: abre a escolha de idioma e o clique já baixa o PDF.
 * Abre para cima porque no celular os botões ficam no rodapé da tela. Fecha com Esc, clique fora ou após escolher.
 */
export function ResumeMenu({ className }: { className: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, root)

  return (
    <div ref={root} className="relative">
      <button type="button" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((o) => !o)} className={`w-full ${className}`}>
        Résumé
        <svg aria-hidden viewBox="0 0 10 6" className={`h-1.5 w-2.5 text-white/45 transition-transform ${open ? '' : 'rotate-180'}`}>
          <path d="M1 5l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <ul
        id={menuId}
        hidden={!open}
        className="absolute bottom-full left-0 z-10 mb-2 min-w-full overflow-hidden rounded-2xl border border-white/15 bg-[#16161b]/95 py-1 shadow-xl backdrop-blur"
      >
        {resumes.map((r) => (
          <li key={r.href}>
            <a
              href={r.href}
              download
              onClick={close}
              className="flex items-center justify-between gap-3 px-4 py-2 text-sm whitespace-nowrap text-white/80 hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:outline-none"
            >
              {r.label}
              <span aria-hidden className="text-xs text-white/40">PDF ↓</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
