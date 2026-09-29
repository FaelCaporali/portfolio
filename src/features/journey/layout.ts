import type { Stage } from '../../content/journey'
import type { Checkpoint } from '../../content/journey-timeline'

/**
 * Onde cada marco fica no mapa (J52: "cada elemento em um canto [...] contínua mas tortuosa"). No desktop os marcos
 * comuns alternam entre a metade esquerda e a direita, e o de foco ocupa a largura; o caminho sinuoso que main.ts
 * desenha liga um ao outro. Tudo decidido no build: o HTML já sai com as classes certas.
 */
export type Lane = 'left' | 'right' | 'wide'

interface Item {
  c: Checkpoint
  /** A vida em leitura neste marco (a última que começou até aqui). */
  scope?: Stage
  /** A vida que começa neste marco. */
  life?: Stage
}

export interface Dated extends Item {
  /** O ano em que a parada começa. */
  year?: string
  /**
   * A primeira parada do ano: o ano grande aparece no caminho, antes dela, uma vez só (J61: "2021 [...] alocada entre
   * uber e estudos", sem "muitos 2025 repetidos"). Com filtro, main.ts refaz a conta sobre as paradas à vista.
   */
  yearFirst: boolean
  /** Os anos que a parada cobre, para o filtro de período (main.ts). */
  from: number
  to: number
}

export interface Placed extends Dated {
  lane: Lane
}

const NOW = new Date().getFullYear()

function yearNum(d: string | undefined) {
  return d && d !== 'present' ? Number(d.slice(0, 4)) : undefined
}

/**
 * O ano e o intervalo de cada parada, na ordem da jornada inteira (as duas partes). O ano grande é sempre o do início:
 * a vela só tem o fim (2020), e marcar 2020 antes dela diria que ela começou ali (J62). Sem início conhecido, a parada
 * começa onde a anterior começou (os brownies e a vela correram junto com a Immersus), só para o filtro de período.
 */
export function date<T extends Item>(items: T[]): (T & Dated)[] {
  let prev = { from: NOW, to: NOW }
  let last: string | undefined
  return items.map((item) => {
    const p = item.c.period
    const first = yearNum(p?.start)
    const from = first ?? prev.from
    const end = p?.end === 'present' ? NOW : yearNum(p?.end)
    const to = end ?? (first === undefined ? prev.to : from)
    const year = first === undefined ? undefined : String(first)
    const yearFirst = !!year && year !== last
    if (year) last = year
    prev = { from, to }
    return { ...item, year, yearFirst, from, to }
  })
}

export function place<T extends Dated>(items: T[]): (T & Placed)[] {
  let side: 'left' | 'right' = 'right'
  return items.map((item) => {
    let lane: Lane = 'wide'
    if (!item.c.focus) {
      side = side === 'left' ? 'right' : 'left'
      lane = side
    }
    return { ...item, lane }
  })
}
