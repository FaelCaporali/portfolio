import { Canvas } from '@react-three/fiber'
import { Suspense, type PointerEventHandler, type RefObject } from 'react'
import * as THREE from 'three'
import type { Stage } from '../../../content/journey'
import type { Phase } from '../model/carousel'
import type { DragState } from '../model/drag'
import type { Pointer } from '../model/gaze'
import type { HeroOptions } from '../model/options'
import { Bust } from './Bust'
import { Director } from './Director'
import { Framing } from './Framing'
import { Lighting } from './Lighting'

interface HeroCanvasProps {
  stage: Stage
  first: boolean
  options: HeroOptions
  free: readonly [number, number]
  pointer: RefObject<Pointer>
  drag: RefObject<DragState>
  dragHandlers: Record<'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel', PointerEventHandler>
  onPhase: (p: Phase) => void
  onNext: () => void
}

/** A cena 3D do herói, atrás do texto: câmera, luz, busto e o relógio do carrossel. */
export function HeroCanvas({
  stage,
  first,
  options,
  free,
  pointer,
  drag,
  dragHandlers,
  onPhase,
  onNext,
}: HeroCanvasProps) {
  return (
    <Canvas
      className="!absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
      {...dragHandlers}
      dpr={[1, 2]}
      camera={{ position: [0, 0.2, 1.05], near: 0.05, far: 10 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <Framing free={free} />
      <Lighting />
      <Suspense fallback={null}>
        <Bust expr={stage.expr} prop={stage.prop} pointer={pointer} drag={drag} />
        <Director
          first={first}
          reducedMotion={options.reducedMotion}
          frozenDissolve={options.frozenDissolve}
          drag={drag}
          onPhase={onPhase}
          onNext={onNext}
        />
      </Suspense>
    </Canvas>
  )
}
