import { useCallback, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { useDismiss } from '../../ui/useDismiss'
import type { Dated } from './layout'
import { eyebrow } from './parts'
import type { Filters as FilterApi, Group } from './useFilters'

const GROUPS = [
  { key: 'tools', label: 'Tools' },
  { key: 'concepts', label: 'Concepts' },
  { key: 'skills', label: 'Skills' },
] as const satisfies readonly { key: Group; label: string }[]

type MenuId = 'years' | Group

/** Falso no servidor e na hidratação; verdadeiro logo depois (o React renderiza de novo). */
const noSubscribe = () => () => undefined
const useHydrated = () =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  )

/**
 * A barra de filtros (J64: "range de data, stacks, skills, tools [...] facilitar o trabalho de recrutadores"). O HTML
 * sai pronto do build, com todas as tags da jornada e já no tamanho final (a página não pula quando o script chega):
 * até a hidratação, `aria-busy` deixa os botões em esqueleto (journey.css). O estado é do useFilters (no endereço).
 */
export function Filters({ items, filters }: { items: Dated[]; filters: FilterApi }) {
  const first = Math.min(...items.map((i) => i.from))
  const last = Math.max(...items.map((i) => i.to))
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i)
  const hydrated = useHydrated()
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<MenuId | null>(null)

  // Um menu aberto por vez; fecha com clique fora ou Esc, e o foco volta ao botão dele.
  const close = useCallback(() => {
    const el = root.current
    if (el?.contains(document.activeElement)) el.querySelector<HTMLElement>('details[open] > summary')?.focus()
    setOpen(null)
  }, [])
  useDismiss(open !== null, close, root)
  const menu = (id: MenuId) => ({
    open: open === id,
    onToggle: () => {
      setOpen((o) => (o === id ? null : id))
    },
  })

  const { state } = filters
  return (
    <div
      ref={root}
      data-filters
      aria-busy={hydrated ? undefined : true}
      className="filters sticky top-14 z-20 border-y border-white/[0.06] bg-[#0b0b0e]/85 backdrop-blur-md"
    >
      <div className="relative mx-auto flex max-w-7xl flex-wrap items-center gap-1.5 px-4 py-2 sm:gap-2 sm:px-8 sm:py-2.5 lg:pr-20 xl:pr-60">
        <p className={cx(eyebrow, 'mr-1 hidden text-[0.65rem] md:block')}>Filter the map</p>
        <Menu label="Years" on={filters.yearsOn} {...menu('years')}>
          <div className="grid grid-cols-2 gap-3">
            <YearSelect
              label="From"
              years={years}
              value={state.from}
              onChange={(y) => {
                filters.setYears(y, state.to)
              }}
            />
            <YearSelect
              label="To"
              years={years}
              value={state.to}
              onChange={(y) => {
                filters.setYears(state.from, y)
              }}
            />
          </div>
        </Menu>
        {GROUPS.map((g) => (
          <Menu key={g.key} label={g.label} on={state.tags[g.key].size > 0} {...menu(g.key)}>
            <TagPicker group={g} tags={tagsOf(items, g.key)} filters={filters} />
          </Menu>
        ))}
        <div className="flex flex-wrap gap-1.5">
          {filters.yearsOn && (
            <Chip label={`${String(state.from)} – ${String(state.to)}`} onClick={filters.clearYears} />
          )}
          {GROUPS.flatMap((g) =>
            [...state.tags[g.key]].map((t) => (
              <Chip
                key={`${g.key}:${t}`}
                label={t}
                onClick={() => {
                  filters.toggle(g.key, t)
                }}
              />
            )),
          )}
        </div>
        <button
          type="button"
          hidden={!filters.active}
          onClick={filters.clear}
          className="ml-auto min-h-9 text-sm text-white/70 underline underline-offset-4 hover:text-white"
        >
          Clear
        </button>
      </div>
    </div>
  )
}

/** Todas as tags de um grupo na jornada, sem repetir, em ordem alfabética. */
function tagsOf(items: Dated[], key: Group): string[] {
  const all = new Set(items.flatMap((i) => i.c.tags?.[key] ?? []))
  return [...all].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
}

/** Busca e tags de um grupo; a tag escolhida fica pressionada. */
function TagPicker({ group, tags, filters }: { group: (typeof GROUPS)[number]; tags: string[]; filters: FilterApi }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const name = group.label.toLowerCase()
  return (
    <>
      <input
        type="search"
        aria-label={`Search ${name}`}
        placeholder={`Search ${name}`}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
        }}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus-visible:border-white/40 focus-visible:outline-none"
      />
      <div role="group" aria-label={group.label} className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            hidden={!!q && !t.toLowerCase().includes(q)}
            aria-pressed={filters.state.tags[group.key].has(t)}
            onClick={() => {
              filters.toggle(group.key, t)
            }}
            className={cx('tag filter-tag rounded-full px-2.5 py-1 text-xs', `tag-${group.key}`)}
          >
            {t}
          </button>
        ))}
      </div>
    </>
  )
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="filter-chip" aria-label={`Remove filter: ${label}`} onClick={onClick}>
      {`${label} ×`}
    </button>
  )
}

/**
 * Um menu da barra: `<details>` (abre e fecha mesmo sem JavaScript), aberto pelo estado da barra. No celular o painel
 * ocupa a largura da barra; do `sm` para cima, sai embaixo do botão. `on`: o ponto de filtro ativo no botão.
 */
function Menu({
  label,
  on,
  open,
  onToggle,
  children,
}: {
  label: string
  on: boolean
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <details data-filter-menu open={open} className="group sm:relative">
      <summary
        onClick={(e) => {
          e.preventDefault()
          onToggle()
        }}
        className="flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-full border border-white/15 px-3 text-[0.8rem] text-white/85 transition-colors group-open:border-white/40 hover:border-white/35 hover:text-white focus-visible:outline-2 focus-visible:outline-white sm:gap-1.5 sm:px-3.5 sm:text-sm [&::-webkit-details-marker]:hidden"
      >
        {label}
        <span aria-hidden hidden={!on} className="h-1.5 w-1.5 rounded-full bg-white" />
        <span aria-hidden className="text-[0.65rem] text-white/50 transition-transform group-open:rotate-180">
          ▼
        </span>
      </summary>
      <div className="absolute inset-x-3 top-full z-10 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#111116] p-3 shadow-2xl sm:inset-x-auto sm:left-0 sm:w-80">
        {children}
      </div>
    </details>
  )
}

function YearSelect({
  label,
  years,
  value,
  onChange,
}: {
  label: string
  years: number[]
  value: number
  onChange: (year: number) => void
}) {
  return (
    <label className="text-xs text-white/60">
      {label}
      <select
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value))
        }}
        className="mt-1 block w-full rounded-xl border border-white/10 bg-[#16161b] px-3 py-2 text-sm text-white"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  )
}
