import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { withDissolve } from '../dissolve'

/**
 * Libera da GPU, ao desmontar ou ao trocar, um objeto do three.js criado pelo componente (useMemo). Os adereços
 * trocam a cada vida: sem o dispose, cada troca deixava materiais e geometrias órfãos.
 */
export function useDisposal(value: { dispose: () => void }) {
  useEffect(
    () => () => {
      value.dispose()
    },
    [value],
  )
}

/** Acabamentos (constantes de módulo: o material só é recriado quando cor ou acabamento mudam). */
export const MATTE: THREE.MeshStandardMaterialParameters = {}
export const GLOSS = { roughness: 0.25 }
export const GOLD = { metalness: 0.55, roughness: 0.28, emissive: new THREE.Color('#5a3d00'), emissiveIntensity: 0.6 }
export const GLOW = { emissive: new THREE.Color('#29d8ff'), emissiveIntensity: 1.6 }
export const GLASS = { transparent: true, opacity: 0.18, roughness: 0.05 }
export const FLAME = { emissive: new THREE.Color('#ff7a1a'), emissiveIntensity: 2 }
export const NEEDLE = { emissive: new THREE.Color('#ff4d4d'), emissiveIntensity: 0.6 }
export const TEAR = { transparent: true, opacity: 0.85, roughness: 0.05 }

/** Material padrão dos adereços, com a desintegração. */
export function useMat(color: string, finish: THREE.MeshStandardMaterialParameters = MATTE) {
  const material = useMemo(
    () => withDissolve(new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...finish })),
    [color, finish],
  )
  useDisposal(material)
  return material
}
