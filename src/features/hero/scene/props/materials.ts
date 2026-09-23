import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { withDissolve } from '../dissolve'

/**
 * Objeto do three.js criado uma vez por montagem e liberado da GPU ao desmontar. Os adereços trocam a cada vida:
 * sem o dispose, cada troca deixava materiais e geometrias órfãos.
 */
export function useDisposable<T extends { dispose: () => void }>(create: () => T, deps: readonly unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps repassadas de quem chama, como no useMemo
  const value = useMemo(create, deps)
  useEffect(
    () => () => {
      value.dispose()
    },
    [value],
  )
  return value
}

/** Acabamentos (constantes de módulo: o material só é recriado quando cor ou acabamento mudam). */
export const MATTE: THREE.MeshStandardMaterialParameters = {}
export const GLOSS = { roughness: 0.25 }
export const GOLD = { metalness: 0.55, roughness: 0.28, emissive: new THREE.Color('#5a3d00'), emissiveIntensity: 0.6 }
export const GLOW = { emissive: new THREE.Color('#29d8ff'), emissiveIntensity: 1.6 }
export const LENS = { roughness: 0.05, metalness: 0.6 }
export const GLASS = { transparent: true, opacity: 0.18, roughness: 0.05 }
export const FLAME = { emissive: new THREE.Color('#ff7a1a'), emissiveIntensity: 2 }
export const DOUBLE_SIDED = { side: THREE.DoubleSide }
export const NEEDLE = { emissive: new THREE.Color('#ff4d4d'), emissiveIntensity: 0.6 }
export const TEAR = { transparent: true, opacity: 0.85, roughness: 0.05 }

/** Material padrão dos adereços, com a desintegração. */
export function useMat(color: string, finish: THREE.MeshStandardMaterialParameters = MATTE) {
  return useDisposable(
    () => withDissolve(new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...finish })),
    [color, finish],
  )
}
