import type { Stage } from '../../content/journey'
import type { Checkpoint } from '../../content/journey-timeline'

/**
 * Onde cada marco fica no mapa (J52: "cada elemento em um canto [...] contínua mas tortuosa"). No desktop os marcos
 * comuns alternam entre a metade esquerda e a direita, e o de foco ocupa a largura; o caminho sinuoso que main.ts
 * desenha liga um ao outro. Tudo decidido no build: o HTML já sai com as classes certas.
 */
export type Lane = 'left' | 'right' | 'wide'

export interface Placed {
  c: Checkpoint
  /** A vida em leitura neste marco (a última que começou até aqui). */
  scope?: Stage
  /** A vida que começa neste marco. */
  life?: Stage
  lane: Lane
  /**
   * O marcador grande de cada parada (J58: "marcos precisam de destaque similar"): o nome da vida quando uma vida
   * começa aqui (Checkpoint.tsx); nos outros marcos, o ano em contorno. Na metade vazia ao lado do cartão, ou na
   * linha de cima quando o marco é largo.
   */
  yearMark?: string
}

function yearOf(c: Checkpoint) {
  const d = c.period?.start ?? c.period?.end
  return d && d !== 'present' ? d.slice(0, 4) : undefined
}

export function place(items: { c: Checkpoint; scope?: Stage; life?: Stage }[]): Placed[] {
  let side: 'left' | 'right' = 'right'
  return items.map((item) => {
    let lane: Lane = 'wide'
    if (!item.c.focus) {
      side = side === 'left' ? 'right' : 'left'
      lane = side
    }
    return { ...item, lane, yearMark: item.life ? undefined : yearOf(item.c) }
  })
}
