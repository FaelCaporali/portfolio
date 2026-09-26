/** Adereços que flutuam ao lado da cabeça: lupa, bússola, volante e laço do DevOps. */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Float } from './Float'
import { GLASS, GLOSS, GLOW, GOLD, NEEDLE, useDisposal, useMat } from './materials'

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
