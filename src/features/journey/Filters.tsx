import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import type { Dated } from './layout'
import { eyebrow } from './parts'

const GROUPS = [
  { key: 'tools', label: 'Tools' },
  { key: 'concepts', label: 'Concepts' },
  { key: 'skills', label: 'Skills' },
] as const

/**
 * A barra de filtros (J64: "range de data, stacks, skills, tools [...] facilitar o trabalho de recrutadores"). O HTML
 * sai pronto do build, com todas as tags da jornada e já no tamanho final (a página não pula quando o script
 * chega): até lá, `aria-busy` deixa os botões em esqueleto (journey.css). Sem JavaScript a página segue inteira.
 * main.ts (filters.ts) liga os controles, esconde as paradas fora do filtro e guarda a escolha no endereço,
 * para o link filtrado poder ser enviado.
 */
export function Filters({ items }: { items: Dated[] }) {
  const first = Math.min(...items.map((i) => i.from))
  const last = Math.max(...items.map((i) => i.to))
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i)
  return (
    <div
      data-filters
      aria-busy="true"
      className="filters sticky top-14 z-20 border-y border-white/[0.06] bg-[#0b0b0e]/85 backdrop-blur-md"
    >
      <div className="relative mx-auto flex max-w-7xl flex-wrap items-center gap-1.5 px-4 py-2 sm:gap-2 sm:px-8 sm:py-2.5 lg:pr-20 xl:pr-60">
        <p className={cx(eyebrow, 'mr-1 hidden text-[0.65rem] md:block')}>Filter the map</p>
        <Menu label="Years">
          <div className="grid grid-cols-2 gap-3">
            <YearSelect label="From" name="from" years={years} value={first} />
            <YearSelect label="To" name="to" years={years} value={last} />
          </div>
        </Menu>
        {GROUPS.map((g) => (
          <Menu key={g.key} label={g.label}>
            <input
              type="search"
              data-filter-search
              aria-label={`Search ${g.label.toLowerCase()}`}
              placeholder={`Search ${g.label.toLowerCase()}`}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus-visible:border-white/40 focus-visible:outline-none"
            />
            <div role="group" aria-label={g.label} className="mt-3 flex flex-wrap gap-1.5">
              {tagsOf(items, g.key).map((t) => (
                <button
                  key={t}
                  type="button"
                  data-filter-tag={t}
                  data-group={g.key}
                  aria-pressed="false"
                  className={cx('tag filter-tag rounded-full px-2.5 py-1 text-xs', `tag-${g.key}`)}
                >
                  {t}
                </button>
              ))}
            </div>
          </Menu>
        ))}
        <div data-filter-chips className="flex flex-wrap gap-1.5" />
        <button
          type="button"
          data-filter-clear
          hidden
          className="ml-auto min-h-9 text-sm text-white/70 underline underline-offset-4 hover:text-white"
        >
          Clear
        </button>
      </div>
    </div>
  )
}

/** Todas as tags de um grupo na jornada, sem repetir, em ordem alfabética. */
function tagsOf(items: Dated[], key: (typeof GROUPS)[number]['key']): string[] {
  const all = new Set(items.flatMap((i) => i.c.tags?.[key] ?? []))
  return [...all].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
}

/**
 * Um menu da barra: `<details>` abre e fecha sem JavaScript; main.ts fecha os outros e fecha com Esc ou clique fora.
 * No celular o painel ocupa a largura da barra; do `sm` para cima, sai embaixo do botão.
 */
function Menu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details data-filter-menu className="group sm:relative">
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-full border border-white/15 px-3 text-[0.8rem] text-white/85 transition-colors group-open:border-white/40 hover:border-white/35 hover:text-white focus-visible:outline-2 focus-visible:outline-white sm:gap-1.5 sm:px-3.5 sm:text-sm [&::-webkit-details-marker]:hidden">
        {label}
        <span aria-hidden data-filter-on hidden className="h-1.5 w-1.5 rounded-full bg-white" />
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

function YearSelect({ label, name, years, value }: { label: string; name: string; years: number[]; value: number }) {
  return (
    <label className="text-xs text-white/60">
      {label}
      <select
        data-filter-year={name}
        defaultValue={value}
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
