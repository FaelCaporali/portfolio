/**
 * Movimento procedural do bug (vida qa, E1): posição na rota, corpo apontado para onde voa, asas batendo e élitros
 * abertos no voo; preso na lente: élitros fechados, patas em pouso, dorso para a câmera com a cabeça para cima (a
 * silhueta do ícone de bug) e ampliado AMPLIA× sob o vidro. Contrato de nós do glb (FICHA-PRODUCAO.md e LOG da v1,
 * MODELADOR): `qa_bug` (frente em +Z local, dorso em +Y), filhos `qa_bug_elitro_esq/_dir` (pivô na articulação; abrem
 * por Rz(±40°)·Rx(15°), esq +40) e `qa_bug_asa_esq/_dir` (pivô na raiz; batem em volta do eixo do corpo). A base do
 * glb é o pouso (élitros fechados, asas dobradas, patas abertas); a chave de forma `voo` abre as asas e encolhe as
 * patas. Nó ausente fica de fora. Nada alocado por quadro.
 */
import * as THREE from 'three'
import { posicaoNaRota, type Extremos, type Rota } from './voo'

/** Eixos das articulações no espaço local do nó: o comprimento do corpo (Z) e o lateral (X). */
const EIXO = new THREE.Vector3(0, 0, 1)
const LATERAL = new THREE.Vector3(1, 0, 0)
/** Abertura dos élitros no voo (rad, contrato do modelador) e batida das asas abertas: ângulo médio, amplitude, Hz. */
const ELITRO = { z: THREE.MathUtils.degToRad(40), x: THREE.MathUtils.degToRad(15) }
const ASA = { media: THREE.MathUtils.degToRad(10), amp: THREE.MathUtils.degToRad(40), hz: 19 }
/** Chave de forma do voo (asas abertas, patas encolhidas). */
const CHAVE_VOO = 'voo'
/** Ampliação sob a lente. */
export const AMPLIA = 1.6
/** Preso na lente: dorso para a câmera (+Y local → +Z), cabeça para cima (+Z local → +Y), um pouco inclinado. */
export const PRESO = new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI + 0.3)
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2))
/** Janela (s) para a direção do voo. */
const OLHA = 0.04
const CIMA = new THREE.Vector3(0, 1, 0)

interface Junta {
  o: THREE.Object3D
  q: THREE.Quaternion
  /** +1 no lado esquerdo do Fael (+X), −1 no direito. */
  lado: number
}

const junta = (raiz: THREE.Object3D, nome: string, lado: number): Junta[] => {
  const o = raiz.getObjectByName(nome)
  return o ? [{ o, q: o.quaternion.clone(), lado }] : []
}

export function criarBug(raiz: THREE.Object3D | undefined) {
  if (!raiz) return null
  const bug = raiz
  const elitros = [...junta(bug, 'qa_bug_elitro_esq', 1), ...junta(bug, 'qa_bug_elitro_dir', -1)]
  const asas = [...junta(bug, 'qa_bug_asa_esq', 1), ...junta(bug, 'qa_bug_asa_dir', -1)]
  // Influência da chave `voo` em cada malha que a tem (asas e patas).
  const morfos: { inf: number[]; i: number }[] = []
  bug.traverse((o) => {
    const m = o as Partial<THREE.Mesh>
    const i = m.morphTargetDictionary?.[CHAVE_VOO]
    if (m.morphTargetInfluences && i !== undefined) morfos.push({ inf: m.morphTargetInfluences, i })
  })
  const escala0 = bug.scale.x
  const giro = new THREE.Quaternion()
  const giroX = new THREE.Quaternion()
  const voando = new THREE.Quaternion()
  const olhar = new THREE.Matrix4()
  const agora = new THREE.Vector3()
  const antes = new THREE.Vector3()
  const origem = new THREE.Vector3()

  /** Ângulos das juntas e patas: `voo` 1 voando, 0 preso; t em s (batida das asas). */
  const juntas = (voo: number, t: number) => {
    giroX.setFromAxisAngle(LATERAL, ELITRO.x * voo)
    for (const e of elitros) {
      e.o.quaternion
        .copy(e.q)
        .multiply(giro.setFromAxisAngle(EIXO, e.lado * ELITRO.z * voo))
        .multiply(giroX)
    }
    const batida = ASA.media + ASA.amp * Math.sin(2 * Math.PI * ASA.hz * t)
    for (const a of asas) a.o.quaternion.copy(a.q).multiply(giro.setFromAxisAngle(EIXO, a.lado * batida * voo))
    for (const m of morfos) m.inf[m.i] = voo
  }

  /**
   * Pose no quadro: rota e instante de voo `tv`, pontos medidos `ext`, `voo` 0–1 e t (s). Parado (voo 0), o bug fica
   * na orientação `qParado` e na escala `escalaParado` (relativa à do glb): preso na lente ou catalogado na vaga.
   */
  const pose = (
    rota: Rota,
    tv: number,
    ext: Extremos,
    voo: number,
    t: number,
    qParado: THREE.Quaternion,
    escalaParado: number,
  ) => {
    posicaoNaRota(rota, tv, ext, bug.position)
    // Direção do voo pela rota sem tremor; parado (chegada), fica a última.
    posicaoNaRota(rota, tv, ext, agora, true)
    posicaoNaRota(rota, tv - OLHA, ext, antes, true)
    const d = agora.sub(antes)
    if (d.lengthSq() > 1e-8) {
      olhar.lookAt(d.normalize(), origem, CIMA)
      voando.setFromRotationMatrix(olhar)
    }
    bug.quaternion.slerpQuaternions(qParado, voando, voo)
    bug.scale.setScalar(escala0 * (escalaParado + (1 - escalaParado) * voo))
    juntas(voo, t)
  }

  /** Parado (voo 0) na posição, orientação e escala (relativa à do glb) dadas. */
  const parado = (p: THREE.Vector3, q: THREE.Quaternion, escala: number) => {
    bug.position.copy(p)
    bug.quaternion.copy(q)
    bug.scale.setScalar(escala0 * escala)
    juntas(0, 0)
  }
  return { objeto: bug, escala0, pose, parado }
}
