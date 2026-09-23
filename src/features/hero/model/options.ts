/** Opções do herói que vêm da página. Lidas na montagem do componente, nunca no import do módulo. */
export interface HeroOptions {
  /** Posição da vida em que o carrossel começa: ?slot=<id> (conferência) ou a vida de abertura. */
  start: number
  /** ?d=0..1.35 congela a desintegração naquele ponto (conferência); null = carrossel normal. */
  frozenDissolve: number | null
  /** prefers-reduced-motion: troca a vida sem o furacão. */
  reducedMotion: boolean
}

export function readHeroOptions(
  search: string,
  stageIds: readonly string[],
  opening: string,
  reducedMotion: boolean,
): HeroOptions {
  const params = new URLSearchParams(search)
  const d = params.get('d') === null ? NaN : Number(params.get('d'))
  const slot = stageIds.indexOf(params.get('slot') ?? '')
  return {
    start: slot >= 0 ? slot : Math.max(0, stageIds.indexOf(opening)),
    frozenDissolve: Number.isFinite(d) ? d : null,
    reducedMotion,
  }
}
