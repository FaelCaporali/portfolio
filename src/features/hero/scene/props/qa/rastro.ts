/**
 * Rastro do voo (vida qa, E3: o "caminho padrão cego", que quem corre atrás do bug seguiria): tracejado fino e claro
 * sobre a própria rota, com os traços presos ao espaço (ficam onde o bug passou) e desbotando em VIDA s; quando o bug
 * chega na lente, o que sobrou some em SOME s. Uma malha só (fita de quadriláteros virados para a câmera, alfa por
 * vértice), atualizada por quadro sem alocar. Transparente e com a desintegração, como todo material do adereço.
 */
import * as THREE from 'three'
import { withDissolve } from '../../dissolve'
import { posicaoNaRota, type Extremos, type Rota } from './voo'

/** Tempo de vida de um traço (s), espaçamento entre traços (s de voo) e fração do espaço ocupada pelo traço. */
const VIDA = 0.6
const PASSO = 0.02
const CHEIO = 0.55
const SOME = 0.25
const N = Math.ceil(VIDA / PASSO) + 1
/** Largura da fita (m no glb: ~3 px no 1440, ~1 px CSS no 360) e alfa máximo. */
const LARGURA = 0.0016
const ALFA = 0.6
const COR = new THREE.Color('#f3efe6')
/** Direção da câmera no espaço do glb (o rosto olha para +Z): a fita fica de frente para ela. */
const VISTA = new THREE.Vector3(0, 0, 1)

export function criarRastro() {
  const pos = new Float32Array(N * 4 * 3)
  const cor = new Float32Array(N * 4 * 4)
  const idx = new Uint16Array(N * 6)
  for (let k = 0; k < N; k++) {
    const v = k * 4
    idx.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], k * 6)
    for (let j = 0; j < 4; j++) cor.set([COR.r, COR.g, COR.b, 0], (v + j) * 4)
  }
  const geo = new THREE.BufferGeometry()
  const aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)
  const aCor = new THREE.BufferAttribute(cor, 4).setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('position', aPos)
  geo.setAttribute('color', aCor)
  geo.setIndex(new THREE.BufferAttribute(idx, 1))
  const material = withDissolve(
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  )
  material.name = 'qa_rastro'
  const mesh = new THREE.Mesh(geo, material)
  mesh.name = 'qa_rastro'
  mesh.frustumCulled = false
  mesh.renderOrder = 3

  const p0 = new THREE.Vector3()
  const p1 = new THREE.Vector3()
  const lado = new THREE.Vector3()
  const gravar = (k: number, alfa: number) => {
    const v = k * 4
    lado.subVectors(p1, p0).cross(VISTA)
    const l = lado.length()
    if (l > 1e-6) lado.multiplyScalar(LARGURA / 2 / l)
    else lado.set(0, 0, 0)
    pos[v * 3] = p0.x + lado.x
    pos[v * 3 + 1] = p0.y + lado.y
    pos[v * 3 + 2] = p0.z + lado.z
    pos[v * 3 + 3] = p0.x - lado.x
    pos[v * 3 + 4] = p0.y - lado.y
    pos[v * 3 + 5] = p0.z - lado.z
    pos[v * 3 + 6] = p1.x + lado.x
    pos[v * 3 + 7] = p1.y + lado.y
    pos[v * 3 + 8] = p1.z + lado.z
    pos[v * 3 + 9] = p1.x - lado.x
    pos[v * 3 + 10] = p1.y - lado.y
    pos[v * 3 + 11] = p1.z - lado.z
    for (let j = 0; j < 4; j++) cor[(v + j) * 4 + 3] = alfa
  }

  /** Traços do instante `tv` da rota (s de voo) com os pontos medidos `ext`. */
  const atualizar = (rota: Rota, tv: number, ext: Extremos) => {
    const fim = Math.min(tv, rota.chega)
    const some = tv > rota.chega ? Math.max(0, 1 - (tv - rota.chega) / SOME) : 1
    const base = Math.floor(fim / PASSO) * PASSO
    for (let k = 0; k < N; k++) {
      const t0 = base - k * PASSO
      const t1 = Math.min(t0 + PASSO * CHEIO, fim)
      const idade = tv - t0
      const alfa = ALFA * some * Math.max(0, 1 - idade / VIDA)
      if (t0 < 0 || t1 <= t0 || alfa <= 0) {
        p0.set(0, 0, 0)
        p1.set(0, 0, 0)
        gravar(k, 0)
        continue
      }
      posicaoNaRota(rota, t0, ext, p0)
      posicaoNaRota(rota, t1, ext, p1)
      gravar(k, alfa)
    }
    aPos.needsUpdate = true
    aCor.needsUpdate = true
    mesh.visible = some > 0
  }
  const esconder = () => {
    mesh.visible = false
  }
  const dispose = () => {
    geo.dispose()
    material.dispose()
  }
  return { mesh, atualizar, esconder, dispose }
}
