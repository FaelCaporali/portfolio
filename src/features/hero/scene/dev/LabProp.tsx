/**
 * Adereço do laboratório (só em desenvolvimento, ver lab.ts): o glb pedido em `?lab=`, clonado, com a desintegração em
 * todos os materiais e as animações do glb tocando em laço (com movimento reduzido, paradas no quadro final).
 * Geometrias e texturas são do cache do useGLTF; só os materiais clonados e o mixer são deste componente.
 */
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { withDissolve } from '../dissolve'
import { useOwnEnvIntensity, withOwnEnv } from '../envIntensity'
import { useDisposal } from '../props/materials'
import { withTransmissionBackdrop } from '../transmission'

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Clona a cena e troca cada material por um clone com a desintegração; devolve os materiais para liberar. */
function prepare(source: THREE.Object3D) {
  const root = clone(source)
  const materials: THREE.Material[] = []
  const own = (m: THREE.Material) => {
    const c = withTransmissionBackdrop(withDissolve(m.clone()))
    materials.push(c)
    return c
  }
  root.traverse((o) => {
    if (!isMesh(o)) return
    o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material)
  })
  return { root, ownEnv: withOwnEnv(materials), dispose: () => materials.forEach((m) => m.dispose()) }
}

export function LabProp({ url }: { url: string }) {
  const gltf = useGLTF(url)
  const lab = useMemo(() => prepare(gltf.scene), [gltf.scene])
  useDisposal(lab)
  useOwnEnvIntensity(lab.ownEnv)
  const mixer = useMemo(() => new THREE.AnimationMixer(lab.root), [lab.root])

  useEffect(() => {
    const still = reducedMotion()
    const actions = gltf.animations.map((clip) => {
      const a = mixer.clipAction(clip)
      if (still) {
        a.setLoop(THREE.LoopOnce, 1)
        a.clampWhenFinished = true
      }
      a.play()
      if (still) a.time = clip.duration
      return a
    })
    mixer.update(0)
    return () => {
      actions.forEach((a) => a.stop())
      mixer.stopAllAction()
      gltf.animations.forEach((clip) => mixer.uncacheClip(clip))
    }
  }, [gltf.animations, mixer])

  // Mesmo passo máximo do relógio do carrossel.
  useFrame((_, dt) => {
    mixer.update(Math.min(dt, 0.1))
  })

  return <primitive object={lab.root} />
}
