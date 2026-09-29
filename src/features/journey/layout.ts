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
   * Sobe ao lado do marco anterior, que está na outra metade. Só quando nenhum dos dois abre uma vida (o nome da vida
   * ocupa a metade vazia) e o anterior não é largo. Sem colisão enquanto cada cartão tiver ao menos o dobro da subida.
   */
  tuck: boolean
  /**
   * O ano em contorno na metade vazia (J52: a tela ocupada): só quando o ano muda e a metade está livre, isto é, o
   * marco não é largo, não abre vida e não subiu ao lado do anterior.
   */
  yearMark?: string
}

function yearOf(c: Checkpoint) {
  const d = c.period?.start ?? c.period?.end
  return d && d !== 'present' ? d.slice(0, 4) : undefined
}

export function place(items: { c: Checkpoint; scope?: Stage; life?: Stage }[]): Placed[] {
  let side: 'left' | 'right' = 'right'
  let prev: Placed | undefined
  let lastYear: string | undefined
  return items.map((item) => {
    let lane: Lane = 'wide'
    if (!item.c.focus) {
      side = side === 'left' ? 'right' : 'left'
      lane = side
    }
    const tuck = lane !== 'wide' && !item.life && !!prev && prev.lane !== 'wide' && prev.lane !== lane && !prev.life
    const year = yearOf(item.c)
    const free = lane !== 'wide' && !item.life && !tuck
    const placed: Placed = { ...item, lane, tuck, yearMark: free && year !== lastYear ? year : undefined }
    lastYear = year ?? lastYear
    prev = placed
    return placed
  })
}
