import { createContext, use, useEffect } from 'react'

export interface Descartavel {
  dispose: () => void
}

/**
 * Os descartáveis de uma vida nos bastidores (Props.tsx, #138): a vida montada escondida nunca roda efeitos, e o que
 * ela criou só é liberado pelo bastidor, se ela desmontar sem nunca ter aparecido.
 */
export const BastidorContext = createContext<Set<Descartavel> | null>(null)

/**
 * Libera da GPU, ao desmontar ou ao trocar, um objeto do three.js criado pelo componente (useMemo). Os adereços
 * trocam a cada vida: sem o dispose, cada troca deixava materiais e geometrias órfãos.
 */
export function useDisposal(value: Descartavel) {
  const bastidor = use(BastidorContext)
  bastidor?.add(value)
  useEffect(
    () => () => {
      value.dispose()
      bastidor?.delete(value)
    },
    [value, bastidor],
  )
}
