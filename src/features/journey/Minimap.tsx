import { useEffect } from 'react'
import { periodLabel } from '../../content/journey-timeline'
import { cx } from '../../lib/cx'
import { usePopover } from '../../ui/usePopover'
import type { Part } from './Intro'
import type { Lane, Placed } from './layout'
import { eyebrow } from './parts'

/**
 * O minimapa (J52: "imprescindível"): a jornada inteira numa coluna, com o caminho sinuoso da página em
 * miniatura e cada marco clicável. Desenhado no build (as posições saem das faixas do layout, não da página),
 * então funciona sem JavaScript; com ele, acende o marco em leitura e o trecho já lido, e apaga o que o filtro tirou.
 * Desktop: fixo à direita (do `xl` para cima, com rótulos). Celular e tablet: um menu no canto de cima à direita do
 * cabeçalho (IndexSheet), que abre o índice e fecha quando perde o foco.
 */

export type Row = { kind: 'part'; part: Part } | { kind: 'mark'; item: Placed }

/** Largura da miniatura e o x de cada faixa nela (em px: o SVG tem 44 px de largura). */
const W = 44
const X: Record<Lane, number> = { left: 11, right: 33, wide: 22 }
const DOT: Record<Lane, string> = { left: 'left-[11px]', right: 'left-[33px]', wide: 'left-[22px]' }
/** Altura de cada linha no desenho; na tela as linhas dividem a altura da coluna por igual (flex-1). */
const ROW = 10

export function markId(item: Placed) {
  return item.life?.id ?? item.c.id
}

function year(item: Placed) {
  return item.year ?? ''
}

/** Os trechos do caminho em miniatura, de marco em marco, cada um na cor da vida de destino. */
function segments(rows: Row[]) {
  const pts = rows.flatMap((r, i) => (r.kind === 'mark' ? [{ x: X[r.item.lane], y: i * ROW + ROW / 2, r }] : []))
  return pts.slice(1).map((b, i) => {
    const a = pts[i] ?? b
    const k = (b.y - a.y) / 2
    return {
      id: markId(b.r.item),
      scope: b.r.item.scope?.id,
      d: `M${a.x} ${a.y} C${a.x} ${a.y + k} ${b.x} ${b.y - k} ${b.x} ${b.y}`,
    }
  })
}

/** O estado que o mapa mostra: as paradas fora do filtro e o marco em leitura. */
interface MapState {
  out: ReadonlySet<string>
  current: string | undefined
}

export function Minimap({ rows, out, current }: { rows: Row[] } & MapState) {
  const segs = segments(rows)
  // Os trechos até o marco em leitura ficam acesos.
  const read = segs.findIndex((s) => s.id === current)
  return (
    <>
      <nav
        aria-label="Journey map"
        className="minimap fixed top-20 right-3 bottom-28 z-float hidden max-h-[44rem] lg:flex xl:right-6"
      >
        <div className="relative flex min-h-0 flex-1">
          <svg
            aria-hidden
            className="absolute inset-y-0 left-0 h-full"
            width={W}
            viewBox={`0 0 ${W} ${rows.length * ROW}`}
            preserveAspectRatio="none"
          >
            {segs.map((s, i) => (
              <path
                key={s.id}
                d={s.d}
                className={cx('mini-seg', s.scope && `life-${s.scope}`, i <= read && 'is-read')}
              />
            ))}
          </svg>
          <ol className="relative flex min-h-0 flex-1 flex-col">
            {rows.map((r) =>
              r.kind === 'part' ? (
                <li key={r.part.id} className="flex min-h-0 flex-1 items-center pl-14">
                  <a href={`#${r.part.id}`} className={cx(eyebrow, 'hidden text-eyebrow-xs hover:text-fg xl:inline')}>
                    {r.part.title}
                  </a>
                </li>
              ) : (
                <li
                  key={markId(r.item)}
                  className={cx('relative flex min-h-0 flex-1 items-center', r.item.scope && `life-${r.item.scope.id}`)}
                >
                  <a
                    href={`#${markId(r.item)}`}
                    aria-current={markId(r.item) === current ? 'location' : undefined}
                    title={[periodLabel(r.item.c), r.item.c.title.en].filter(Boolean).join(' · ')}
                    className={cx(
                      'mini-link group flex h-full min-h-0 w-full items-center pl-14 focus-visible:outline-2 focus-visible:outline-fg',
                      out.has(markId(r.item)) && 'is-out',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cx(
                        'mini-dot absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--accent)',
                        DOT[r.item.lane],
                        r.item.c.focus ? 'h-2.5 w-2.5' : 'h-1.5 w-1.5',
                      )}
                    />
                    <span className="mini-label hidden max-w-[10rem] truncate text-minimap text-fg/50 group-hover:text-fg xl:inline">
                      <span className="inline-block w-8 tabular-nums">{year(r.item)}</span>
                      {r.item.c.title.en}
                    </span>
                  </a>
                </li>
              ),
            )}
          </ol>
        </div>
      </nav>
    </>
  )
}

/**
 * Como a navegação por #: o próximo Tab parte do marco escolhido, não do botão do menu. O marco só recebe o foco
 * (tabindex -1 até perdê-lo, sem anel: journey.css), sem virar parada do Tab.
 */
function focusMark(mark: HTMLElement) {
  mark.tabIndex = -1
  mark.addEventListener(
    'blur',
    () => {
      mark.removeAttribute('tabindex')
    },
    { once: true },
  )
  mark.focus({ preventScroll: true })
}

/**
 * Celular e tablet: o botão de menu no cabeçalho (Frame) abre o índice inteiro, com o marco em leitura no topo. Fecha
 * quando o foco sai dele, com um toque fora, com Esc, ou ao escolher um marco (a entrada do menu no histórico, J85,
 * vira a do marco: o voltar seguinte sai dele). O canto de baixo fica livre para o contato.
 */
export function IndexSheet({ rows, out, current, label }: { rows: Row[]; label: string | undefined } & MapState) {
  const { open, close, closeTo, root, panelId, triggerProps } = usePopover()
  // O foco saiu do menu (Tab, outro campo): fecha.
  useEffect(() => {
    const el = root.current
    if (!open || !el) return
    const onOut = (e: FocusEvent) => {
      if (!(e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) close()
    }
    el.addEventListener('focusout', onOut)
    return () => {
      el.removeEventListener('focusout', onOut)
    }
  }, [open, close, root])
  return (
    <div ref={root} className="index-sheet relative justify-self-end lg:hidden">
      <button
        {...triggerProps}
        aria-label="Journey map"
        className={cx(
          'grid h-9 w-9 cursor-pointer place-items-center rounded-full border text-fg/85 transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-fg',
          open ? 'border-fg/40' : 'border-fg/15',
        )}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} />
        </svg>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute top-full right-0 mt-3 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-fg/10 bg-page/95 shadow-2xl backdrop-blur-md"
      >
        <p className="flex items-center gap-3 border-b border-fg/10 px-4 py-3 text-sm text-fg/85">
          <span aria-hidden className="accent-fade h-2 w-2 shrink-0 rounded-full bg-(--accent)" />
          <span className="min-w-0 truncate">{label ?? 'Journey map'}</span>
        </p>
        <ol className="max-h-[70vh] overflow-y-auto px-2 py-2">
          {rows.map((r) =>
            r.kind === 'part' ? (
              <li key={r.part.id} className={cx(eyebrow, 'px-3 pt-3 pb-1 text-eyebrow-sm')}>
                {r.part.title}
              </li>
            ) : (
              <li key={markId(r.item)} className={cx(r.item.scope && `life-${r.item.scope.id}`)}>
                <a
                  href={`#${markId(r.item)}`}
                  aria-current={markId(r.item) === current ? 'location' : undefined}
                  onClick={(e) => {
                    e.preventDefault()
                    const mark = document.getElementById(markId(r.item))
                    closeTo(`#${markId(r.item)}`)
                    if (!mark) return
                    focusMark(mark)
                    mark.scrollIntoView()
                  }}
                  className={cx(
                    'mini-link flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-fg/75 hover:bg-fg/5',
                    out.has(markId(r.item)) && 'is-out',
                  )}
                >
                  <span aria-hidden className="mini-dot h-2 w-2 shrink-0 rounded-full bg-(--accent)" />
                  <span className="w-10 shrink-0 text-xs text-fg/50 tabular-nums">{year(r.item)}</span>
                  <span className="min-w-0 truncate">{r.item.c.title.en}</span>
                </a>
              </li>
            ),
          )}
        </ol>
      </div>
    </div>
  )
}
