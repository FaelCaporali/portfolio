/**
 * A VAGA LIVRE da caixa entomológica (FICHA v2, N5): onde o bug capturado é alfinetado, sobre a etiqueta da vaga (a
 * do glb fica como está, ADENDO v2.1). Medidas da receita do modelador (3d/tools/prop_qa_caixa.py): 9ª célula da grade
 * 3 × 3 (última fileira, última coluna), alfinete em (0,0384; 0,0241) e altura do espécime 6 mm acima da cortiça;
 * caixa inclinada 20° para trás na aresta de apoio (quadro do nó `qa_caixa`).
 * Um nó filho da caixa (preso ao mundo com ela) com o bug catalogado: uma cópia do bug do glb, na pose de pouso, com a
 * orientação dos outros espécimes (cabeça para cima, dorso para a frente). `naRaiz` dá a pose dele no espaço da raiz do
 * adereço (o da cabeça), para o bug que voa chegar exatamente lá; usa as matrizes do quadro anterior (a âncora as
 * calcula depois dos useFrame): um quadro de atraso só com a cabeça girando.
 */
import * as THREE from 'three'

/** Alfinete da vaga, já inclinado (quadro do nó qa_caixa, m do scan). */
const VAGA = new THREE.Vector3(0.0384, 0.02624, 0.00162)
const INCLINACAO = THREE.MathUtils.degToRad(-20)
/** Tamanho do bug catalogado (relativo ao glb): ~19 mm, como os espécimes vizinhos (17–21 mm). */
export const ESCALA_CATALOGADO = 0.6

export interface Pose {
  p: THREE.Vector3
  q: THREE.Quaternion
  /** Escala uniforme (da caixa e do ajuste por tela) em relação à raiz. */
  s: number
}

const pose = (): Pose => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), s: 1 })

export function criarVaga(caixa: THREE.Object3D, bug: THREE.Object3D) {
  const inclina = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), INCLINACAO)
  // Bug → caixa: frente (+Z do bug) para cima (+Y), dorso (+Y do bug) para a frente (+Z), esquerda do bug para −X.
  const base = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)),
  )
  const noBug = new THREE.Object3D()
  noBug.name = 'qa_vaga'
  noBug.position.copy(VAGA)
  noBug.quaternion.copy(inclina).multiply(base)
  caixa.add(noBug)

  // O bug catalogado: cópia do bug do glb na pose de pouso (a base do glb: élitros fechados, patas abertas).
  const catalogado = bug.clone(true)
  catalogado.name = 'qa_bug_catalogado'
  catalogado.position.set(0, 0, 0)
  catalogado.quaternion.identity()
  catalogado.scale.setScalar(bug.scale.x * ESCALA_CATALOGADO)
  catalogado.visible = false
  noBug.add(catalogado)

  const inv = new THREE.Matrix4()
  const m = new THREE.Matrix4()
  const esc = new THREE.Vector3()
  const naRaizDe = (o: THREE.Object3D, raiz: THREE.Object3D, out: Pose) => {
    m.multiplyMatrices(inv.copy(raiz.matrixWorld).invert(), o.matrixWorld).decompose(out.p, out.q, esc)
    out.s = esc.x
    return out
  }
  const bugNaRaiz = pose()
  /** Pose da vaga na raiz (com a escala do nó: a do bug catalogado sai × ESCALA_CATALOGADO). */
  const naRaiz = (raiz: THREE.Object3D) => naRaizDe(noBug, raiz, bugNaRaiz)
  return { catalogado, naRaiz }
}
