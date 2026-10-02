/**
 * A troca de idioma na trajetória muda o comprimento dos textos: sem ajuste, a mesma rolagem mostraria outro marco. O
 * controle anota o marco à vista antes de trocar (remember) e a página o devolve ao mesmo ponto da tela no commit do
 * idioma novo, antes da pintura (restore, JourneyPage). Na página sem marcos (o herói), nada a fazer.
 */
let pending: { id: string; top: number } | null = null

const shown = (el: Element) => !el.closest('[hidden]')

export function rememberPlace() {
  const marks = [...document.querySelectorAll<HTMLElement>('[data-checkpoint]')].filter(shown)
  const middle = window.innerHeight / 2
  const mark = marks.filter((el) => el.getBoundingClientRect().top < middle).at(-1) ?? marks[0]
  pending = mark && window.scrollY > 0 ? { id: mark.id, top: mark.getBoundingClientRect().top } : null
}

export function restorePlace() {
  const place = pending
  pending = null
  const mark = place && document.getElementById(place.id)
  if (!place || !mark) return
  window.scrollBy({ top: mark.getBoundingClientRect().top - place.top, behavior: 'instant' })
}
