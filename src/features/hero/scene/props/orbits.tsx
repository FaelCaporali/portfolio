/** Adereços que giram em torno da cabeça: rede neural e moedas. */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { withDissolve } from '../dissolve'
import { GLOW, GOLD, useDisposable, useMat } from './materials'

const NEURAL_NODES = 9

/** Nó i do anel neural (o índice dá a volta). */
function neuralNode(i: number) {
  const k = i % NEURAL_NODES
  const a = (k / NEURAL_NODES) * Math.PI * 2
  return new THREE.Vector3(Math.cos(a) * 0.19, Math.sin(k * 2.1) * 0.025, Math.sin(a) * 0.19)
}

export function Neural() {
  const g = useRef<THREE.Group>(null)
  const node = useMat('#bff4ff', GLOW)
  const line = useDisposable(
    () => withDissolve(new THREE.LineBasicMaterial({ color: '#29d8ff', transparent: true, opacity: 0.6 })),
    [],
  )
  const pts = useMemo(() => Array.from({ length: NEURAL_NODES }, (_, i) => neuralNode(i)), [])
  // Cada nó liga ao vizinho e ao terceiro seguinte no anel.
  const links = useDisposable(
    () => new THREE.BufferGeometry().setFromPoints(pts.flatMap((p, i) => [p, neuralNode(i + 1), p, neuralNode(i + 3)])),
    [pts],
  )
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.35
  })
  return (
    <group position={[0, 0.25, -0.125]} rotation={[0.25, 0, 0.08]}>
      <group ref={g}>
        {pts.map((p, i) => (
          <mesh key={i} position={p} material={node}>
            <sphereGeometry args={[0.007, 16, 12]} />
          </mesh>
        ))}
        <lineSegments geometry={links} material={line} />
      </group>
    </group>
  )
}

export function Coins() {
  const gold = useMat('#ffcc3d', GOLD)
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.6
  })
  return (
    <group position={[0, 0.2, -0.125]}>
      <group ref={g}>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 0.17, Math.sin(i * 1.7) * 0.05, Math.sin(a) * 0.17]}
              rotation={[Math.PI / 2, 0, a]}
              material={gold}
            >
              <cylinderGeometry args={[0.02, 0.02, 0.004, 32]} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}
