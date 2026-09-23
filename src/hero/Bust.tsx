import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import bustUrl from '../../3d/export/s13/busto-s13.glb?url'
import type { Expression, PropId } from '../content/journey'
import { dissolveUniforms, withDissolve } from './dissolve'
import { Vortex } from './Vortex'
import { Props } from './Props'

/** Pivô de rotação da cabeça: base do pescoço, no espaço do glb (Y para cima, rosto para +Z). */
const PIVOT = new THREE.Vector3(0, 0.05, -0.13)
/** Quanto a cabeça acompanha o ponteiro sozinha (rad no canto da tela). */
const FOLLOW_YAW = 0.16
const FOLLOW_PITCH = 0.08
/** Para onde os olhos miram no mundo quando o ponteiro está no canto da tela (rad). */
const GAZE_YAW = 0.42
const GAZE_PITCH = 0.26
/** Limite do olho dentro da órbita (rad): com a cabeça muito girada, o olho para no canto em vez de sair da órbita. */
const EYE_MAX_YAW = 0.45
const EYE_MAX_PITCH = 0.28
/** Arrasto: limites, embalo ao soltar e volta à frente depois de um tempo parado. */
/** 38° no total (arrasto + acompanhar o ponteiro): o perfil completo expõe erros do scan em nariz, boca e orelha. */
export const DRAG_MAX_YAW = (38 * Math.PI) / 180
export const DRAG_MAX_PITCH = 0.35
const RETURN_AFTER = 1.4

export interface DragState {
  active: boolean
  yaw: number
  pitch: number
  vYaw: number
  vPitch: number
  /** Segundos desde o último toque. */
  idle: number
}

const clamp = (v: number, a: number) => Math.max(-a, Math.min(a, v))

type Channels = Map<string, { mesh: THREE.Mesh; index: number }[]>

function collectChannels(root: THREE.Object3D): Channels {
  const channels: Channels = new Map()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.morphTargetDictionary) return
    for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
      if (!channels.has(name)) channels.set(name, [])
      channels.get(name)!.push({ mesh, index })
    }
  })
  return channels
}

function setKey(channels: Channels, name: string, value: number) {
  for (const { mesh, index } of channels.get(name) ?? []) mesh.morphTargetInfluences![index] = value
}

/**
 * Materiais do glb para o navegador. O glb guarda a transparência da sombra do olho em COLOR_1 e a conjuntiva como
 * emissão (Blender); o three.js lê só COLOR_0 (opaco) e ilumina tudo, e a sombra virava uma calota preta sobre o olho.
 * Todos recebem a desintegração; a pele também o degradê do pescoço.
 */
function prepareMaterials(root: THREE.Object3D): THREE.Mesh {
  let skin: THREE.Mesh | undefined
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mat = mesh.material as THREE.MeshStandardMaterial
    if (mat.name === 'SombraOlho') {
      const alpha = mesh.geometry.getAttribute('color_1')
      if (alpha) mesh.geometry.setAttribute('color', alpha)
      mesh.material = withDissolve(
        new THREE.MeshBasicMaterial({
          color: mat.color,
          vertexColors: true,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      )
      mesh.renderOrder = 1
    } else if (mat.name === 'Conjuntiva') {
      mesh.material = withDissolve(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))
    } else if (mat.name === '3DModel') {
      mat.roughness = 0.72
      withDissolve(mat, { neckFade: true })
      skin = mesh
    } else {
      withDissolve(mat)
    }
  })
  return skin!
}

export function Bust({
  expr,
  prop,
  pointer,
  drag,
}: {
  expr: Expression
  prop: PropId
  /** Posição do cursor normalizada em [-1, 1], atualizada fora do React. */
  pointer: React.RefObject<{ x: number; y: number }>
  /** Giro por arrasto, escrito pelos eventos de ponteiro do herói. */
  drag: React.RefObject<DragState>
}) {
  const { scene } = useGLTF(bustUrl)
  const head = useRef<THREE.Group>(null)
  const frame = useRef<THREE.Group>(null)

  const rig = useMemo(() => {
    const skin = prepareMaterials(scene)
    const channels = collectChannels(scene)
    const eyes = ['Olho_D', 'Olho_E'].map((n) => {
      const node = scene.getObjectByName(n)!
      return { node, base: node.quaternion.clone() }
    })
    return { skin, channels, eyes }
  }, [scene])

  const state = useRef({
    smile: 0,
    innerUp: 0,
    outerUp: 0,
    down: 0,
    blink: 0,
    nextBlink: 2,
    blinkT: -1,
    yaw: 0,
    pitch: 0,
  })
  const q = useMemo(() => ({ gaze: new THREE.Quaternion(), euler: new THREE.Euler() }), [])

  useFrame((_, dt) => {
    const s = state.current
    const k = 1 - Math.exp(-dt * 4)
    s.smile += ((expr.mouthSmile ?? 0) - s.smile) * k
    s.innerUp += ((expr.browInnerUp ?? 0) - s.innerUp) * k
    s.outerUp += ((expr.browOuterUp ?? 0) - s.outerUp) * k
    s.down += ((expr.browDown ?? 0) - s.down) * k

    // Piscar autônomo: 150 ms fechando e abrindo, a cada 2 a 5 s.
    s.nextBlink -= dt
    if (s.nextBlink <= 0 && s.blinkT < 0) {
      s.blinkT = 0
      s.nextBlink = 2 + Math.random() * 3
    }
    if (s.blinkT >= 0) {
      s.blinkT += dt
      s.blink = Math.sin(Math.min(s.blinkT / 0.15, 1) * Math.PI)
      if (s.blinkT >= 0.15) {
        s.blinkT = -1
        s.blink = 0
      }
    }

    const c = rig.channels
    setKey(c, 'mouthSmileLeft', s.smile)
    setKey(c, 'mouthSmileRight', s.smile)
    setKey(c, 'mouthSmileFix', s.smile) // a chave corretiva é min(L, R): obrigatória em todo sorriso
    setKey(c, 'browInnerUp', s.innerUp)
    setKey(c, 'browOuterUpLeft', s.outerUp)
    setKey(c, 'browOuterUpRight', s.outerUp)
    setKey(c, 'browDownLeft', s.down)
    setKey(c, 'browDownRight', s.down)
    setKey(c, 'eyeBlinkLeft', s.blink)
    setKey(c, 'eyeBlinkRight', s.blink)

    // Arrasto: embalo ao soltar e, parado, volta suave à frente.
    const d = drag.current
    if (!d.active) {
      d.idle += dt
      d.yaw = clamp(d.yaw + d.vYaw * dt, DRAG_MAX_YAW)
      d.pitch = clamp(d.pitch + d.vPitch * dt, DRAG_MAX_PITCH)
      const damp = Math.exp(-dt * 4)
      d.vYaw *= damp
      d.vPitch *= damp
      if (d.idle > RETURN_AFTER) {
        const kr = 1 - Math.exp(-dt * 2.2)
        d.yaw -= d.yaw * kr
        d.pitch -= d.pitch * kr
      }
    }

    // Olhar: sem arrasto a cabeça acompanha o ponteiro devagar; os olhos sempre miram o ponteiro no mundo,
    // descontado o giro da cabeça (com a cabeça arrastada eles continuam olhando para o cursor).
    const p = pointer.current ?? { x: 0, y: 0 }
    const kh = 1 - Math.exp(-dt * 3)
    const follow = d.active ? 0 : 1
    s.yaw += (p.x * follow - s.yaw) * kh
    s.pitch += (p.y * follow - s.pitch) * kh
    const headRight = clamp(d.yaw + s.yaw * FOLLOW_YAW, DRAG_MAX_YAW)
    const headUp = d.pitch + s.pitch * FOLLOW_PITCH
    if (head.current) head.current.rotation.set(-headUp, headRight, 0)
    const eyeRight = clamp(p.x * GAZE_YAW - headRight, EYE_MAX_YAW)
    const eyeUp = clamp(p.y * GAZE_PITCH - headUp, EYE_MAX_PITCH)
    q.euler.set(-eyeUp, eyeRight, 0, 'YXZ')
    q.gaze.setFromEuler(q.euler)
    for (const e of rig.eyes) e.node.quaternion.copy(q.gaze).multiply(e.base)

    if (frame.current) {
      frame.current.updateWorldMatrix(true, false)
      dissolveUniforms.uToGlb.value.copy(frame.current.matrixWorld).invert()
    }
  })

  return (
    <group position={PIVOT}>
      <group ref={head}>
        {/* frame = espaço do glb: busto, adereços e partículas compartilham as mesmas coordenadas */}
        <group ref={frame} position={PIVOT.clone().negate()}>
          <primitive object={scene} />
          <Props id={prop} />
          <Vortex skin={rig.skin} />
        </group>
      </group>
    </group>
  )
}

useGLTF.preload(bustUrl)
