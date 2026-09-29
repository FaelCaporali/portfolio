import { periodLabel } from '../../content/journey-timeline'
import { cx } from '../../lib/cx'
import type { Part } from './Intro'
import type { Lane, Placed } from './layout'
import { eyebrow } from './parts'

/**
 * O minimapa (J52: "imprescindível"): a jornada inteira numa coluna, com o caminho sinuoso da página em
 * miniatura e cada marco clicável. Desenhado no build (as posições saem das faixas do layout, não da página),
 * então funciona sem JavaScript; main.ts só acende o marco em leitura e o trecho já lido.
 * Desktop: fixo à direita (do `xl` para cima, com rótulos). Celular e tablet: uma barra no pé da tela que abre o
 * índice.
 */

export type Row = { kind: 'part'; part: Part } | { kind: 'mark'; item: Placed }

/** Largura da miniatura e o x de cada faixa nela (em px: o SVG tem 44 px de largura). */
const W = 44
const X: Record<Lane, number> = { left: 11, right: 33, wide: 22 }
const DOT: Record<Lane, string> = { left: 'left-[11px]', right: 'left-[33px]', wide: 'left-[22px]' }
/** Altura de cada linha no desenho; na tela as linhas dividem a altura da coluna por igual (flex-1). */
const ROW = 10

function markId(item: Placed) {
  return item.life?.id ?? item.c.id
}

function year(item: Placed) {
  const p = item.c.period
  return p?.start?.slice(0, 4) ?? p?.end?.slice(0, 4) ?? ''
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

export function Minimap({ rows }: { rows: Row[] }) {
  const segs = segments(rows)
  return (
    <>
      <nav
        aria-label="Journey map"
        className="minimap fixed top-20 right-3 bottom-6 z-20 hidden max-h-[44rem] lg:flex xl:right-6"
      >
        <div className="relative flex min-h-0 flex-1">
          <svg
            aria-hidden
            className="absolute inset-y-0 left-0 h-full"
            width={W}
            viewBox={`0 0 ${W} ${rows.length * ROW}`}
            preserveAspectRatio="none"
          >
            {segs.map((s) => (
              <path key={s.id} d={s.d} data-mini-seg={s.id} className={cx('mini-seg', s.scope && `life-${s.scope}`)} />
            ))}
          </svg>
          <ol className="relative flex min-h-0 flex-1 flex-col">
            {rows.map((r) =>
              r.kind === 'part' ? (
                <li key={r.part.id} className="flex min-h-0 flex-1 items-center pl-14">
                  <a href={`#${r.part.id}`} className={cx(eyebrow, 'hidden text-[0.6rem] hover:text-white xl:inline')}>
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
                    data-mini={markId(r.item)}
                    title={[periodLabel(r.item.c), r.item.c.title.en].filter(Boolean).join(' · ')}
                    className="mini-link group flex h-full min-h-0 w-full items-center pl-14 focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <span
                      aria-hidden
                      className={cx(
                        'mini-dot absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--accent)',
                        DOT[r.item.lane],
                        r.item.c.focus ? 'h-2.5 w-2.5' : 'h-1.5 w-1.5',
                      )}
                    />
                    <span className="mini-label hidden max-w-[10rem] truncate text-[0.7rem] text-white/50 group-hover:text-white xl:inline">
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
      <IndexSheet rows={rows} />
    </>
  )
}

/** Celular e tablet: a barra no pé da tela mostra o marco em leitura (main.ts) e abre o índice inteiro. */
function IndexSheet({ rows }: { rows: Row[] }) {
  return (
    <details className="index-sheet fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-white/10 bg-[#0b0b0e]/90 backdrop-blur-md lg:hidden">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 text-sm text-white/85 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-(--accent)" />
        <span data-index-current className="min-w-0 truncate">
          Journey map
        </span>
        <span className="ml-auto shrink-0 text-xs text-white/55">Index</span>
      </summary>
      <ol className="max-h-[60vh] overflow-y-auto border-t border-white/10 px-2 py-2">
        {rows.map((r) =>
          r.kind === 'part' ? (
            <li key={r.part.id} className={cx(eyebrow, 'px-3 pt-3 pb-1 text-[0.62rem]')}>
              {r.part.title}
            </li>
          ) : (
            <li key={markId(r.item)} className={cx(r.item.scope && `life-${r.item.scope.id}`)}>
              <a
                href={`#${markId(r.item)}`}
                data-mini={markId(r.item)}
                className="mini-link flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-white/75 hover:bg-white/5"
              >
                <span aria-hidden className="mini-dot h-2 w-2 shrink-0 rounded-full bg-(--accent)" />
                <span className="w-10 shrink-0 text-xs text-white/50 tabular-nums">{year(r.item)}</span>
                <span className="min-w-0 truncate">{r.item.c.title.en}</span>
              </a>
            </li>
          ),
        )}
      </ol>
    </details>
  )
}
