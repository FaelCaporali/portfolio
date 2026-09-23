import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/** Reflexos de ambiente (sala neutra, fraca) e três luzes: chave quente, preenchimento frio e contraluz. */
export function Lighting() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.35
    return () => {
      env.dispose()
      pmrem.dispose()
      scene.environment = null
    }
  }, [gl, scene])
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[-0.6, 0.8, 0.9]} intensity={2.2} color="#fff3e6" />
      <directionalLight position={[0.8, 0.3, 0.6]} intensity={0.6} color="#dfe8ff" />
      <directionalLight position={[0.3, 0.4, -1]} intensity={0.5} color="#ffffff" />
    </>
  )
}
