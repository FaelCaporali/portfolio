/**
 * Lágrima do Uber (U4): o rastro molhado (`uber_lagrima_<lado>`, malha fina colada à pele com UV v ao longo dele) fica
 * parado; a gota (`uber_lagrima_<lado>_gota`, origem no centro) nasce na pálpebra, desce pelo rastro e some no queixo.
 * A linha central do rastro é amostrada uma vez (média dos vértices por faixa de v) no espaço do pai da gota, com a
 * normal da pele; a gota anda por ela à mesma altura da pele que tinha no glb. O sentido sai da geometria (a ponta de
 * cima é a pálpebra), não do sinal de v, que o exportador inverte. Nada alocado por quadro.
 */
import * as THREE from 'three'

/** Faixas de v amostradas ao longo do rastro. */
const FAIXAS = 24
/** Ciclo de cada gota (s): desce em DESCIDA e fica ausente o resto. */
const CICLO = 2.7
const DESCIDA = 1.8
/** Trecho do começo em que a gota cresce e do fim em que ela encolhe (fração da descida). */
const NASCE = 0.1
const SOME = 0.85
/**
 * O rastro começa CORTE (m) abaixo da borda da pálpebra e a gota nasce NASCE_M abaixo dela: olhando para baixo, a íris
 * desce até a pálpebra e o começo do rastro ficava dentro do círculo da íris (portão de volta_prop.mjs).
 */
const CORTE = 0.003
const NASCE_M = 0.004

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true

function sob(o: THREE.Object3D, alvo: THREE.Object3D) {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === alvo) return true
  return false
}

export interface Lagrima {
  /** Gota no instante t (s, relógio da vida já com a defasagem do lado). */
  pose: (t: number) => void
  /** Movimento reduzido: gota a meio caminho, inteira. */
  parado: () => void
  /** Geometrias do rastro encurtado (cópias; as do glb ficam no cache). */
  dispose: () => void
}

/** Faixa de v (UV) das malhas do rastro. */
function faixaV(malhas: THREE.Mesh[]) {
  let [v0, v1] = [Infinity, -Infinity]
  for (const o of malhas) {
    const uv = o.geometry.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) [v0, v1] = [Math.min(v0, uv.getY(i)), Math.max(v1, uv.getY(i))]
  }
  return [v0, v1] as const
}

/** Linha central (pontos e normais) do rastro no espaço do pai da gota, da pálpebra para a ponta. */
function linhaCentral(rastro: THREE.Object3D, gota: THREE.Object3D, pai: THREE.Object3D) {
  const malhas: THREE.Mesh[] = []
  rastro.traverse((o) => {
    if (isMesh(o) && !sob(o, gota) && o.geometry.hasAttribute('uv')) malhas.push(o)
  })
  const [v0, v1] = faixaV(malhas)
  if (v1 <= v0) return null
  const faixas = Array.from({ length: FAIXAS }, () => ({ p: new THREE.Vector3(), n: new THREE.Vector3(), y: 0, k: 0 }))
  const paraPai = pai.matrixWorld.clone().invert()
  const m = new THREE.Matrix4()
  const m3 = new THREE.Matrix3()
  const v = new THREE.Vector3()
  const w = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (const o of malhas) {
    const uv = o.geometry.getAttribute('uv')
    const nor = o.geometry.hasAttribute('normal') ? o.geometry.getAttribute('normal') : null
    m.multiplyMatrices(paraPai, o.matrixWorld)
    m3.getNormalMatrix(m)
    for (let i = 0; i < uv.count; i++) {
      const f = faixas[Math.min(FAIXAS - 1, Math.floor(((uv.getY(i) - v0) / (v1 - v0)) * FAIXAS))]
      if (!f) continue
      o.getVertexPosition(i, v)
      f.y += w.copy(v).applyMatrix4(o.matrixWorld).y
      f.p.add(v.applyMatrix4(m))
      if (nor) f.n.add(n.fromBufferAttribute(nor, i).applyMatrix3(m3).normalize())
      f.k++
    }
  }
  const pts = faixas.filter((f) => f.k > 0)
  if (pts.length < 2) return null
  for (const f of pts) {
    f.p.divideScalar(f.k)
    f.n.normalize()
    f.y /= f.k
  }
  // A pálpebra é a ponta de cima (y do glb): o índice 0 fica nela.
  if ((pts[0]?.y ?? 0) < (pts[pts.length - 1]?.y ?? 0)) pts.reverse()
  return pts
}

/**
 * Trilha que o modelador gravou nos extras do nó do lado (`trilha`, `trilha_normal`: centro do rastro e normal da pele
 * no espaço do glb, v uniforme), levada ao espaço do pai da gota. A raiz clonada está solta: o "mundo" dela é o glb.
 */
function trilhaDosExtras(no: THREE.Object3D, pai: THREE.Object3D) {
  const P = no.userData.trilha as unknown
  const N = no.userData.trilha_normal as unknown
  if (!Array.isArray(P) || !Array.isArray(N) || P.length < 2 || P.length !== N.length) return null
  const paraPai = pai.matrixWorld.clone().invert()
  const m3 = new THREE.Matrix3().getNormalMatrix(paraPai)
  const pts = P.map((p: number[], i) => ({
    p: new THREE.Vector3().fromArray(p).applyMatrix4(paraPai),
    n: new THREE.Vector3()
      .fromArray(N[i] as number[])
      .applyMatrix3(m3)
      .normalize(),
    y: p[1] ?? 0,
  }))
  if ((pts[0]?.y ?? 0) < (pts[pts.length - 1]?.y ?? 0)) pts.reverse()
  return pts
}

type Ponto = { p: THREE.Vector3; n: THREE.Vector3 }

/**
 * Encurta o rastro na ponta da pálpebra: os vértices a menos de CORTE dela (ao longo da trilha) vão para o CORTE.
 * Troca a geometria por uma cópia (a do glb segue no cache do useGLTF) e devolve as cópias para o descarte.
 */
function encurtar(rastro: THREE.Object3D, gota: THREE.Object3D, pai: THREE.Object3D, pts: Ponto[]) {
  const p0 = pts[0]?.p
  const alvo = pts.find((f) => p0 && f.p.distanceTo(p0) >= CORTE) ?? pts[pts.length - 1]
  if (!p0 || !alvo) return []
  const dir = alvo.p.clone().sub(p0).normalize()
  const paraPai = pai.matrixWorld.clone().invert()
  const m = new THREE.Matrix4()
  const mi = new THREE.Matrix4()
  const v = new THREE.Vector3()
  const w = new THREE.Vector3()
  const copias: THREE.BufferGeometry[] = []
  rastro.traverse((o) => {
    if (!isMesh(o) || sob(o, gota)) return
    const g = o.geometry.clone()
    const pos = g.getAttribute('position')
    m.multiplyMatrices(paraPai, o.matrixWorld)
    mi.copy(m).invert()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m)
      const s = w.subVectors(v, p0).dot(dir)
      if (s >= CORTE) continue
      v.addScaledVector(dir, CORTE - s).applyMatrix4(mi)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeBoundingSphere()
    o.geometry = g
    copias.push(g)
  })
  return copias
}

/** Fração u da trilha (índice uniforme) a `d` m da pálpebra, medidos ao longo dela. */
function fracao(pts: Ponto[], d: number) {
  let s = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    if (!a || !b) break
    const l = a.p.distanceTo(b.p)
    if (s + l >= d) return (i - 1 + (l > 0 ? (d - s) / l : 0)) / (pts.length - 1)
    s += l
  }
  return 0
}

export function criarLagrima(raiz: THREE.Object3D, lado: 'esq' | 'dir'): Lagrima | null {
  const rastro = raiz.getObjectByName(`uber_lagrima_${lado}`)
  const gota = raiz.getObjectByName(`uber_lagrima_${lado}_gota`)
  const pai = gota?.parent
  if (!rastro || !gota || !pai) return null
  raiz.updateWorldMatrix(true, true)
  const pts = trilhaDosExtras(rastro, pai) ?? linhaCentral(rastro, gota, pai)
  if (!pts) return null
  // Altura da gota sobre a pele no glb (ao longo da normal do ponto mais próximo do rastro).
  let perto = pts[0]
  let d2 = Infinity
  for (const f of pts) {
    const d = f.p.distanceToSquared(gota.position)
    if (d < d2) [perto, d2] = [f, d]
  }
  const altura = perto ? gota.position.clone().sub(perto.p).dot(perto.n) : 0
  const copias = encurtar(rastro, gota, pai, pts)
  const u0 = fracao(pts, NASCE_M)
  const escala = gota.scale.clone()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const sobe = new THREE.Vector3()
  const lado3 = new THREE.Vector3()
  const base = new THREE.Matrix4()

  /** Gota na fração u do rastro (0 pálpebra, 1 ponta), com o tamanho relativo s. */
  const colocar = (u: number, s: number) => {
    gota.visible = s > 0
    if (!gota.visible) return
    const x = Math.min(Math.max(u, 0), 1) * (pts.length - 1)
    const i = Math.min(Math.floor(x), pts.length - 2)
    const f0 = pts[i]
    const f1 = pts[i + 1]
    if (!f0 || !f1) return
    const k = x - i
    a.lerpVectors(f0.p, f1.p, k)
    b.lerpVectors(f0.n, f1.n, k).normalize()
    gota.position.copy(a).addScaledVector(b, altura)
    // Quadro da gota (o do glb): +Z para fora da pele, +Y subindo pelo rastro.
    sobe.subVectors(f0.p, f1.p)
    sobe.addScaledVector(b, -sobe.dot(b)).normalize()
    lado3.crossVectors(sobe, b)
    gota.quaternion.setFromRotationMatrix(base.makeBasis(lado3, sobe, b))
    gota.scale.copy(escala).multiplyScalar(s)
  }

  return {
    pose: (t) => {
      const c = (((t % CICLO) + CICLO) % CICLO) / DESCIDA
      if (c >= 1) {
        colocar(0, 0)
        return
      }
      // Escorre acelerando um pouco (peso), cresce ao nascer e encolhe no queixo.
      let s = 1
      if (c < NASCE) s = 0.35 + (0.65 * c) / NASCE
      else if (c > SOME) s = (1 - c) / (1 - SOME)
      colocar(u0 + (1 - u0) * c ** 1.3, s)
    },
    parado: () => colocar(0.5, 1),
    dispose: () => {
      for (const g of copias) g.dispose()
    },
  }
}
