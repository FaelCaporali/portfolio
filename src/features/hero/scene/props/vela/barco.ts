/**
 * Um barco do glb navegando (aula.ts): o grupo `nome` vai para o ponto do circuito (na ESCALA de navegação), o casco
 * `nome_casco` (origem no centro de giro, proa em +x, boreste em +z) recebe rumo e adernamento, e o aparelho
 * `nome_<retranca>` (origem no eixo do mastro) gira em Y até o ângulo da retranca. A chave de forma `bordo` do aparelho
 * leva o bojo da vela para o bordo em que a retranca está (0 = o bordo do glb). Inércia só na retranca (jaibe) e no
 * adernamento. Biruta e fitas da vela (nós com `biruta` ou `fita` no nome, origem no ponto de fixação) giram em Y
 * para onde o vento APARENTE sopra e tremulam (muito quando a vela bate, na virada). Nada alocado por quadro. Sem o
 * grupo ou o casco no glb: null (a peça chega por partes).
 */
import * as THREE from 'three'
import {
  ESCALA,
  TAU_ADERNA,
  TAU_RETRANCA,
  angulo,
  percurso,
  pontoDeVela,
  seguir,
  ventoAparente,
  type Balanco,
  type Ponto,
} from './aula'

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true
const Y = new THREE.Vector3(0, 1, 0)
const X = new THREE.Vector3(1, 0, 0)

/** Direção (ângulo em Y) do centro das malhas de um nó, a partir da origem dele, no referencial dele. */
function direcao(o: THREE.Object3D) {
  o.updateMatrixWorld(true)
  const inv = o.matrixWorld.clone().invert()
  const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).applyMatrix4(inv)
  return angulo(c.x, c.z)
}

/** Indicadores de vento do barco: nó, rotação de repouso, direção de repouso no pai, se está no aparelho e a fase. */
function indicadores(grupo: THREE.Object3D, rig: THREE.Object3D | null) {
  const out: { no: THREE.Object3D; q0: THREE.Quaternion; dir0: number; noRig: boolean; fase: number }[] = []
  grupo.traverse((o) => {
    if (!/biruta|fita/.test(o.name) || out.some((i) => o.parent && isUnder(o, i.no))) return
    const d = direcao(o)
    const v = new THREE.Vector3(Math.cos(d), 0, -Math.sin(d)).applyQuaternion(o.quaternion)
    const noRig = !!rig && isUnder(o, rig)
    out.push({ no: o, q0: o.quaternion.clone(), dir0: angulo(v.x, v.z), noRig, fase: out.length * 1.7 })
  })
  return out
}

function isUnder(o: THREE.Object3D, a: THREE.Object3D) {
  for (let p = o.parent; p; p = p.parent) if (p === a) return true
  return false
}

export function criarBarco(root: THREE.Object3D, nome: string, retranca: string, atraso: number) {
  const grupo = root.getObjectByName(nome)
  const casco = root.getObjectByName(`${nome}_casco`)
  const rig = root.getObjectByName(`${nome}_${retranca}`) ?? null
  if (!grupo || !casco) return null
  // Aparelho em repouso: ângulo da retranca no referencial dele e de que lado do casco ela está no glb.
  const rest = rig ? direcao(rig) : 0
  const q0 = rig?.quaternion.clone() ?? new THREE.Quaternion()
  const ladoGlb = rig ? Math.sign(new THREE.Vector3(Math.cos(rest), 0, -Math.sin(rest)).applyQuaternion(q0).z) || 1 : 1
  const bojo: { inf: number[]; i: number }[] = []
  rig?.traverse((o) => {
    const i = isMesh(o) ? o.morphTargetDictionary?.bordo : undefined
    if (isMesh(o) && i !== undefined && o.morphTargetInfluences) bojo.push({ inf: o.morphTargetInfluences, i })
  })

  const fitas = indicadores(grupo, rig)
  const alvo: Ponto = { x: 0, y: 0, z: 0, rumo: 0, alfa: 0, v: 0 }
  const vela = { retranca: 0, aderna: 0 }
  const aparente = { para: 0, paneja: 0 }
  const qFita = new THREE.Quaternion()
  const estado = { retranca: 0, aderna: 0, primeiro: true }
  const qRumo = new THREE.Quaternion()
  const qAderna = new THREE.Quaternion()

  /** Pose no instante t (s desde a montagem); dt para a inércia; balanço de mar por cima. */
  const pose = (t: number, dt: number, b: Balanco) => {
    percurso(t, atraso, alvo)
    pontoDeVela(alvo.alfa, vela)
    if (estado.primeiro) {
      estado.retranca = vela.retranca
      estado.aderna = vela.aderna
      estado.primeiro = false
    } else {
      estado.retranca = seguir(estado.retranca, vela.retranca, dt, TAU_RETRANCA)
      estado.aderna = seguir(estado.aderna, vela.aderna, dt, TAU_ADERNA)
    }
    grupo.position.set(alvo.x, alvo.y + b.arfa, alvo.z)
    grupo.quaternion.identity()
    grupo.scale.setScalar(ESCALA)
    qRumo.setFromAxisAngle(Y, alvo.rumo)
    qAderna.setFromAxisAngle(X, estado.aderna + b.aderna)
    casco.quaternion.multiplyQuaternions(qRumo, qAderna)
    if (rig) {
      // Retranca para a popa, aberta `retranca` para boreste (+z): direção (−cos r, 0, sen r), ângulo π + r no casco.
      rig.quaternion.setFromAxisAngle(Y, Math.PI + estado.retranca - rest)
      const k = Math.min(1, Math.max(0, 0.5 - (0.5 * ladoGlb * estado.retranca) / 0.14))
      for (const m of bojo) m.inf[m.i] = k
    }
    // Biruta e fitas: para onde o vento aparente sopra, no referencial do pai (o aparelho gira com a retranca).
    ventoAparente(alvo, aparente)
    const giroRig = Math.PI + estado.retranca - rest
    for (const f of fitas) {
      const treme = (0.06 + 0.35 * aparente.paneja) * Math.sin(t * 31 + f.fase) + 0.04 * Math.sin(t * 13 + f.fase * 2)
      const alvoPai = aparente.para - (f.noRig ? giroRig : 0) + treme
      f.no.quaternion.copy(qFita.setFromAxisAngle(Y, alvoPai - f.dir0)).multiply(f.q0)
    }
  }
  return { pose, medidas: { rest, ladoGlb, bojo: bojo.length, fitas: fitas.length } }
}
