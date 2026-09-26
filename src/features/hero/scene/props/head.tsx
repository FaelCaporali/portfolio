/** Adereços presos à cabeça: casco e aba de boné, fones e lágrimas. */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GLOSS, TEAR, useDisposal, useMat } from './materials'

/** Casco sobre o crânio (boné, chapéu): elipsoide cortado, centro e raios medidos. */
export function Dome({ color, y = 0.232 }: { color: string; y?: number }) {
  const m = useMat(color)
  return (
    <mesh position={[0, y, -0.12]} scale={[0.098, 0.092, 0.132]} material={m}>
      <sphereGeometry args={[1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
    </mesh>
  )
}

/** Aba de boné: meia elipse só para a frente, saindo da borda do casco. */
export function Brim({ color, y = 0.236, depth = 0.09 }: { color: string; y?: number; depth?: number }) {
  const m = useMat(color)
  return (
    <mesh position={[0, y, 0.0]} rotation={[0.22, 0, 0]} scale={[0.082, 1, depth]} material={m}>
      <cylinderGeometry args={[1, 1, 0.006, 40, 1, false, -Math.PI / 2, Math.PI]} />
    </mesh>
  )
}

export function Headphones({ color = '#1b1d22', mic = false }: { color?: string; mic?: boolean }) {
  const m = useMat(color, GLOSS)
  const accent = useMat('#3ddc84', GLOSS)
  const boom = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.112, 0.175, -0.12),
          new THREE.Vector3(0.1, 0.12, -0.04),
          new THREE.Vector3(0.045, 0.098, 0.035),
        ]),
        24,
        0.0032,
        8,
      ),
    [],
  )
  useDisposal(boom)
  return (
    <group>
      <mesh position={[0, 0.2, -0.13]} scale={[0.8, 1, 1]} material={m}>
        <torusGeometry args={[0.14, 0.008, 12, 48, Math.PI]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.106, 0.18, -0.13]} rotation={[0, 0, Math.PI / 2]}>
          <mesh material={m}>
            <cylinderGeometry args={[0.034, 0.034, 0.026, 32]} />
          </mesh>
          <mesh position={[0, s * 0.014, 0]} material={accent}>
            <cylinderGeometry args={[0.024, 0.024, 0.004, 32]} />
          </mesh>
        </group>
      ))}
      {mic && (
        <>
          <mesh geometry={boom} material={m} />
          <mesh position={[0.045, 0.098, 0.035]} material={m}>
            <sphereGeometry args={[0.009, 16, 12]} />
          </mesh>
        </>
      )}
    </group>
  )
}

export function Tears() {
  const m = useMat('#9fd3ff', TEAR)
  const drops = useRef<THREE.Mesh[]>([])
  useFrame(({ clock }) => {
    drops.current.forEach((d, i) => {
      const t = (clock.elapsedTime * 0.7 + i * 0.37) % 1
      d.position.y = 0.162 - t * 0.075
      d.position.z = 0.012 + t * 0.012
      d.scale.setScalar(t < 0.1 ? t * 10 : 1)
    })
  })
  return (
    <>
      {[-1, 1].flatMap((s) =>
        [0, 1].map((k) => (
          <mesh
            key={`${s}${k}`}
            ref={(el) => {
              if (el) drops.current[s + 1 + k] = el
            }}
            position={[s * 0.05, 0.16, 0.01]}
            scale={[1, 1.5, 1]}
            material={m}
          >
            <sphereGeometry args={[0.0045, 12, 10]} />
          </mesh>
        )),
      )}
    </>
  )
}
