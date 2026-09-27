/**
 * Âncora no "carro" (ficha do uber, ADENDO 6; ficha do fullstack, FECHAMENTO): a peça presa ao mundo não segue a
 * cabeça. Num carro o volante fica parado e é a cabeça que se move atrás dele (olhar e arrasto); na mesa, o notebook.
 * Os nós vão para um grupo (`opcoes.nome`), filho da raiz (dentro do `frame`, que gira com a cabeça), e a cada
 * atualização de matrizes o grupo desfaz o giro da cabeça: fica onde estaria com a cabeça em repouso (Bust.tsx: pivô →
 * cabeça → frame; a cabeça só gira, sem translação).
 * A conta está em `updateMatrixWorld`, que o renderizador chama depois de todos os useFrame: nenhum atraso de quadro.
 *
 * Ajuste do grupo no espaço do glb (site, sem mexer no glb): escala em volta do pivô (a origem do nó de composição:
 * centro do aro no Uber, centro da borda de cima da tampa no fullstack), deslocamento e, se houver mãos, a pegada (as
 * mãos correm pelo aro, em volta do eixo +Z do pivô, na direção das 12 h).
 */
import * as THREE from 'three'

export interface Grupo {
  /** Escala do grupo em volta do pivô (1 = glb). */
  escala: number
  /** Deslocamento no espaço do glb (m): −z aproxima do busto, −y desce. */
  desloc: readonly [number, number, number]
  /** Graus que cada mão corre pelo aro na direção das 12 h (fecha a pegada; negativo abre): [esquerda, direita] do
   * Fael (a esquerda dele fica à direita da tela). Sem mãos, fica de fora. */
  pegada?: readonly [number, number]
}

/** Mão filha do pivô: [sinal do giro em volta de +Z, lado (0 = esquerda do Fael, 1 = direita)]. */
export type Maos = Readonly<Record<string, readonly [1 | -1, 0 | 1]>>

export interface OpcoesAncora {
  /** Nome do grupo criado na raiz (ex.: `uber_carro`). */
  nome: string
  /** Mãos (nós filhos do pivô) que a pegada gira; sem elas, a pegada não faz nada. */
  maos?: Maos
}

const SEM_PEGADA: readonly [number, number] = [0, 0]

/**
 * Cria o grupo na raiz e move para ele os nós presos ao mundo; o ajuste gira em volta da origem de `pivo`.
 * `grupo()` é lido a cada atualização (nada alocado).
 */
export function criarAncora(
  raiz: THREE.Object3D,
  nos: readonly string[],
  pivo: THREE.Object3D | null,
  grupo: () => Grupo,
  opcoes: OpcoesAncora,
): THREE.Group {
  const carro = new THREE.Group()
  carro.name = opcoes.nome
  raiz.add(carro)
  for (const n of nos) {
    const o = raiz.getObjectByName(n)
    if (o) carro.add(o)
  }
  const centro = pivo ? pivo.position.clone() : new THREE.Vector3()
  const maos = Object.entries(opcoes.maos ?? {}).flatMap(([n, [sinal, lado]]) => {
    const o = pivo?.getObjectByName(n)
    return o ? [{ o, sinal, lado, p: o.position.clone(), q: o.quaternion.clone() }] : []
  })
  const eixo = new THREE.Vector3(0, 0, 1)
  const giro = new THREE.Quaternion()
  const pegar = (graus: readonly [number, number]) => {
    for (const m of maos) {
      giro.setFromAxisAngle(eixo, THREE.MathUtils.degToRad(graus[m.lado]) * m.sinal)
      m.o.position.copy(m.p).applyQuaternion(giro)
      m.o.quaternion.copy(giro).multiply(m.q)
    }
  }

  const repouso = new THREE.Matrix4()
  const inv = new THREE.Matrix4()
  const cadeia = new THREE.Matrix4()
  const ajuste = new THREE.Matrix4()
  const t = new THREE.Matrix4()
  let frame: THREE.Object3D | null = null
  let pegada: readonly [number, number] = SEM_PEGADA
  carro.matrixAutoUpdate = false
  carro.updateMatrixWorld = () => {
    const pai = carro.parent
    frame ??= acharFrame(carro)
    const base = frame?.parent?.parent
    if (!pai || !frame || !base) {
      carro.matrixWorld.multiplyMatrices(pai?.matrixWorld ?? t.identity(), carro.matrix)
    } else {
      // Cadeia estática frame → pai (prop, raiz) e o frame como estaria com a cabeça em repouso.
      cadeia.copy(frame.matrixWorld).invert().multiply(pai.matrixWorld)
      repouso.multiplyMatrices(base.matrixWorld, frame.matrix)
      const g = grupo()
      const pg = g.pegada ?? SEM_PEGADA
      if (pg[0] !== pegada[0] || pg[1] !== pegada[1]) {
        pegada = pg
        pegar(pegada)
      }
      const [dx, dy, dz] = g.desloc
      ajuste
        .makeTranslation(centro.x + dx, centro.y + dy, centro.z + dz)
        .multiply(t.makeScale(g.escala, g.escala, g.escala))
        .multiply(t.makeTranslation(-centro.x, -centro.y, -centro.z))
      carro.matrixWorld.multiplyMatrices(repouso, cadeia).multiply(ajuste)
      carro.matrix.copy(inv.copy(pai.matrixWorld).invert()).multiply(carro.matrixWorld)
    }
    carro.matrixWorldNeedsUpdate = false
    // O grupo muda a cada quadro (a cabeça gira): os filhos sempre recalculam.
    for (const c of carro.children) c.updateMatrixWorld(true)
  }
  return carro
}

function acharFrame(o: THREE.Object3D) {
  for (let p: THREE.Object3D | null = o.parent; p; p = p.parent) if (p.name === 'frame') return p
  return null
}
