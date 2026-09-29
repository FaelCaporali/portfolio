import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, lazy, useState, type PointerEventHandler, type RefObject } from 'react'
import * as THREE from 'three'
import type { Stage } from '../../../content/journey'
import type { Phase } from '../model/carousel'
import type { DragState } from '../model/drag'
import type { Pointer } from '../model/gaze'
import type { HeroOptions } from '../model/options'
import { TOP_QUALITY, lowerQuality, qualityAt, raiseQuality } from '../model/quality'
import { Bust } from './Bust'
import { Director } from './Director'
import { Framing } from './Framing'
import { Lighting } from './Lighting'

/** Gancho de depuração do estúdio 3D (window.__heroDebug): só no servidor de desenvolvimento; o build o descarta. */
const DebugHook = import.meta.env.DEV
  ? lazy(() => import('./dev/DebugHook').then((m) => ({ default: m.DebugHook })))
  : null

interface HeroCanvasProps {
  /** Saindo do herói (o roteador carrega outra página): a cena para de desenhar e a troca de página não espera. */
  paused: boolean
  stage: Stage
  first: boolean
  options: HeroOptions
  free: readonly [number, number]
  pointer: RefObject<Pointer>
  drag: RefObject<DragState>
  requested: RefObject<number | null>
  dragHandlers: Record<'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel', PointerEventHandler>
  onPhase: (p: Phase) => void
  onNext: () => void
}

/** A cena 3D do herói, atrás do texto: câmera, luz, busto e o relógio do carrossel. */
export function HeroCanvas({
  paused,
  stage,
  first,
  options,
  free,
  pointer,
  drag,
  requested,
  dragHandlers,
  onPhase,
  onNext,
}: HeroCanvasProps) {
  // Começa no topo; o monitor desce um nível quando o FPS cai e sobe quando sobra. Depois de 3 idas e vindas, fica
  // no nível mais leve (onFallback) em vez de oscilar.
  const [level, setLevel] = useState(TOP_QUALITY)
  const quality = qualityAt(level)
  return (
    <Canvas
      className="!absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
      frameloop={paused ? 'never' : 'always'}
      {...dragHandlers}
      dpr={[1, quality.maxDpr]}
      camera={{ position: [0, 0.2, 1.05], near: 0.05, far: 10 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => {
          setLevel(lowerQuality)
        }}
        onIncline={() => {
          setLevel(raiseQuality)
        }}
        onFallback={() => {
          setLevel(0)
        }}
      />
      <Framing free={free} />
      <Lighting />
      <Suspense fallback={null}>
        <Bust expr={stage.expr} prop={stage.prop} pointer={pointer} drag={drag} particles={quality.particles} />
        <Director
          first={first}
          reducedMotion={options.reducedMotion}
          hold={stage.hold}
          frozenDissolve={options.frozenDissolve}
          drag={drag}
          requested={requested}
          onPhase={onPhase}
          onNext={onNext}
        />
        {DebugHook && <DebugHook />}
      </Suspense>
    </Canvas>
  )
}
