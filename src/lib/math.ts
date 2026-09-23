/** Limita v ao intervalo simétrico [-limit, limit]. */
export const clampAbs = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v))

/** Curva suave de 0 a 1 (smoothstep), para entradas já em [0, 1]. */
export const smooth = (x: number) => x * x * (3 - 2 * x)

/** Fator de aproximação exponencial por quadro: independe da taxa de quadros. */
export const approach = (dt: number, rate: number) => 1 - Math.exp(-dt * rate)

export const degToRad = (deg: number) => (deg * Math.PI) / 180
export const radToDeg = (rad: number) => (rad * 180) / Math.PI
