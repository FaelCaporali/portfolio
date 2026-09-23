/** Adereços que flutuam ao lado da cabeça: lupa, foguete, veleiro, bússola e volante. */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Float } from './Float'
import { DOUBLE_SIDED, FLAME, GLASS, GLOSS, GOLD, NEEDLE, useDisposal, useMat } from './materials'

export function Magnifier() {
  const rim = useMat('#e0324b', GLOSS)
  const glass = useMat('#cfe8ff', GLASS)
  return (
    <Float position={[-0.045, 0.172, 0.06]} speed={1.3} amp={0.004}>
      <group rotation={[0, 0.25, 0.5]}>
        <mesh material={rim}>
          <torusGeometry args={[0.034, 0.0045, 12, 48]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={glass}>
          <cylinderGeometry args={[0.032, 0.032, 0.002, 40]} />
        </mesh>
        <mesh position={[0, -0.068, 0]} material={rim}>
          <cylinderGeometry args={[0.0055, 0.0065, 0.07, 16]} />
        </mesh>
      </group>
    </Float>
  )
}

export function Rocket() {
  const body = useMat('#f2f2f2', GLOSS)
  const red = useMat('#ff7a1a', GLOSS)
  const flame = useMat('#ffd166', FLAME)
  return (
    <Float position={[0.19, 0.2, -0.06]} speed={1.6} amp={0.01}>
      <group rotation={[0, 0, -0.35]}>
        <mesh material={body}>
          <cylinderGeometry args={[0.018, 0.02, 0.07, 24]} />
        </mesh>
        <mesh position={[0, 0.05, 0]} material={red}>
          <coneGeometry args={[0.018, 0.032, 24]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            position={[Math.cos((i * 2 * Math.PI) / 3) * 0.02, -0.03, Math.sin((i * 2 * Math.PI) / 3) * 0.02]}
            rotation={[0, (-i * 2 * Math.PI) / 3, 0]}
            material={red}
          >
            <boxGeometry args={[0.018, 0.022, 0.003]} />
          </mesh>
        ))}
        <mesh position={[0, -0.05, 0]} rotation={[Math.PI, 0, 0]} material={flame}>
          <coneGeometry args={[0.012, 0.03, 16]} />
        </mesh>
      </group>
    </Float>
  )
}

export function Sailboat() {
  const hull = useMat('#f2f2f2', GLOSS)
  const sail = useMat('#2ea8ff', DOUBLE_SIDED)
  const sailGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.005, 0, 0, 0.075, 0, 0.045, 0.005, 0], 3))
    g.computeVertexNormals()
    return g
  }, [])
  useDisposal(sailGeo)
  return (
    <Float position={[-0.2, 0.1, -0.05]} speed={1.1} amp={0.008}>
      <group rotation={[0.1, 0.6, 0]}>
        <mesh scale={[1, 0.35, 0.4]} material={hull}>
          <sphereGeometry args={[0.04, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 0.04, 0]} material={hull}>
          <cylinderGeometry args={[0.0015, 0.0015, 0.08, 8]} />
        </mesh>
        <mesh geometry={sailGeo} material={sail} />
      </group>
    </Float>
  )
}

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

export function Wheel() {
  const m = useMat('#2a2c31', GLOSS)
  return (
    <Float position={[0.2, 0.12, -0.04]} speed={0.9} amp={0.006}>
      <group rotation={[0.1, -0.5, 0.25]}>
        <mesh material={m}>
          <torusGeometry args={[0.075, 0.009, 14, 56]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            rotation={[0, 0, (i * 2 * Math.PI) / 3 + Math.PI / 2]}
            position={[
              Math.cos((i * 2 * Math.PI) / 3 + Math.PI / 2) * 0.037,
              Math.sin((i * 2 * Math.PI) / 3 + Math.PI / 2) * 0.037,
              0,
            ]}
            material={m}
          >
            <boxGeometry args={[0.075, 0.009, 0.006]} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]} material={m}>
          <cylinderGeometry args={[0.018, 0.018, 0.012, 24]} />
        </mesh>
      </group>
    </Float>
  )
}
