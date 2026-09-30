import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import bustUrl from '../../../../3d/export/s13/busto-s13.glb?url'
import type { Expression, PropId } from '../../../content/journey'
import { stepDrag, type DragState } from '../model/drag'
import { createFace, stepFace } from '../model/face'
import { alvoDoAdereco, createGaze, mirarAlvo, stepGaze, type Pointer } from '../model/gaze'
import { lerCarga, useGlb } from './carga'
import type { Palco } from './palco'
import { dissolveUniforms } from './dissolve'
import { prepararObjeto } from './preparo'
import { Props } from './props/Props'
import { applyEyes, applyFace, buildRig } from './rig'
import { Vortex } from './Vortex'

/** Pivô de rotação da cabeça: base do pescoço, no espaço do glb (Y para cima, rosto para +Z). */
const PIVOT = new THREE.Vector3(0, 0.05, -0.13)

interface BustProps {
  expr: Expression
  prop: PropId
  /** Ponteiro relativo ao busto, atualizado fora do React. */
  pointer: RefObject<Pointer>
  /** Giro por arrasto, escrito pelos eventos de ponteiro do herói. */
  drag: RefObject<DragState>
  /** Fração das partículas do furacão (qualidade adaptativa). */
  particles: number
  /** Para onde a troca pode ir, em ordem: dela sai a próxima vida preparada nos bastidores (Props). */
  candidatas: readonly PropId[]
  /** Estado da cena por quadro: aqui se marca o 1º quadro com o busto (o relógio do carrossel só anda depois dele). */
  palco: Palco
}

interface MovimentoProps {
  expr: Expression
  pointer: RefObject<Pointer>
  drag: RefObject<DragState>
  rig: ReturnType<typeof buildRig>
  head: RefObject<THREE.Group | null>
  frame: RefObject<THREE.Group | null>
}

/**
 * Rosto, olhar, arrasto e a matriz da desintegração, a cada quadro. Monta com a cena na tela e depois da vida (#138):
 * como quando o busto e a vida montavam juntos, o quadro da vida roda antes deste (a vida que mede a tela no seu 2º
 * quadro, o fundo do QA, vê a cabeça parada desde o último desenho) e o 1º quadro da cena parte do repouso.
 */
function Movimento({ expr, pointer, drag, rig, head, frame }: MovimentoProps) {
  const face = useRef(createFace())
  const gaze = useRef(createGaze())
  const eye = useMemo(() => ({ quat: new THREE.Quaternion(), euler: new THREE.Euler() }), [])
  useFrame((_, dt) => {
    stepFace(face.current, expr, dt)
    applyFace(rig, face.current)

    stepDrag(drag.current, dt)
    const g = gaze.current
    stepGaze(g, pointer.current, drag.current, dt)
    // Vida com alvo próprio (qa): os olhos deixam o ponteiro e perseguem o alvo; a cabeça acompanha um pouco.
    mirarAlvo(g, alvoDoAdereco, dt)
    head.current?.rotation.set(-g.headUp, g.headRight, 0)
    eye.euler.set(-g.eyeUp, g.eyeRight, 0, 'YXZ')
    applyEyes(rig, eye.quat.setFromEuler(eye.euler))

    if (frame.current) {
      frame.current.updateWorldMatrix(true, false)
      dissolveUniforms.uToGlb.value.copy(frame.current.matrixWorld).invert()
    }
  })
  return null
}

/** O busto do S13 com expressão da vida, piscar, olhar que segue o ponteiro, arrasto, adereço e furacão. */
export function Bust({ expr, prop, candidatas, pointer, drag, particles, palco }: BustProps) {
  const { scene } = useGlb(bustUrl)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const cena = useThree((s) => s.scene)
  const pivot = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const frame = useRef<THREE.Group>(null)
  const rig = useMemo(() => buildRig(scene), [scene])
  // A cena aparece inteira: busto compilado, furacão sorteado e a vida inicial pronta (ou sem glb), nada pela metade.
  const bustoPronto = useRef(false)
  // Busto e vida entram no mesmo commit (o busto visível e a vida saindo dos bastidores): o 1º quadro da vida é o
  // 1º da cena, como quando os dois montavam juntos, e o relógio do carrossel começa nele.
  const [emCena, setEmCena] = useState(false)
  const pedida = useRef(false)
  useLayoutEffect(() => {
    if (!emCena) return
    palco.emCena = true
    // Lida pela sonda da #138: o 1º quadro com o busto.
    performance.mark('cena')
  }, [emCena, palco])
  const vortexPronto = useRef(false)
  const onVortex = useCallback(() => {
    vortexPronto.current = true
  }, [])
  useEffect(() => {
    let vivo = true
    if (frame.current) {
      void prepararObjeto(gl, frame.current, camera, cena).then((pronto) => {
        if (vivo && pronto) bustoPronto.current = true
      })
    }
    return () => {
      vivo = false
    }
  }, [gl, camera, cena])

  useFrame(() => {
    const vidaPronta = palco.prontas.has(prop) || lerCarga().falhas.has(prop)
    if (!pedida.current && bustoPronto.current && vortexPronto.current && vidaPronta) {
      pedida.current = true
      setEmCena(true)
    }
  })

  return (
    <group ref={pivot} position={PIVOT} visible={emCena}>
      <group ref={head}>
        {/* frame = espaço do glb: busto, adereços e partículas compartilham as mesmas coordenadas */}
        {/* Nomes frame, bust e prop (o grupo da vida atual): lidos pelo gancho de depuração do estúdio 3D. */}
        <group ref={frame} name="frame" position={PIVOT.clone().negate()}>
          <group name="bust">
            <primitive object={scene} />
          </group>
          <Props id={prop} candidatas={candidatas} palco={palco} emCena={emCena} />
          <Vortex skin={rig.skin} toGlb={rig.skinToGlb} fraction={particles} onPronto={onVortex} />
          {emCena && <Movimento expr={expr} pointer={pointer} drag={drag} rig={rig} head={head} frame={frame} />}
        </group>
      </group>
    </group>
  )
}
