/**
 * Roteiro do adereço financeiro v7 (FICHA-PRODUCAO §Movimento, R8), em segundos desde o INÍCIO DA PAUSA da vida.
 * O componente converte o relógio da montagem para este: montado no auge do furacão, a pausa começa depois da
 * reconstrução (TIMING.in de model/carousel.ts); montado já parado (primeira vida, `d=0`), a pausa começa na montagem.
 *   0,00–0,60  células se preenchem em ordem de leitura, 50 ms cada, com a célula ativa andando
 *   0,15–0,95  `Sub AtingirMeta()` digitado caractere a caractere, cursor de texto no fim do que foi digitado
 *   0,90–1,25  a linha se desenha de baixo até o pé do mastro
 *   1,25–1,40  a bandeira sobe e desfralda; as moedas descem 3 mm e assentam (easeOut, sem quique)
 * Estado final a partir de 1,40 s (a pausa tem 2,5 s: ≥ 1,1 s de leitura; 3 s na primeira vida).
 */
import { TIMING } from '../../../model/carousel'
import { CHAR_U1 } from './layout'

export const R = {
  cellDur: 0.05,
  cells: 12,
  typeStart: 0.15,
  typeEnd: 0.95,
  lineStart: 0.9,
  lineEnd: 1.25,
  landStart: 1.25,
  landDur: 0.15,
} as const

/** Fim do roteiro: o movimento reduzido mostra este instante parado. */
export const END = R.landStart + R.landDur

/** Início da pausa no relógio da montagem: `dissolving` = montado com o busto ainda desintegrado (troca de vida). */
export const pauseOffset = (dissolving: boolean) => (dissolving ? TIMING.in : 0)

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const easeOut = (x: number) => 1 - (1 - x) ** 3
const easeInOut = (x: number) => x * x * (3 - 2 * x)

/** Células cheias (0..12). */
export const filledAt = (t: number) => (t < 0 ? 0 : Math.min(R.cells, Math.floor(t / R.cellDur) + 1))
/** Célula ativa (0..11): a última preenchida; antes de começar, A1. */
export const activeAt = (t: number) => Math.max(0, filledAt(t) - 1)
/** Caracteres digitados (0..17). */
export const typedAt = (t: number) =>
  Math.min(CHAR_U1.length, Math.max(0, Math.floor(((t - R.typeStart) / (R.typeEnd - R.typeStart)) * CHAR_U1.length)))
/** Progresso da linha (0..1). */
export const lineAt = (t: number) => easeInOut(clamp01((t - R.lineStart) / (R.lineEnd - R.lineStart)))
/** Pouso da bandeira e das moedas (0..1, easeOut; null = bandeira ainda não subiu). */
export const landAt = (t: number) => (t < R.landStart ? null : easeOut(clamp01((t - R.landStart) / R.landDur)))
