import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, lazy, useEffect, useRef, useState, type PointerEventHandler, type RefObject } from 'react'
import * as THREE from 'three'
import type { PropId, Stage } from '../../../content/journey'
import type { Phase } from '../model/carousel'
import type { DragState } from '../model/drag'
import type { Pointer } from '../model/gaze'
import type { HeroOptions } from '../model/options'
import { TOP_QUALITY, lowerQuality, qualityAt, raiseQuality } from '../model/quality'
import { Bust } from './Bust'
import { priorizar, useCarga } from './carga'
import { criarPalco } from './palco'
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
  /** Ordem de carga das vidas: a escolhida no indicador, a atual e as seguintes do carrossel. */
  order: readonly PropId[]
  /** A vida que vem depois da atual (a escolhida no indicador ou a seguinte): preparada já. */
  next: PropId
  /**
   * Para onde a troca pode ir, em ordem: a escolhida no indicador (só ela) ou as seguintes do carrossel. A troca vai
   * para a primeira pronta; nenhuma pronta, a vida atual fica.
   */
  candidates: readonly PropId[]
  /** As vidas cujo glb falhou (ou demorou demais), a cada mudança: o herói as tira da volta. */
  onFailures: (props: ReadonlySet<PropId>) => void
  dragHandlers: Record<'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel', PointerEventHandler>
  onPhase: (p: Phase) => void
  onNext: (prop: PropId) => void
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
  order,
  next,
  candidates,
  onFailures,
  dragHandlers,
  onPhase,
  onNext,
}: HeroCanvasProps) {
  // A fila dos glb (carga.ts) segue o carrossel: a cada troca ou escolha no indicador, a próxima vida vai à frente.
  useEffect(() => {
    priorizar(order)
  }, [order])
  const { falhas } = useCarga()
  useEffect(() => {
    onFailures(falhas)
  }, [falhas, onFailures])
  const [palco] = useState(criarPalco)
  // Começa no topo; o monitor desce um nível quando o FPS cai e sobe quando sobra. Depois de 3 idas e vindas, fica
  // no nível mais leve (onFallback) em vez de oscilar. O nível pedido só vale na desintegração entre vidas (decisão do
  // Fael, #138): trocar o DPR refaz o buffer do canvas (setSize), e no meio da pausa de uma vida isso é um tranco na
  // tela. Um passo por troca, a partir do nível em uso: esperando a troca, o monitor não desce mais que um nível.
  const [level, setLevel] = useState(TOP_QUALITY)
  const emUso = useRef(TOP_QUALITY)
  const pedido = useRef(TOP_QUALITY)
  const aplicarNivel = () => {
    if (pedido.current === emUso.current) return
    emUso.current = pedido.current
    // Lida pela sonda da #138: quando o nível (e o setSize) muda.
    performance.mark(`qualidade:${String(pedido.current)}`)
    setLevel(pedido.current)
  }
  const quality = qualityAt(level)
  return (
    <Canvas
      className="!absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
      frameloop={paused ? 'never' : 'always'}
      {...dragHandlers}
      dpr={[1, quality.maxDpr]}
      camera={{ position: [0, 0.2, 1.05], near: 0.05, far: 10 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl }) => {
        // Ler o log de cada shader espera a GPU terminar de compilá-lo (leitura síncrona): só em desenvolvimento.
        gl.debug.checkShaderErrors = import.meta.env.DEV
      }}
    >
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => {
          pedido.current = lowerQuality(emUso.current)
        }}
        onIncline={() => {
          pedido.current = raiseQuality(emUso.current)
        }}
        onFallback={() => {
          pedido.current = 0
        }}
      />
      <Framing free={free} />
      <Lighting />
      <Suspense fallback={null}>
        <Bust
          expr={stage.expr}
          prop={stage.prop}
          pointer={pointer}
          drag={drag}
          particles={quality.particles}
          proxima={next}
          palco={palco}
        />
        <Director
          first={first}
          reducedMotion={options.reducedMotion}
          hold={stage.hold}
          frozenDissolve={options.frozenDissolve}
          drag={drag}
          requested={requested}
          candidatas={candidates}
          palco={palco}
          onPhase={(p) => {
            // No auge do furacão (a entrada começa): o busto e o adereço já sumiram, o tranco do setSize não aparece.
            if (p === 'in') aplicarNivel()
            onPhase(p)
          }}
          onNext={(prop) => {
            // Movimento reduzido não tem furacão: a troca é o momento.
            aplicarNivel()
            onNext(prop)
          }}
        />
        {DebugHook && <DebugHook />}
      </Suspense>
    </Canvas>
  )
}
