import { useSyncExternalStore } from 'react'

/**
 * O que está em leitura na trajetória: a vida (a cor do <body>), o marco e a entrada de cada marco. Muda com a
 * rolagem e com o refresh do ScrollTrigger (useJourneyMotion); mora fora do estado da JourneyPage para a troca de
 * marco não refazer a página inteira (142): cada parte lê só o pedaço dela (useReading) e só ela redesenha.
 */
interface ReadingState {
  life: string | undefined
  mark: string | undefined
  /** Os marcos abaixo da tela ao abrir: esperando (false) ou já entraram (true). */
  reveal: ReadonlyMap<string, boolean>
}

const INITIAL: ReadingState = { life: undefined, mark: undefined, reveal: new Map() }

export interface Reading {
  get: () => ReadingState
  /** Troca o que mudou; avisa só se algo mudou. */
  set: (patch: Partial<ReadingState>) => void
  subscribe: (listener: () => void) => () => void
}

export function createReading(): Reading {
  let state = INITIAL
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(patch) {
      const next = { ...state, ...patch }
      if (next.life === state.life && next.mark === state.mark && next.reveal === state.reveal) return
      state = next
      for (const l of listeners) l()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/**
 * Um pedaço do que está em leitura. `pick` devolve um valor simples (texto, booleano): o componente só redesenha
 * quando ele muda. No build e na hidratação, o estado inicial (nada em leitura), igual ao HTML.
 */
export function useReading<T>(reading: Reading, pick: (s: ReadingState) => T): T {
  return useSyncExternalStore(
    reading.subscribe,
    () => pick(reading.get()),
    () => pick(INITIAL),
  )
}
