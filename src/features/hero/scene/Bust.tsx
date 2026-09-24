import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, lazy, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import bustUrl from '../../../../3d/export/s13/busto-s13.glb?url'
import type { Expression, PropId } from '../../../content/journey'
import { stepDrag, type DragState } from '../model/drag'
import { createFace, stepFace } from '../model/face'
import { createGaze, stepGaze, type Pointer } from '../model/gaze'
import { readLabUrl } from './dev/lab'
import { dissolveUniforms } from './dissolve'
import { Props } from './props/Props'
import { applyEyes, applyFace, buildRig } from './rig'
import { Vortex } from './Vortex'

/** Pivô de rotação da cabeça: base do pescoço, no espaço do glb (Y para cima, rosto para +Z). */
const PIVOT = new THREE.Vector3(0, 0.05, -0.13)

/** Laboratório do estúdio 3D (`?lab=<glb>`): só existe no servidor de desenvolvimento; o build o descarta. */
const LabProp = import.meta.env.DEV ? lazy(() => import('./dev/LabProp').then((m) => ({ default: m.LabProp }))) : null

interface BustProps {
  expr: Expression
  prop: PropId
  /** Ponteiro relativo ao busto, atualizado fora do React. */
  pointer: RefObject<Pointer>
  /** Giro por arrasto, escrito pelos eventos de ponteiro do herói. */
  drag: RefObject<DragState>
  /** Fração das partículas do furacão (qualidade adaptativa). */
  particles: number
}

/** O busto do S13 com expressão da vida, piscar, olhar que segue o ponteiro, arrasto, adereço e furacão. */
export function Bust({ expr, prop, pointer, drag, particles }: BustProps) {
  const { scene } = useGLTF(bustUrl)
  const head = useRef<THREE.Group>(null)
  const frame = useRef<THREE.Group>(null)
  const rig = useMemo(() => buildRig(scene), [scene])
  const face = useRef(createFace())
  const gaze = useRef(createGaze())
  const eye = useMemo(() => ({ quat: new THREE.Quaternion(), euler: new THREE.Euler() }), [])
  const [lab] = useState(() => (LabProp ? readLabUrl(window.location.search) : null))

  useFrame((_, dt) => {
    stepFace(face.current, expr, dt)
    applyFace(rig, face.current)

    stepDrag(drag.current, dt)
    const g = gaze.current
    stepGaze(g, pointer.current, drag.current, dt)
    head.current?.rotation.set(-g.headUp, g.headRight, 0)
    eye.euler.set(-g.eyeUp, g.eyeRight, 0, 'YXZ')
    applyEyes(rig, eye.quat.setFromEuler(eye.euler))

    if (frame.current) {
      frame.current.updateWorldMatrix(true, false)
      dissolveUniforms.uToGlb.value.copy(frame.current.matrixWorld).invert()
    }
  })

  return (
    <group position={PIVOT}>
      <group ref={head}>
        {/* frame = espaço do glb: busto, adereços e partículas compartilham as mesmas coordenadas */}
        {/* Nomes frame, bust e prop: lidos pelo gancho de depuração do estúdio 3D (dev/debug.ts). */}
        <group ref={frame} name="frame" position={PIVOT.clone().negate()}>
          <group name="bust">
            <primitive object={scene} />
          </group>
          <group name="prop">
            <Props id={prop} />
            {/* O laboratório SOMA à vida (peça complementar julgada junto com o que já está aprovado). */}
            {LabProp && lab ? (
              <Suspense fallback={null}>
                <LabProp url={lab} />
              </Suspense>
            ) : null}
          </group>
          <Vortex skin={rig.skin} fraction={particles} />
        </group>
      </group>
    </group>
  )
}

useGLTF.preload(bustUrl)
