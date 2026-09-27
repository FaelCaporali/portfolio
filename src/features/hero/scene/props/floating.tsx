/** Adereço que flutua ao lado da cabeça: bússola (o laço do DevOps saiu com a vida "Solutions Architect"). */
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { Float } from './Float'
import { GOLD, NEEDLE, useMat } from './materials'

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
