import { useEffect, useRef, useState, type RefObject } from 'react'
import { Link } from 'react-router'
import { mcp } from '../../content/mcp'
import { localePath, useLang } from '../../i18n/lang'
import { McpMark } from '../../ui/McpMark'

/**
 * Recolhe a pílula quando menos da metade da primeira tela está à vista (o herói é h-svh no topo). Só
 * IntersectionObserver, sem evento de rolagem; `intersectionRatio` porque `isIntersecting` já vale acima de 0.
 */
function useCompact(firstScreen: RefObject<Element | null>): boolean {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const el = firstScreen.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries.at(-1)
        if (last) setCompact(last.intersectionRatio < 0.5)
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
    }
  }, [firstScreen])
  return compact
}

/**
 * O ícone do MCP fixo na home (D-MCP14/17/18; .wai/mcp/04-direcao-mcp.md §5): o logo num disco de 40 px no canto
 * superior direito, centrado sob o ícone do código, que leva à /mcp. No lg, a pílula com o rótulo atrás do disco
 * enquanto o herói ocupa metade da tela ou mais; depois, só o disco (reabre no hover e no foco). O disco nunca muda de
 * lugar nem de tamanho: a troca é só de opacidade e deslocamento (index.css: .mcp-fab). Sem JS, a pílula fica aberta no
 * lg, o estado da primeira tela. Camada abaixo do contato: o painel dele cobre o disco onde se encontram.
 */
export function McpLink() {
  const lang = useLang()
  const label = mcp.fab[lang]
  // A primeira tela da página: absoluta no topo do documento (nenhum ancestral posicionado em routes/home.tsx), com a
  // altura do herói.
  const firstScreen = useRef<HTMLDivElement>(null)
  const compact = useCompact(firstScreen)
  return (
    <>
      <div ref={firstScreen} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-svh" />
      <Link
        to={localePath(lang, '/mcp')}
        prefetch="intent"
        aria-label={label}
        data-compact={compact ? '' : undefined}
        className="mcp-fab group fixed top-20 right-3.5 z-float-low flex size-10 items-center justify-center rounded-full border border-fg/20 bg-raised text-fg transition-[border-color,background-color] duration-200 ease-out hover:border-fg/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg motion-reduce:transition-none min-[364px]:top-[3.625rem] sm:right-[2.125rem] lg:border-transparent lg:bg-transparent"
      >
        <span
          aria-hidden
          className="mcp-fab-label absolute -top-px -right-px hidden h-10 items-center rounded-full border border-fg/20 bg-raised pr-12 pl-4 text-sm whitespace-nowrap text-fg/80 transition-[opacity,transform,visibility] duration-200 ease-out group-hover:text-fg motion-reduce:transition-none lg:flex"
        >
          {label} →
        </span>
        <McpMark className="relative size-5" />
      </Link>
    </>
  )
}
