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

const nenhuma: ReadonlySet<number> = new Set()

/** Volta nova com todas as vidas (menos as que falharam, #138); a primeira nunca é a que acabou de sair. */
function newRound(total: number, last: number, random: Random, failed: ReadonlySet<number> = nenhuma): number[] {
  const round = shuffle(
    all(total).filter((i) => !failed.has(i)),
    random,
  )
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

/** Ordem de carga das vidas (#138): a escolhida no indicador, a atual e as que faltam nesta volta, sem repetir. */
export const loadOrder = (l: Lineup, chosen: number | null): number[] => [
  ...new Set([...(chosen === null ? [] : [chosen]), l.current, ...l.queue]),
]

/** A vida que vem depois da atual: a escolhida no indicador ou a próxima da volta (#138: a cena a prepara). */
export const peek = (l: Lineup, chosen: number | null) => chosen ?? l.queue[0] ?? l.current

/**
 * Para onde a troca pode ir (#138): a escolhida no indicador ou, sem escolha, as seguintes da volta em ordem — nunca
 * a atual, nunca uma que falhou.
 */
export const candidates = (l: Lineup, chosen: number | null, failed: ReadonlySet<number> = nenhuma) =>
  chosen === null ? l.queue.filter((i) => i !== l.current && !failed.has(i)) : [chosen]

/**
 * Tira da volta as vidas que falharam (#138: glb que não chegou); sem nenhuma boa na volta, sorteia a seguinte sem
 * elas. Uma vida que volta a funcionar entra de novo no próximo sorteio.
 */
export function skipFailed(
  l: Lineup,
  total: number,
  failed: ReadonlySet<number>,
  random: Random = Math.random,
): Lineup {
  if (candidates(l, null, failed).length > 0) return l
  return { ...l, queue: newRound(total, l.current, random, failed) }
}

/**
 * Próxima vida: a escolhida no indicador, se houver, ou a próxima da volta, nunca a atual nem uma que falhou. Quando a
 * volta acaba, a seguinte já é sorteada aqui (a mesma regra, a partir da vida que acabou de entrar): a próxima vida é
 * sempre conhecida.
 */
export function advance(
  l: Lineup,
  total: number,
  chosen: number | null,
  random: Random = Math.random,
  failed: ReadonlySet<number> = nenhuma,
): Lineup {
  const bons = l.queue.filter((i) => !failed.has(i))
  const queue = bons.length > 0 ? bons : newRound(total, l.current, random, failed)
  const next = chosen ?? queue.find((i) => i !== l.current) ?? l.current
  const rest = queue.filter((i) => i !== next)
  return { queue: rest.length > 0 ? rest : newRound(total, next, random, failed), current: next }
}
