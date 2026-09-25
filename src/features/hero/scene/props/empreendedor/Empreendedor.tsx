/**
 * Vida "Entrepreneur": a cena dos negócios em volta da cabeça (SUP, bolo, beliche do hostel, notebook, kanban, leque de
 * cartões de visita e foguete). Forma e material: composição A do estúdio 3D (raiz `emp_todos` já posicionada no
 * espaço do frame, Draco). Estática nesta volta. Na tela estreita (mesmo critério do enquadramento, `isWide`) cartões,
 * beliche e bolo cairiam sobre o texto da vida: ficam escondidos, e SUP, kanban, foguete e notebook cabem nas laterais.
 */
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import empreendedorUrl from '../../../../../../3d/export/props/empreendedor.glb?url'
import { isWide } from '../../../model/layout'
import { withDissolve } from '../../dissolve'
import { useDisposal } from '../materials'

/** Peças que saem na tela estreita (caem sobre o texto). */
const WIDE_ONLY = ['cartoes', 'beliche', 'bolo'] as const

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true

/** Clona a cena (geometrias e texturas seguem do cache do useGLTF) e troca cada material por um com a desintegração. */
function useEmpreendedorScene() {
  const { scene } = useGLTF(empreendedorUrl)
  const cena = useMemo(() => {
    const root = scene.getObjectByName('emp_todos')
    if (!root) throw new Error('empreendedor.glb sem a raiz emp_todos')
    const copy = root.clone()
    const materials: THREE.Material[] = []
    const own = (m: THREE.Material) => {
      const c = withDissolve(m.clone())
      materials.push(c)
      return c
    }
    copy.traverse((o) => {
      if (isMesh(o)) o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material)
    })
    const wideOnly = WIDE_ONLY.map((name) => {
      const node = copy.getObjectByName(name)
      if (!node) throw new Error(`empreendedor.glb sem o nó ${name}`)
      return node
    })
    return { root: copy, wideOnly, dispose: () => materials.forEach((m) => m.dispose()) }
  }, [scene])
  useDisposal(cena)
  return cena
}

export function Empreendedor() {
  const { root, wideOnly } = useEmpreendedorScene()
  const wide = useThree((s) => isWide(s.size.width, s.size.height))

  useLayoutEffect(() => {
    for (const node of wideOnly) node.visible = wide
  }, [wideOnly, wide])

  return <primitive object={root} />
}

useGLTF.preload(empreendedorUrl)
