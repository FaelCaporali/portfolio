/** Adereço que gira em torno da cabeça: rede neural. */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { withDissolve } from '../dissolve'
import { GLOW, useDisposal, useMat } from './materials'

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
  const line = useMemo(
    () => withDissolve(new THREE.LineBasicMaterial({ color: '#29d8ff', transparent: true, opacity: 0.6 })),
    [],
  )
  useDisposal(line)
  const pts = useMemo(() => Array.from({ length: NEURAL_NODES }, (_, i) => neuralNode(i)), [])
  // Cada nó liga ao vizinho e ao terceiro seguinte no anel.
  const links = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(pts.flatMap((p, i) => [p, neuralNode(i + 1), p, neuralNode(i + 3)])),
    [pts],
  )
  useDisposal(links)
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.35
  })
  return (
    <group position={[0, 0.25, -0.125]} rotation={[0.25, 0, 0.08]}>
      <group ref={g}>
        {pts.map((p, i) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- nós fixos do anel, nunca reordenam
          <mesh key={i} position={p} material={node}>
            <sphereGeometry args={[0.007, 16, 12]} />
          </mesh>
        ))}
        <lineSegments geometry={links} material={line} />
      </group>
    </group>
  )
}
