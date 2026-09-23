/**
 * Qualidade adaptativa da cena. O PerformanceMonitor do drei mede o FPS e avisa quando cai ou quando sobra; a cena
 * desce ou sobe um nível. Resolução do canvas e quantidade de partículas do furacão são o que mais pesa na GPU.
 */
export interface Quality {
  /** Teto da densidade de pixels do canvas (a tela pode ter mais; nunca se usa menos que 1). */
  maxDpr: number
  /** Fração das partículas do furacão desenhadas. */
  particles: number
}

export const QUALITY_LEVELS: readonly Quality[] = [
  { maxDpr: 1, particles: 0.35 },
  { maxDpr: 1.5, particles: 0.65 },
  { maxDpr: 2, particles: 1 },
]

export const TOP_QUALITY = QUALITY_LEVELS.length - 1

export const lowerQuality = (level: number) => Math.max(0, level - 1)
export const raiseQuality = (level: number) => Math.min(TOP_QUALITY, level + 1)

export function qualityAt(level: number): Quality {
  const q = QUALITY_LEVELS[Math.min(TOP_QUALITY, Math.max(0, level))]
  if (!q) throw new Error('QUALITY_LEVELS vazio')
  return q
}
