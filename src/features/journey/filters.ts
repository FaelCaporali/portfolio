/**
 * A barra de filtros (J64), ligada aqui; o HTML dela vem pronto do build (Filters.tsx). Uma parada fica à vista quando
 * cobre algum ano do período escolhido e tem, em cada grupo com seleção, ao menos uma das tags escolhidas (dentro do
 * grupo vale qualquer uma; entre grupos, todos). A escolha vai para o endereço (?tools=React&from=2023), para o link
 * filtrado poder ser enviado a alguém.
 */
const GROUPS = ['tools', 'concepts', 'skills'] as const
type Group = (typeof GROUPS)[number]

interface State {
  from: number
  to: number
  tags: Record<Group, Set<string>>
}

interface Bar {
  root: HTMLElement
  fromSel: HTMLSelectElement
  toSel: HTMLSelectElement
  min: number
  max: number
}

const isGroup = (g: string | undefined): g is Group => GROUPS.includes(g as Group)

export function initFilters(onChange: () => void) {
  const root = document.querySelector<HTMLElement>('[data-filters]')
  const fromSel = root?.querySelector<HTMLSelectElement>('[data-filter-year="from"]')
  const toSel = root?.querySelector<HTMLSelectElement>('[data-filter-year="to"]')
  if (!root || !fromSel || !toSel) return
  const min = Number(fromSel.options[0]?.value)
  const max = Number(toSel.options[toSel.options.length - 1]?.value)
  root.hidden = false
  setup({ root, fromSel, toSel, min, max }, onChange)
}

/** O estado inicial vem do endereço, só com o que existe na barra. */
function fromUrl(bar: Bar, buttons: HTMLButtonElement[]): State {
  const params = new URLSearchParams(location.search)
  const known = new Set(buttons.map((b) => `${b.dataset.group ?? ''}:${b.dataset.filterTag ?? ''}`))
  const tags: State['tags'] = { tools: new Set(), concepts: new Set(), skills: new Set() }
  for (const g of GROUPS) {
    for (const t of params.getAll(g)) if (known.has(`${g}:${t}`)) tags[g].add(t)
  }
  const year = (k: string, fallback: number) => {
    const n = Number(params.get(k))
    return n >= bar.min && n <= bar.max ? n : fallback
  }
  return { from: year('from', bar.min), to: year('to', bar.max), tags }
}

function toUrl(bar: Bar, state: State) {
  const q = new URLSearchParams()
  if (state.from !== bar.min) q.set('from', String(state.from))
  if (state.to !== bar.max) q.set('to', String(state.to))
  for (const g of GROUPS) for (const t of state.tags[g]) q.append(g, t)
  const search = q.toString()
  const path = search ? `${location.pathname}?${search}` : location.pathname
  history.replaceState(null, '', path + location.hash)
}

function matches(li: HTMLElement, state: State) {
  if (Number(li.dataset.to) < state.from || Number(li.dataset.from) > state.to) return false
  return GROUPS.every((g) => {
    const chosen = state.tags[g]
    return !chosen.size || (li.dataset[g] ?? '').split('|').some((t) => chosen.has(t))
  })
}

/**
 * Esconde as paradas fora do filtro e devolve os ids delas. O ano grande passa para a primeira parada à vista de cada
 * ano; a tag que casa com o filtro acende no cartão.
 */
function applyToMarks(marks: HTMLElement[], state: State): Set<string> {
  const chosen = new Set(GROUPS.flatMap((g) => [...state.tags[g]]))
  const out = new Set<string>()
  let last: string | undefined
  for (const li of marks) {
    li.hidden = !matches(li, state)
    if (li.hidden) out.add(li.id)
    for (const t of li.querySelectorAll<HTMLElement>('[data-tag]')) {
      t.classList.toggle('is-match', chosen.has(t.dataset.tag ?? ''))
    }
    const y = li.dataset.year
    const shows = !li.hidden && !!y
    li.classList.toggle('year-first', shows && y !== last)
    if (shows) last = y
  }
  return out
}

function chip(label: string, onClick: () => void) {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'filter-chip'
  b.setAttribute('aria-label', `Remove filter: ${label}`)
  b.textContent = `${label} ×`
  b.addEventListener('click', onClick)
  return b
}

function setup(bar: Bar, onChange: () => void) {
  const { root, fromSel, toSel, min, max } = bar
  const marks = [...document.querySelectorAll<HTMLElement>('[data-checkpoint]')]
  const sections = [...document.querySelectorAll<HTMLElement>('.timeline section')]
  const menus = [...root.querySelectorAll<HTMLDetailsElement>('[data-filter-menu]')]
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-filter-tag]')]
  const chips = root.querySelector<HTMLElement>('[data-filter-chips]')
  const clears = [...document.querySelectorAll<HTMLButtonElement>('[data-filter-clear]')]
  const empty = document.querySelector<HTMLElement>('[data-filter-empty]')
  const minis = [...document.querySelectorAll<HTMLElement>('[data-mini]')]
  const state = fromUrl(bar, buttons)

  const yearsOn = () => state.from !== min || state.to !== max
  const active = () => yearsOn() || GROUPS.some((g) => state.tags[g].size > 0)

  function renderControls() {
    for (const b of buttons) {
      const g = b.dataset.group
      b.setAttribute('aria-pressed', String(isGroup(g) && state.tags[g].has(b.dataset.filterTag ?? '')))
    }
    fromSel.value = String(state.from)
    toSel.value = String(state.to)
    for (const m of menus) {
      const dot = m.querySelector<HTMLElement>('[data-filter-on]')
      const on = m.contains(fromSel) ? yearsOn() : !!m.querySelector('[aria-pressed="true"]')
      if (dot) dot.hidden = !on
    }
    for (const c of clears) if (root.contains(c)) c.hidden = !active()
  }

  function renderChips() {
    const items: HTMLButtonElement[] = []
    if (yearsOn()) {
      items.push(
        chip(`${String(state.from)} – ${String(state.to)}`, () => {
          state.from = min
          state.to = max
          render()
        }),
      )
    }
    for (const g of GROUPS) {
      for (const t of state.tags[g]) {
        items.push(
          chip(t, () => {
            state.tags[g].delete(t)
            render()
          }),
        )
      }
    }
    chips?.replaceChildren(...items)
  }

  function render() {
    const out = applyToMarks(marks, state)
    for (const s of sections) s.hidden = !s.querySelector('[data-checkpoint]:not([hidden])')
    if (empty) empty.hidden = out.size < marks.length
    for (const a of minis) a.classList.toggle('is-out', out.has(a.dataset.mini ?? ''))
    renderControls()
    renderChips()
    toUrl(bar, state)
    onChange()
  }

  for (const b of buttons) {
    b.addEventListener('click', () => {
      const g = b.dataset.group
      const t = b.dataset.filterTag ?? ''
      if (!isGroup(g)) return
      if (!state.tags[g].delete(t)) state.tags[g].add(t)
      render()
    })
  }
  for (const sel of [fromSel, toSel]) {
    sel.addEventListener('change', () => {
      const a = Number(fromSel.value)
      const b = Number(toSel.value)
      state.from = Math.min(a, b)
      state.to = Math.max(a, b)
      render()
    })
  }
  for (const c of clears) {
    c.addEventListener('click', () => {
      state.from = min
      state.to = max
      for (const g of GROUPS) state.tags[g].clear()
      render()
    })
  }
  wireMenus(root, menus)
  if (active()) render()
}

/** Busca dentro de cada menu; um menu aberto por vez; fecha com clique fora ou Esc. */
function wireMenus(root: HTMLElement, menus: HTMLDetailsElement[]) {
  for (const input of root.querySelectorAll<HTMLInputElement>('[data-filter-search]')) {
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase()
      for (const b of input.parentElement?.querySelectorAll<HTMLButtonElement>('[data-filter-tag]') ?? []) {
        b.hidden = !!q && !(b.dataset.filterTag ?? '').toLowerCase().includes(q)
      }
    })
  }
  for (const m of menus) {
    m.addEventListener('toggle', () => {
      if (m.open) for (const other of menus) if (other !== m) other.open = false
    })
  }
  document.addEventListener('click', (e) => {
    if (e.target instanceof Node && !root.contains(e.target)) for (const m of menus) m.open = false
  })
  document.addEventListener('keydown', (e) => {
    const open = menus.find((m) => m.open)
    if (e.key !== 'Escape' || !open) return
    open.open = false
    open.querySelector('summary')?.focus()
  })
}
