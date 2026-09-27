/** Adereços que flutuam ao lado da cabeça: bússola e laço do DevOps. */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Float } from './Float'
import { GLOSS, GLOW, GOLD, NEEDLE, useDisposal, useMat } from './materials'

export function Compass() {
  const body = useMat('#ffd166', GOLD)
  const face = useMat('#101216')
  const needle = useMat('#ff4d4d', NEEDLE)
  const n = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (n.current) n.current.rotation.z = Math.sin(clock.elapsedTime * 1.4) * 0.5
  })
  return (
    <Float position={[0.19, 0.13, -0.03]} speed={1.2}>
      <group rotation={[0.2, -0.5, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={body}>
          <cylinderGeometry args={[0.036, 0.036, 0.012, 40]} />
        </mesh>
        <mesh position={[0, 0, 0.0065]} rotation={[Math.PI / 2, 0, 0]} material={face}>
          <cylinderGeometry args={[0.031, 0.031, 0.001, 40]} />
        </mesh>
        <mesh ref={n} position={[0, 0, 0.008]} material={needle}>
          <coneGeometry args={[0.006, 0.05, 4]} />
        </mesh>
      </group>
    </Float>
  )
}

/** Laço do infinito (build → deploy → monitora → volta), com um pulso correndo por ele. */
export function InfinityLoop() {
  const loop = useMat('#ff6ec7', GLOSS)
  const pulse = useMat('#ffe3f4', GLOW)
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        Array.from({ length: 48 }, (_, i) => {
          // Lemniscata de Bernoulli, com um leve cruzamento em profundidade para o tubo não se atravessar.
          const t = (i / 48) * Math.PI * 2
          const k = 1 + Math.sin(t) ** 2
          return new THREE.Vector3(
            (0.036 * Math.cos(t)) / k,
            (0.036 * Math.sin(t) * Math.cos(t)) / k,
            0.005 * Math.sin(t),
          )
        }),
        true,
      ),
    [],
  )
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 128, 0.0042, 12, true), [curve])
  useDisposal(tube)
  const dot = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    dot.current?.position.copy(curve.getPointAt((clock.elapsedTime * 0.35) % 1))
  })
  return (
    <Float position={[0.15, 0.25, -0.03]} speed={1.2} amp={0.008}>
      <group rotation={[0.15, -0.45, 0.1]}>
        <mesh geometry={tube} material={loop} />
        <mesh ref={dot} material={pulse}>
          <sphereGeometry args={[0.007, 16, 12]} />
        </mesh>
      </group>
    </Float>
  )
}
