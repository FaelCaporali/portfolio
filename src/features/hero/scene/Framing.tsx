import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import type * as THREE from 'three'
import { computeFraming } from '../model/framing'

/** Aplica o enquadramento (model/framing.ts) à câmera sempre que a tela ou o espaço livre mudam. */
export function Framing({ free }: { free: readonly [number, number] }) {
  const { camera, size } = useThree()
  const [top, bottom] = free
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const { width: w, height: h } = size
    const f = computeFraming(w, h, [top, bottom])
    cam.fov = f.fov
    cam.setViewOffset(w, h, f.offsetX, f.offsetY, w, h)
    cam.lookAt(0, 0.17, -0.1)
    cam.updateProjectionMatrix()
  }, [camera, size, top, bottom])
  return null
}
