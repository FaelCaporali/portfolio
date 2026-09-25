/**
 * Vida "Entrepreneur": a cena dos negócios em volta da cabeça (SUP, bolo, beliche do hostel, notebook, kanban, leque de
 * cartões de visita e foguete). Forma e material: composição A do estúdio 3D (raiz `emp_todos` já posicionada no
 * espaço do frame, Draco). Na tela estreita (mesmo critério do enquadramento, `isWide`) cartões, beliche e bolo cairiam
 * sobre o texto da vida: ficam escondidos, e SUP, kanban, foguete e notebook cabem nas laterais.
 *
 * Movimento: o clip `montagem` bakeado no glb (2,1 s; t do clip = t desde a montagem, o último quadro é a composição
 * final) é POSICIONADO pelo relógio da vida, como o roteiro do financeiro (`ledger/timeline.ts`): o mixer nunca avança
 * sozinho. A vida remonta o componente a cada volta do carrossel, então o relógio recomeça do 0. Movimento reduzido:
 * estado final parado. Sem o clip: estática.
 */
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import empreendedorUrl from '../../../../../../3d/export/props/empreendedor.glb?url'
import { isWide } from '../../../model/layout'
import { withDissolve } from '../../dissolve'
import { useDisposal } from '../materials'
import { HALO_MAX, LAMP_COLOR, LAMP_MATERIAL, LAMP_MAX, createHalo, lampAt } from './lampada'

/** Peças que saem na tela estreita (caem sobre o texto). */
const WIDE_ONLY = ['cartoes', 'beliche', 'bolo'] as const
/** Clip da montagem e sua duração (s): depois dela, a cena fica no estado final. */
const CLIP = 'montagem'
const END = 2.1

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true

/** Clona a cena (geometrias e texturas seguem do cache do useGLTF) e troca cada material por um com a desintegração. */
function useEmpreendedorScene() {
  const { scene, animations } = useGLTF(empreendedorUrl)
  const cena = useMemo(() => {
    const root = scene.getObjectByName('emp_todos')
    if (!root) throw new Error('empreendedor.glb sem a raiz emp_todos')
    // As partes que se movem são ossos (skin): o clone precisa religar cada malha aos ossos do próprio clone.
    const copy = cloneSkinned(root)
    const materials: THREE.Material[] = []
    const own = (m: THREE.Material) => {
      const c = withDissolve(m.clone())
      materials.push(c)
      return c
    }
    copy.traverse((o) => {
      if (!isMesh(o)) return
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material)
      // A esfera de recorte da malha com esqueleto é medida uma vez, na pose do início (foguete escondido).
      if ((o as Partial<THREE.SkinnedMesh>).isSkinnedMesh) o.frustumCulled = false
    })
    const wideOnly = WIDE_ONLY.map((name) => {
      const node = copy.getObjectByName(name)
      if (!node) throw new Error(`empreendedor.glb sem o nó ${name}`)
      return node
    })
    // A lâmpada acende pelo mesmo relógio: só o emissivo do material dela muda (nada alocado por quadro).
    const lamp = materials.find((m): m is THREE.MeshStandardMaterial => m.name === LAMP_MATERIAL && 'emissive' in m)
    lamp?.emissive.copy(LAMP_COLOR)
    const luz = copy.getObjectByName(LAMP_MATERIAL)
    const halo = luz && isMesh(luz) ? createHalo(luz, withDissolve) : null
    if (halo && luz) luz.parent?.add(halo.mesh)
    // O mixer aponta para o clone: as trilhas acham os ossos do clone pelo nome.
    const clip = animations.find((a) => a.name === CLIP)
    const mixer = clip ? new THREE.AnimationMixer(copy) : null
    const action = clip && mixer ? mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).play() : null
    /** Posiciona o clip no instante t (s desde a montagem). update(0) só amostra: nada avança, nada é alocado. */
    const pose = (t: number) => {
      const k = lampAt(t)
      if (lamp) lamp.emissiveIntensity = LAMP_MAX * k
      if (halo) halo.material.opacity = HALO_MAX * k
      if (!action || !mixer) return
      action.time = Math.min(t, END, action.getClip().duration)
      mixer.update(0)
    }
    // O descarte NÃO para o mixer: no modo estrito do React (e ao reexibir um Suspense) o efeito desmonta e remonta
    // com o mesmo useMemo; parar/descachear a ação ali congelava a cena no repouso (= estado final). O mixer só
    // referencia o clone e o clip e vai embora com eles.
    const dispose = () => {
      materials.forEach((m) => m.dispose())
      halo?.dispose()
    }
    return { root: copy, wideOnly, animated: action !== null || lamp !== undefined, pose, dispose }
  }, [scene, animations])
  useDisposal(cena)
  return cena
}

export function Empreendedor() {
  const { root, wideOnly, animated, pose } = useEmpreendedorScene()
  const wide = useThree((s) => isWide(s.size.width, s.size.height))
  // Relógio da vida (s desde a montagem); com movimento reduzido nasce no fim.
  const clock = useRef(prefersReducedMotion() ? END : 0)

  useLayoutEffect(() => {
    for (const node of wideOnly) node.visible = wide
  }, [wideOnly, wide])

  // Primeiro quadro já na pose do relógio (o glb em repouso é o estado final).
  useLayoutEffect(() => pose(clock.current), [pose])

  useFrame((_, dt) => {
    if (!animated || clock.current >= END) return
    // Mesmo passo máximo do relógio do carrossel: aba em segundo plano não pula o roteiro.
    clock.current += Math.min(dt, 0.1)
    pose(clock.current)
  })

  return <primitive object={root} />
}

useGLTF.preload(empreendedorUrl)
