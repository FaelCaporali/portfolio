import { useCallback, useRef, useState, type ReactNode } from 'react'
import { LOCALES, MESSAGES, useLang, type Lang } from '../../i18n/lang'
import { tagLabel } from '../../i18n/tags'
import { cx } from '../../lib/cx'
import { useHydrated } from '../../lib/useHydrated'
import { useDismiss } from '../../ui/useDismiss'
import type { Dated } from './layout'
import { eyebrow } from './parts'
import type { Filters as FilterApi, Group } from './useFilters'

const GROUPS = ['tools', 'concepts', 'skills'] as const satisfies readonly Group[]

type MenuId = 'years' | Group

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
  const lang = useLang()
  const m = MESSAGES[lang].journey

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
      className="filters sticky top-14 z-float border-y border-fg/6 bg-page/85 backdrop-blur-md"
    >
      <div className="relative mx-auto flex max-w-7xl flex-wrap items-center gap-1.5 px-4 py-2 sm:gap-2 sm:px-8 sm:py-2.5 lg:pr-20 xl:pr-60">
        <p className={cx(eyebrow, 'mr-1 hidden text-filter-sm md:block')}>{m.filter}</p>
        <Menu label={m.years} on={filters.yearsOn} {...menu('years')}>
          <div className="grid grid-cols-2 gap-3">
            <YearSelect
              label={m.from}
              years={years}
              value={state.from}
              onChange={(y) => {
                filters.setYears(y, state.to)
              }}
            />
            <YearSelect
              label={m.to}
              years={years}
              value={state.to}
              onChange={(y) => {
                filters.setYears(state.from, y)
              }}
            />
          </div>
        </Menu>
        {GROUPS.map((g) => (
          <Menu key={g} label={m.groups[g]} on={state.tags[g].size > 0} {...menu(g)}>
            <TagPicker group={g} tags={tagsOf(items, g, lang)} filters={filters} lang={lang} />
          </Menu>
        ))}
        <div className="flex flex-wrap gap-1.5">
          {filters.yearsOn && (
            <Chip
              label={`${String(state.from)} – ${String(state.to)}`}
              remove={m.removeFilter}
              onClick={filters.clearYears}
            />
          )}
          {GROUPS.flatMap((g) =>
            [...state.tags[g]].map((t) => (
              <Chip
                key={`${g}:${t}`}
                label={tagLabel(lang, g, t)}
                remove={m.removeFilter}
                onClick={() => {
                  filters.toggle(g, t)
                }}
              />
            )),
          )}
        </div>
        <button
          type="button"
          hidden={!filters.active}
          onClick={filters.clear}
          className="ml-auto min-h-9 text-sm text-fg/70 underline underline-offset-4 hover:text-fg"
        >
          {m.clear}
        </button>
      </div>
    </div>
  )
}

/**
 * Todas as tags de um grupo na jornada, sem repetir, em ordem alfabética do rótulo no idioma, com o rótulo (a tag em
 * si, em inglês, é a do filtro e do endereço).
 */
function tagsOf(items: Dated[], key: Group, lang: Lang): { tag: string; label: string }[] {
  const all = new Set(items.flatMap((i) => i.c.tags?.[key] ?? []))
  return [...all]
    .map((tag) => ({ tag, label: tagLabel(lang, key, tag) }))
    .sort((a, b) => a.label.localeCompare(b.label, LOCALES[lang].tag, { sensitivity: 'base' }))
}

/** Busca e tags de um grupo; a tag escolhida fica pressionada. */
function TagPicker({
  group,
  tags,
  filters,
  lang,
}: {
  group: Group
  tags: { tag: string; label: string }[]
  filters: FilterApi
  lang: Lang
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const m = MESSAGES[lang].journey
  const search = m.search(m.groups[group])
  return (
    <>
      <input
        type="search"
        aria-label={search}
        placeholder={search}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
        }}
        className="w-full rounded-xl border border-fg/10 bg-fg/5 px-3 py-2 text-sm text-fg placeholder:text-fg/40 focus-visible:border-fg/40 focus-visible:outline-none"
      />
      <div role="group" aria-label={m.groups[group]} className="mt-3 flex flex-wrap gap-1.5">
        {tags.map(({ tag, label }) => (
          <button
            key={tag}
            type="button"
            hidden={!!q && !label.toLowerCase().includes(q)}
            aria-pressed={filters.state.tags[group].has(tag)}
            onClick={() => {
              filters.toggle(group, tag)
            }}
            className={cx('tag filter-tag rounded-full px-2.5 py-1 text-xs', `tag-${group}`)}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  )
}

function Chip({ label, remove, onClick }: { label: string; remove: (tag: string) => string; onClick: () => void }) {
  return (
    <button type="button" className="filter-chip" aria-label={remove(label)} onClick={onClick}>
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
        className="flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-full border border-fg/15 px-3 text-filter text-fg/85 transition-colors group-open:border-fg/40 hover:border-fg/35 hover:text-fg focus-visible:outline-2 focus-visible:outline-fg sm:gap-1.5 sm:px-3.5 sm:text-sm [&::-webkit-details-marker]:hidden"
      >
        {label}
        <span aria-hidden hidden={!on} className="h-1.5 w-1.5 rounded-full bg-fg" />
        <span aria-hidden className="text-filter-sm text-fg/50 transition-transform group-open:rotate-180">
          ▼
        </span>
      </summary>
      <div className="absolute inset-x-3 top-full z-popover mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-fg/10 bg-surface p-3 shadow-2xl sm:inset-x-auto sm:left-0 sm:w-80">
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
    <label className="text-xs text-fg/60">
      {label}
      <select
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value))
        }}
        className="mt-1 block w-full rounded-xl border border-fg/10 bg-raised px-3 py-2 text-sm text-fg"
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
