/**
 * Reflexo próprio por material, vindo do glb (extras do material, exportados pelo lookdev):
 * - `envMapIntensity` (número): intensidade do reflexo do ambiente;
 * - `envSharp` (true): reflete a MESMA sala do site (RoomEnvironment) sem o borrado que a cena usa para a pele.
 *
 * O three usa `scene.environmentIntensity` (0,35 no herói, ver Lighting.tsx) para todo material sem `envMap` próprio e
 * ignora o `envMapIntensity` dele. Com o ambiente fraco e borrado, vidro sem reflexo some e metal vira cor chapada
 * (ouro "latão"); a peça ganha o seu reflexo sem mudar a luz da cena (o busto continua igual). O ambiente da cena é
 * criado num efeito de Lighting.tsx, por isso a atribuição acompanha `scene.environment` a cada quadro (só troca quando
 * muda).
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

type Standard = THREE.MeshStandardMaterial

const own = (m: THREE.Material): m is Standard =>
  (m as Partial<Standard>).isMeshStandardMaterial === true && typeof m.userData.envMapIntensity === 'number'

/** Materiais que pedem reflexo próprio (extras do glb). */
export const withOwnEnv = (materials: readonly THREE.Material[]) => materials.filter(own)

function sharpRoom(gl: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(gl)
  const room = new RoomEnvironment()
  const texture = pmrem.fromScene(room, 0).texture
  room.dispose()
  pmrem.dispose()
  return texture
}

/** Liga a cada material o ambiente pedido (o da cena ou a sala nítida), com a intensidade que ele traz do glb. */
export function useOwnEnvIntensity(materials: readonly Standard[]) {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const sharp = useMemo(
    () => (materials.some((m) => m.userData.envSharp === true) ? sharpRoom(gl) : null),
    [gl, materials],
  )
  useEffect(() => () => sharp?.dispose(), [sharp])
  useFrame(() => {
    for (const m of materials) {
      const env = m.userData.envSharp === true ? sharp : scene.environment
      if (m.envMap === env) continue
      m.envMap = env
      m.envMapIntensity = m.userData.envMapIntensity as number
      m.needsUpdate = true
    }
  })
}
