/**
 * Ordem do carrossel (decisão do Fael, 23/09): abre na vida de abertura e segue embaralhada, sem repetir nenhuma vida
 * antes de todas aparecerem. A volta seguinte não começa pela vida que acabou de sair. Sem React.
 */
export interface Lineup {
  /** Vidas (posições em `stages`) que ainda faltam nesta volta. */
  queue: readonly number[]
  /** Vida atual. */
  current: number
}

type Random = () => number

function shuffle(list: readonly number[], random: Random): number[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j] as number, out[i] as number]
  }
  return out
}

const all = (total: number) => Array.from({ length: total }, (_, i) => i)

/** Volta nova com todas as vidas; a primeira nunca é a que acabou de sair. */
function newRound(total: number, last: number, random: Random): number[] {
  const round = shuffle(all(total), random)
  if (round[0] === last && round.length > 1) round.push(round.shift() as number)
  return round
}

export const createLineup = (total: number, start: number, random: Random = Math.random): Lineup => ({
  queue: shuffle(
    all(total).filter((i) => i !== start),
    random,
  ),
  current: start,
})

/** Próxima vida: a escolhida no indicador, se houver, ou a próxima da volta. */
export function advance(l: Lineup, total: number, chosen: number | null, random: Random = Math.random): Lineup {
  const queue = l.queue.length > 0 ? l.queue : newRound(total, l.current, random)
  const next = chosen ?? queue[0] ?? l.current
  return { queue: queue.filter((i) => i !== next), current: next }
}
