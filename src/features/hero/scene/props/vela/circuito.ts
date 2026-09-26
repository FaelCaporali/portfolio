/**
 * Geometria do percurso da aula visto de cima: polígono convexo de cantos arredondados (arco de raio r em cada
 * vértice), percorrido na ordem dos vértices. Devolve o ponto (x, z) e o rumo (giro em Y do three.js, proa em +x) em
 * função da distância percorrida. Só números: a regra de vela fica em aula.ts.
 */

export interface Trecho {
  /** Comprimento (m). */
  L: number
  /** Ponto e rumo a s metros do começo do trecho. */
  em: (s: number) => [x: number, z: number, rumo: number]
}

/** Ângulo de um vetor horizontal (x, z) no sentido do giro em Y do three.js (Ry(a) leva +x a ele). */
export const angulo = (x: number, z: number) => Math.atan2(-z, x)
const embrulha = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/**
 * Trechos (reta, arco, reta, arco...) do polígono `v` (vértices (x, z) na ordem de navegação) com cantos de raio `r`.
 * O primeiro trecho é a reta que SAI do vértice 0; o canto do vértice 0 é o último.
 */
export function poligono(v: readonly (readonly [number, number])[], r: number): Trecho[] {
  const n = v.length
  const dir = (i: number): [number, number] => {
    const [ax, az] = v[i % n] ?? [0, 0]
    const [bx, bz] = v[(i + 1) % n] ?? [0, 0]
    const l = Math.hypot(bx - ax, bz - az)
    return [(bx - ax) / l, (bz - az) / l]
  }
  // Em cada vértice: giro da proa e recuo da tangência (r · tan(giro/2)).
  const cantos = Array.from({ length: n }, (_, i) => {
    const [ix, iz] = dir(i - 1 + n)
    const [ox, oz] = dir(i)
    const giro = embrulha(angulo(ox, oz) - angulo(ix, iz))
    return { giro, recuo: r * Math.tan(Math.abs(giro) / 2), rumo0: angulo(ix, iz) }
  })
  const trechos: Trecho[] = []
  for (let i = 0; i < n; i++) {
    const [ax, az] = v[i] ?? [0, 0]
    const [bx, bz] = v[(i + 1) % n] ?? [0, 0]
    const [dx, dz] = dir(i)
    const c0 = cantos[i]
    const c1 = cantos[(i + 1) % n]
    if (!c0 || !c1) continue
    const L = Math.hypot(bx - ax, bz - az) - c0.recuo - c1.recuo
    const x0 = ax + dx * c0.recuo
    const z0 = az + dz * c0.recuo
    const rumo = angulo(dx, dz)
    trechos.push({ L, em: (s) => [x0 + dx * s, z0 + dz * s, rumo] })
    // Canto do vértice seguinte: arco de r, do ponto de tangência de entrada ao de saída.
    const px = bx - dx * c1.recuo
    const pz = bz - dz * c1.recuo
    const sinal = Math.sign(c1.giro) || 1
    // Centro à esquerda (giro > 0) ou à direita da proa, a r do ponto de tangência.
    const [nx, nz] = [Math.cos(rumo + (sinal * Math.PI) / 2), -Math.sin(rumo + (sinal * Math.PI) / 2)]
    const cx = px + nx * r
    const cz = pz + nz * r
    const Larco = Math.abs(c1.giro) * r
    trechos.push({
      L: Larco,
      em: (s) => {
        const a = rumo + (sinal * s) / r
        const [mx, mz] = [Math.cos(a - (sinal * Math.PI) / 2), -Math.sin(a - (sinal * Math.PI) / 2)]
        return [cx + mx * r, cz + mz * r, a]
      },
    })
  }
  return trechos
}

/** Ponto a s metros do começo do percurso fechado. */
export function noPercurso(trechos: Trecho[], total: number, s: number): [number, number, number] {
  let d = ((s % total) + total) % total
  for (const t of trechos) {
    if (d <= t.L) return t.em(d)
    d -= t.L
  }
  return trechos[0]?.em(0) ?? [0, 0, 0]
}
