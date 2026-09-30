import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { Dated } from './layout'

/**
 * Os filtros da trajetória (J64). Uma parada fica à vista quando cobre algum ano do período e tem, em cada grupo com
 * seleção, ao menos uma das tags escolhidas (dentro do grupo vale qualquer uma; entre grupos, todos). O estado mora no
 * endereço (?tools=React&from=2023), para o link filtrado poder ser enviado a alguém.
 */
const GROUPS = ['tools', 'concepts', 'skills'] as const
export type Group = (typeof GROUPS)[number]

interface FilterState {
  from: number
  to: number
  tags: Record<Group, ReadonlySet<string>>
}

interface Bounds {
  min: number
  max: number
}

export function matches(item: Dated, state: FilterState): boolean {
  if (item.to < state.from || item.from > state.to) return false
  return GROUPS.every((g) => {
    const chosen = state.tags[g]
    return !chosen.size || (item.c.tags?.[g] ?? []).some((t) => chosen.has(t))
  })
}

/** O que o estado liga: período fora do inteiro, algum filtro, e as tags escolhidas (que acendem nos cartões). */
export function summary(state: FilterState, bounds: Bounds) {
  const yearsOn = state.from !== bounds.min || state.to !== bounds.max
  const chosen: ReadonlySet<string> = new Set(GROUPS.flatMap((g) => [...state.tags[g]]))
  return { yearsOn, active: yearsOn || chosen.size > 0, chosen }
}

/** O estado que o endereço pede, só com o que existe na página. */
function fromSearch(search: string, bounds: Bounds, known: Record<Group, ReadonlySet<string>>): FilterState {
  const params = new URLSearchParams(search)
  const year = (k: string, fallback: number) => {
    const n = Number(params.get(k))
    return n >= bounds.min && n <= bounds.max ? n : fallback
  }
  const tags = (g: Group) => new Set(params.getAll(g).filter((t) => known[g].has(t)))
  return {
    from: year('from', bounds.min),
    to: year('to', bounds.max),
    tags: { tools: tags('tools'), concepts: tags('concepts'), skills: tags('skills') },
  }
}

/*
 * O endereço como fonte externa do React. No build (e na hidratação) ele é vazio, sem filtro, igual ao HTML
 * pré-renderizado; logo depois, o React relê o endereço de verdade. Voltar e avançar avisam pelo popstate;
 * `replaceState` não avisa ninguém, então avisamos à mão.
 */
const listeners = new Set<() => void>()
function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}
const clientSearch = () => location.search
const serverSearch = () => ''

function write(state: FilterState, bounds: Bounds) {
  const q = new URLSearchParams()
  if (state.from !== bounds.min) q.set('from', String(state.from))
  if (state.to !== bounds.max) q.set('to', String(state.to))
  for (const g of GROUPS) for (const t of state.tags[g]) q.append(g, t)
  const search = q.toString()
  const path = search ? `${location.pathname}?${search}` : location.pathname
  // history.state fica: é a entrada do painel aberto (backToClose), se houver.
  history.replaceState(history.state, '', path + location.hash)
  for (const l of listeners) l()
}

export function useFilters(bounds: Bounds, known: Record<Group, ReadonlySet<string>>) {
  const search = useSyncExternalStore(subscribe, clientSearch, serverSearch)
  const state = useMemo(() => fromSearch(search, bounds, known), [search, bounds, known])

  const toggle = useCallback(
    (g: Group, t: string) => {
      const next = new Set(state.tags[g])
      if (!next.delete(t)) next.add(t)
      write({ ...state, tags: { ...state.tags, [g]: next } }, bounds)
    },
    [state, bounds],
  )
  const setYears = useCallback(
    (a: number, b: number) => {
      write({ ...state, from: Math.min(a, b), to: Math.max(a, b) }, bounds)
    },
    [state, bounds],
  )
  const clearYears = useCallback(() => {
    write({ ...state, from: bounds.min, to: bounds.max }, bounds)
  }, [state, bounds])
  const clear = useCallback(() => {
    write(
      { from: bounds.min, to: bounds.max, tags: { tools: new Set(), concepts: new Set(), skills: new Set() } },
      bounds,
    )
  }, [bounds])

  const { yearsOn, active } = useMemo(() => summary(state, bounds), [state, bounds])

  return { state, toggle, setYears, clearYears, clear, yearsOn, active }
}

export type Filters = ReturnType<typeof useFilters>
