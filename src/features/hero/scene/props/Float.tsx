import { useFrame } from '@react-three/fiber'
import { useRef, type ComponentProps, type ReactNode } from 'react'
import type * as THREE from 'three'

/** Flutua em torno da posição dada (seno em y). */
export function Float({
  children,
  speed = 1,
  amp = 0.006,
  ...p
}: { children: ReactNode; speed?: number; amp?: number } & ComponentProps<'group'>) {
  const g = useRef<THREE.Group>(null)
  const y0 = (p.position as [number, number, number] | undefined)?.[1] ?? 0
  useFrame(({ clock }) => {
    if (g.current) g.current.position.y = y0 + Math.sin(clock.elapsedTime * speed) * amp
  })
  return (
    <group ref={g} {...p}>
      {children}
    </group>
  )
}
