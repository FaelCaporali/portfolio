import type { PropId } from '../../../content/journey'

/**
 * O que a cena do herói compartilha quadro a quadro (#138), sem React: o busto na tela e as vidas prontas agora (a
 * instância montada de cada uma já preparada). Lido pelo relógio do carrossel, que só troca para uma vida pronta.
 */
export interface Palco {
  /** O 1º quadro com o busto já saiu (Bust.tsx). */
  emCena: boolean
  /** Vidas cuja instância montada está preparada (shaders, texturas). */
  prontas: Set<PropId>
  /** Vidas que já ganharam a marca `vida-pronta` (uma vez por página). */
  marcadas: Set<PropId>
}

export const criarPalco = (): Palco => ({ emCena: false, prontas: new Set(), marcadas: new Set() })
