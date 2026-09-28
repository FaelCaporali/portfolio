import { useEffect } from 'react'

/**
 * Libera da GPU, ao desmontar ou ao trocar, um objeto do three.js criado pelo componente (useMemo). Os adereços
 * trocam a cada vida: sem o dispose, cada troca deixava materiais e geometrias órfãos.
 */
export function useDisposal(value: { dispose: () => void }) {
  useEffect(
    () => () => {
      value.dispose()
    },
    [value],
  )
}
