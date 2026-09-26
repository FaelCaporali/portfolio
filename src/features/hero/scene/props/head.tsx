/** Adereços presos à cabeça: fones. */
import { useMemo } from 'react'
import * as THREE from 'three'
import { GLOSS, useDisposal, useMat } from './materials'

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
