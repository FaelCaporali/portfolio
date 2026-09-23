/**
 * O glb do busto preparado para o navegador: materiais, shape keys por nome e os olhos. Aqui ficam os nomes do glb
 * (materiais, chaves, nós); o resto do herói não os conhece.
 */
import * as THREE from 'three'
import type { Face } from '../model/face'
import { withDissolve } from './dissolve'

type Channels = Map<string, { mesh: THREE.Mesh; index: number }[]>

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true

export interface Rig {
  /** Malha da pele: fonte das partículas do furacão. */
  skin: THREE.Mesh
  channels: Channels
  eyes: { node: THREE.Object3D; base: THREE.Quaternion }[]
}

function collectChannels(root: THREE.Object3D): Channels {
  const channels: Channels = new Map()
  root.traverse((o) => {
    if (!isMesh(o) || !o.morphTargetDictionary) return
    const mesh = o
    for (const [name, index] of Object.entries(o.morphTargetDictionary)) {
      const list = channels.get(name) ?? []
      list.push({ mesh, index })
      channels.set(name, list)
    }
  })
  return channels
}

function setKey(channels: Channels, name: string, value: number) {
  for (const { mesh, index } of channels.get(name) ?? []) {
    if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = value
  }
}

/**
 * Materiais do glb para o navegador. O glb guarda a transparência da sombra do olho em COLOR_1 e a conjuntiva como
 * emissão (Blender); o three.js lê só COLOR_0 (opaco) e ilumina tudo, e a sombra virava uma calota preta sobre o olho.
 * Todos recebem a desintegração; a pele também o degradê do pescoço.
 */
function prepareMaterials(root: THREE.Object3D): THREE.Mesh {
  let skin: THREE.Mesh | undefined
  root.traverse((o) => {
    if (!isMesh(o)) return
    const mesh = o
    const mat = mesh.material as THREE.MeshStandardMaterial
    if (mat.name === 'SombraOlho') {
      // O three.js tipa getAttribute como sempre presente; hasAttribute é a checagem real.
      if (mesh.geometry.hasAttribute('color_1'))
        mesh.geometry.setAttribute('color', mesh.geometry.getAttribute('color_1'))
      mesh.material = withDissolve(
        new THREE.MeshBasicMaterial({
          color: mat.color,
          vertexColors: true,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      )
      mesh.renderOrder = 1
    } else if (mat.name === 'Conjuntiva') {
      mesh.material = withDissolve(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))
    } else if (mat.name === '3DModel') {
      mat.roughness = 0.72
      withDissolve(mat, { neckFade: true })
      skin = mesh
    } else {
      withDissolve(mat)
    }
  })
  if (!skin) throw new Error('glb do busto sem o material da pele (3DModel)')
  return skin
}

function findEyes(root: THREE.Object3D): Rig['eyes'] {
  return ['Olho_D', 'Olho_E'].map((name) => {
    const node = root.getObjectByName(name)
    if (!node) throw new Error(`glb do busto sem o nó ${name}`)
    return { node, base: node.quaternion.clone() }
  })
}

export function buildRig(scene: THREE.Object3D): Rig {
  return { skin: prepareMaterials(scene), channels: collectChannels(scene), eyes: findEyes(scene) }
}

/** Estado do rosto → shape keys do glb. */
export function applyFace({ channels }: Rig, f: Face) {
  setKey(channels, 'mouthSmileLeft', f.smile)
  setKey(channels, 'mouthSmileRight', f.smile)
  setKey(channels, 'mouthSmileFix', f.smile) // a chave corretiva é min(L, R): obrigatória em todo sorriso
  setKey(channels, 'browInnerUp', f.innerUp)
  setKey(channels, 'browOuterUpLeft', f.outerUp)
  setKey(channels, 'browOuterUpRight', f.outerUp)
  setKey(channels, 'browDownLeft', f.down)
  setKey(channels, 'browDownRight', f.down)
  setKey(channels, 'eyeBlinkLeft', f.blink)
  setKey(channels, 'eyeBlinkRight', f.blink)
}

/** Gira os dois olhos pela mesma rotação de olhar, sobre a pose de repouso de cada um. */
export function applyEyes({ eyes }: Rig, gaze: THREE.Quaternion) {
  for (const e of eyes) e.node.quaternion.copy(gaze).multiply(e.base)
}
