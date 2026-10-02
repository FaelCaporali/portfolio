/**
 * Ordem do carrossel (decisão do Fael, 30/09, D-U2b: "de traz para frente linear"): abre na vida de abertura e segue a
 * trajetória de trás para frente, da mais nova à mais antiga (`stages` é cronológica: do fim para o começo), e da mais
 * antiga volta à mais nova, em laço. A escolha no indicador leva a uma vida e a volta segue dela. Sem React.
 */
export interface Lineup {
  /** Vidas (posições em `stages`) que faltam nesta volta, em ordem. */
  queue: readonly number[]
  /** Vida atual. */
  current: number
}

const nenhuma: ReadonlySet<number> = new Set()

/** A volta que sai de `from`: as outras vidas em ordem, de trás para frente, voltando ao fim da lista depois da 1ª. */
const roundFrom = (total: number, from: number, failed: ReadonlySet<number> = nenhuma) =>
  Array.from({ length: total - 1 }, (_, k) => (((from - 1 - k) % total) + total) % total).filter((i) => !failed.has(i))

export const createLineup = (total: number, start: number): Lineup => ({
  queue: roundFrom(total, start),
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
 * Tira da volta as vidas que falharam (#138: glb que não chegou): a volta passa a ser a que sai da atual, sem elas.
 * Uma vida que volta a funcionar entra de novo na volta seguinte.
 */
export function skipFailed(l: Lineup, total: number, failed: ReadonlySet<number>): Lineup {
  if (candidates(l, null, failed).length > 0) return l
  return { ...l, queue: roundFrom(total, l.current, failed) }
}

/**
 * Próxima vida: a escolhida no indicador, se houver, ou a próxima da volta que não falhou (a atual nunca). A volta
 * seguinte sai da vida que acabou de entrar: a próxima vida é sempre conhecida.
 */
export function advance(
  l: Lineup,
  total: number,
  chosen: number | null,
  failed: ReadonlySet<number> = nenhuma,
): Lineup {
  const next = chosen ?? candidates(l, null, failed)[0] ?? roundFrom(total, l.current, failed)[0] ?? l.current
  return { queue: roundFrom(total, next, failed), current: next }
}
