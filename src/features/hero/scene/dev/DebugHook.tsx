import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { createHeroDebug } from './debug'

/** Publica `window.__heroDebug` enquanto a cena existe (só em desenvolvimento; ver debug.ts). */
export function DebugHook() {
  const get = useThree((s) => s.get)
  useEffect(() => {
    window.__heroDebug = createHeroDebug(get)
    return () => {
      delete window.__heroDebug
    }
  }, [get])
  return null
}
