/**
 * Vida "Sailing Instructor" (vela): o Fael veste boné e óculos de velejador (V2, V3) e um Laser e um Optimist navegam
 * em volta da cabeça numa aula (V8): circuito fechado, vento fixo, virada de bordo e jaibe, o Optimist na esteira do
 * Laser repetindo as manobras (aula.ts, barco.ts). Em teste (V9, V10): o apito de instrutor no cordão fechado por um
 * lais de guia. Forma e material: o glb do estúdio (raiz `vela`, meshopt + quantização).
 *
 * Boné, óculos e apito não têm movimento próprio: são filhos do `frame` e seguem a cabeça (olhar e arrasto). A lente
 * (`vela_lente`) é o único material transparente: desenhada depois da sombra do olho do busto (renderOrder), dos dois
 * lados, sem escrever profundidade, e com a desintegração como todo material. O trecho do cordão em volta do pescoço
 * usa o mesmo degradê de pescoço da pele (some junto na base); o pendente e o apito, só a desintegração.
 * Movimento reduzido: nada roda; os barcos ficam na composição parada do glb (lado L).
 * Nó que o glb ainda não tiver fica de fora (a peça chega por partes durante a volta).
 */
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import velaUrl from '../../../../../../3d/export/props/vela.glb?url'
import { withDissolve } from '../../dissolve'
import { useDisposal } from '../materials'
import { ATRASO, ONDAS, balanco, type Balanco } from './aula'
import { criarBarco } from './barco'

/** Material transparente da lente e ordem de desenho: depois da sombra do olho do busto (renderOrder 1, rig.ts). */
const LENTE = 'vela_lente'
const ORDEM_LENTE = 2
/** Nós com o degradê do pescoço (o cordão que contorna o pescoço por baixo da barba). */
const PESCOCO = /^vela_apito_cordao_pescoco/

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true

/** Algum ancestral (ou o próprio) casa com o teste. */
function sob(o: THREE.Object3D, teste: (p: THREE.Object3D) => boolean) {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (teste(p)) return true
  return false
}

/** Clona a cena (geometrias e texturas seguem do cache do useGLTF) e troca cada material por um com a desintegração. */
function useVelaScene() {
  const { scene } = useGLTF(velaUrl, false)
  const cena = useMemo(() => {
    const root = scene.getObjectByName('vela')
    if (!root) throw new Error('vela.glb sem a raiz vela')
    const copy = root.clone(true)
    const materials: THREE.Material[] = []
    copy.traverse((o) => {
      if (!isMesh(o)) return
      const neckFade = sob(o, (p) => PESCOCO.test(p.name))
      const own = (m: THREE.Material) => {
        const c = withDissolve(m.clone(), { neckFade })
        if (c.name === LENTE) {
          c.transparent = true
          c.depthWrite = false
          // Casca de uma face só: dos dois lados (medido 25/09: só de frente, 98 % da lente não escurecia).
          c.side = THREE.DoubleSide
          o.renderOrder = ORDEM_LENTE
        }
        materials.push(c)
        return c
      }
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material)
    })
    const barcos = [
      { barco: criarBarco(copy, 'vela_laser', 'retranca', 0), onda: ONDAS.laser },
      { barco: criarBarco(copy, 'vela_optimist', 'vela', ATRASO), onda: ONDAS.optimist },
    ]
    const b: Balanco = { aderna: 0, arfa: 0 }
    /** Pose no instante t (s desde a montagem). Nada alocado. */
    const pose = (t: number, dt: number) => {
      for (const { barco, onda } of barcos) barco?.pose(t, dt, balanco(t, onda, b))
    }
    const dispose = () => materials.forEach((mat) => mat.dispose())
    return { root: copy, pose, dispose }
  }, [scene])
  useDisposal(cena)
  return cena
}

export function Vela() {
  const { root, pose } = useVelaScene()
  // Relógio da vida (s desde a montagem); com movimento reduzido não anda.
  const [reduced] = useState(prefersReducedMotion)
  const clock = useRef(0)

  // Primeiro quadro já na pose do relógio (movimento reduzido: a composição parada do glb, intocada).
  useLayoutEffect(() => {
    if (!reduced) pose(clock.current, 0)
  }, [pose, reduced])

  useFrame((_, delta) => {
    if (reduced) return
    // Mesmo passo máximo do relógio do carrossel: aba em segundo plano não pula o roteiro.
    const dt = Math.min(delta, 0.1)
    clock.current += dt
    pose(clock.current, dt)
  })

  return <primitive object={root} />
}

useGLTF.preload(velaUrl, false)
