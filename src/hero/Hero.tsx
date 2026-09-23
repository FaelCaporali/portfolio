import { Fragment, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { ResumeMenu } from './ResumeMenu'
import { Bust, DRAG_MAX_PITCH, DRAG_MAX_YAW, type DragState } from './Bust'
import { DISSOLVE_MAX, dissolveUniforms } from './dissolve'
import { stages, type Stage } from '../content/journey'
import { journeyLink, profile, profileLinks } from '../content/profile'
import { CopyContacts } from '../components/CopyContacts'

/** Tempos do carrossel (s). A primeira vida fica mais tempo: é o que quem chega lê primeiro. */
const HOLD_FIRST = 4.5
const HOLD = 3.4
const OUT = 1.5
const IN = 1.5

const params = new URLSearchParams(window.location.search)
/** Conferência: ?slot=<id> começa numa vida; ?d=0..1.35 congela a desintegração naquele ponto. */
const START = Math.max(0, stages.findIndex((s) => s.id === params.get('slot')))
const FROZEN_D = params.has('d') ? Number(params.get('d')) : null
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

type Phase = 'hold' | 'out' | 'in'

/** Vida na posição i do carrossel (o índice sempre dá a volta dentro da lista). */
function stageAt(i: number): Stage {
  const stage = stages[i % stages.length]
  if (!stage) throw new Error('journey.ts sem vidas')
  return stage
}

/** Botões secundários (currículo e perfis). */
const PILL = 'flex items-center justify-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[13px] min-[360px]:inline-flex sm:px-4 sm:py-2 sm:text-sm text-white/80 transition-colors hover:border-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer'

/** Largura a partir da qual o texto vai para a esquerda e o busto para a direita (lg do Tailwind). */
const WIDE = 1024
/** No layout largo, quanto o busto sai do centro da tela para a direita (fração da largura). */
const BUST_SHIFT = 0.2

/** Relógio do carrossel: segura, desintegra (troca a vida no auge do furacão) e reconstrói. */
function Director({ index, drag, onPhase, onNext }: { index: number; drag: React.RefObject<DragState>; onPhase: (p: Phase) => void; onNext: () => void }) {
  const t = useRef({ phase: 'hold' as Phase, time: 0 })
  useFrame((_, dt) => {
    const c = t.current
    if (FROZEN_D !== null) { dissolveUniforms.uD.value = FROZEN_D; return }
    // Quem está girando o busto não o perde na mão: a vida atual segura até soltar (e um instante depois).
    if (c.phase === 'hold' && (drag.current.active || drag.current.idle < 0.8)) return
    c.time += Math.min(dt, 0.1)
    const ease = (x: number) => x * x * (3 - 2 * x)
    if (c.phase === 'hold') {
      dissolveUniforms.uD.value = 0
      if (c.time >= (index === 0 ? HOLD_FIRST : HOLD)) {
        c.time = 0
        if (REDUCED) { onNext(); return }
        c.phase = 'out'; onPhase('out')
      }
    } else if (c.phase === 'out') {
      dissolveUniforms.uD.value = DISSOLVE_MAX * ease(Math.min(c.time / OUT, 1))
      if (c.time >= OUT) { c.time = 0; c.phase = 'in'; onNext(); onPhase('in') }
    } else {
      dissolveUniforms.uD.value = DISSOLVE_MAX * (1 - ease(Math.min(c.time / IN, 1)))
      if (c.time >= IN) { c.time = 0; c.phase = 'hold'; onPhase('hold') }
    }
  })
  return null
}

/**
 * Enquadramento. Largo: busto à direita do texto. Celular: busto centrado no espaço livre entre o header e o texto e
 * escalado para ocupar ~80% dele (a altura do texto varia com a tela e com a vida que quebra em duas linhas).
 * Medidas do busto a fov 38: altura ~0,40 da tela, centro 0,013 da tela abaixo do centro.
 */
function Framing({ free: [top, bottom] }: { free: [number, number] }) {
  const { camera, size } = useThree()
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const { width: w, height: h } = size
    if (w >= WIDE) {
      cam.fov = 24
      // Janela de vista deslocada: x negativo leva o busto para a direita, y positivo o leva para cima.
      cam.setViewOffset(w, h, -w * BUST_SHIFT, h * 0.06, w, h)
    } else {
      const free = Math.max(bottom - top, h * 0.3)
      const ref = Math.tan(THREE.MathUtils.degToRad(19))
      const half = Math.atan((ref * 0.4 * h) / (0.8 * free))
      cam.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * half), 30, 60)
      const k = ref / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
      cam.setViewOffset(w, h, 0, h * (0.5 + 0.013 * k) - (bottom - free / 2), w, h)
    }
    cam.lookAt(0, 0.17, -0.1)
    cam.updateProjectionMatrix()
  }, [camera, size, top, bottom])
  return null
}

function Environment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.35
    return () => { env.dispose(); pmrem.dispose(); scene.environment = null }
  }, [gl, scene])
  return null
}

/** Letra a letra para a animação; quebra só entre palavras, para caber na coluna de texto. */
function SlotWord({ text, color, leaving }: { text: string; color: string; leaving: boolean }) {
  let i = 0
  return (
    <span key={text} className={`slot-word ${leaving ? 'is-leaving' : ''}`} style={{ color }} aria-live="polite">
      {text.split(' ').map((word, w) => (
        <Fragment key={w}>
          {w > 0 && ' '}
          <span className="whitespace-nowrap">
            {[...word].map((ch) => (
              <span key={i} className="ch" style={{ '--i': i++ } as React.CSSProperties}>{ch}</span>
            ))}
          </span>
        </Fragment>
      ))}
    </span>
  )
}

export function Hero() {
  const [index, setIndex] = useState(START)
  const [phase, setPhase] = useState<Phase>('hold')
  const pointer = useRef({ x: 0, y: 0 })
  const drag = useRef<DragState>({ active: false, yaw: 0, pitch: 0, vYaw: 0, vPitch: 0, idle: 99 })
  const last = useRef({ x: 0, y: 0, t: 0 })
  const header = useRef<HTMLElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const [free, setFree] = useState<[number, number]>([0, 0])
  const stage = stageAt(index)

  // Arrasto: meia largura da tela gira ~100°; a velocidade do último movimento vira embalo ao soltar.
  const onDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    Object.assign(drag.current, { active: true, vYaw: 0, vPitch: 0, idle: 0 })
    last.current = { x: e.clientX, y: e.clientY, t: performance.now() }
  }
  const onMoveDrag = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d.active) return
    const now = performance.now()
    const dt = Math.max((now - last.current.t) / 1000, 1 / 240)
    const dYaw = ((e.clientX - last.current.x) / window.innerWidth) * 3.5
    const dPitch = ((e.clientY - last.current.y) / window.innerHeight) * 1.6
    d.yaw = Math.max(-DRAG_MAX_YAW, Math.min(DRAG_MAX_YAW, d.yaw + dYaw))
    d.pitch = Math.max(-DRAG_MAX_PITCH, Math.min(DRAG_MAX_PITCH, d.pitch - dPitch))
    d.vYaw = dYaw / dt
    d.vPitch = -dPitch / dt
    last.current = { x: e.clientX, y: e.clientY, t: now }
  }
  const onUp = (e: React.PointerEvent) => {
    if (performance.now() - last.current.t > 80) { drag.current.vYaw = 0; drag.current.vPitch = 0 } // parou antes de soltar: sem embalo
    drag.current.active = false
    drag.current.idle = 0
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // Centro do olhar = onde o busto está na tela: no layout largo, deslocado para a direita.
      const cx = window.innerWidth >= WIDE ? 0.5 + BUST_SHIFT : 0.5
      pointer.current.x = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth - cx) * 2))
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Espaço livre entre o header e o texto (celular): o enquadramento do busto se ajusta a ele.
  useLayoutEffect(() => {
    const el = text.current!
    const hd = header.current!
    const measure = () => setFree((f) => {
      const next: [number, number] = [hd.offsetTop + hd.offsetHeight, el.offsetTop]
      return f[0] === next[0] && f[1] === next[1] ? f : next
    })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(hd)
    window.addEventListener('resize', measure)
    measure()
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  return (
    <section className="relative h-svh overflow-hidden" aria-label="Apresentação">
      <Canvas
        className="!absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
        onPointerDown={onDown}
        onPointerMove={onMoveDrag}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        dpr={[1, 2]}
        camera={{ position: [0, 0.2, 1.05], near: 0.05, far: 10 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <Framing free={free} />
        <Environment />
        <ambientLight intensity={0.15} />
        <directionalLight position={[-0.6, 0.8, 0.9]} intensity={2.2} color="#fff3e6" />
        <directionalLight position={[0.8, 0.3, 0.6]} intensity={0.6} color="#dfe8ff" />
        <directionalLight position={[0.3, 0.4, -1]} intensity={0.5} color="#ffffff" />
        <Suspense fallback={null}>
          <Bust expr={stage.expr} prop={stage.prop} pointer={pointer} drag={drag} />
          <Director index={index} drag={drag} onPhase={setPhase} onNext={() => setIndex((i) => (i + 1) % stages.length)} />
        </Suspense>
      </Canvas>

      <header ref={header} className="absolute top-0 left-0 px-5 py-5 sm:px-10 lg:pl-[7vw]">
        <a
          href="/"
          className="text-sm font-medium tracking-wide text-white/90 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white lg:text-base"
        >
          {profile.name}
        </a>
      </header>

      <div ref={text} className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-6 text-white sm:px-10 lg:inset-y-0 lg:right-auto lg:flex lg:w-1/2 lg:flex-col lg:justify-center lg:pb-0 lg:pl-[7vw]">
        <h1>
          <span className="block text-xs tracking-[0.3em] text-white/60 uppercase lg:text-sm">
            Today I am a{/^[aeiou]/i.test(stage.slot) ? 'n' : ''}
          </span>
          {/* Duas linhas reservadas onde a vida mais longa quebra (celular e coluna do largo): a troca não empurra o resto. */}
          <span className="mt-2 block min-h-[2em] text-[2.6rem] sm:min-h-[1em] lg:min-h-[2em] leading-none font-semibold tracking-tight lg:text-[clamp(3rem,4.6vw,5rem)]">
            <SlotWord text={stage.slot} color={stage.accent} leaving={phase === 'out'} />
          </span>
        </h1>
        <ul aria-label="Títulos" className="mt-3 space-y-0.5 text-sm leading-snug text-white/70 lg:mt-6 lg:space-y-1 lg:text-lg">
          {profile.titles.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <nav aria-label="Links" className="pointer-events-auto mt-5 flex flex-col items-start gap-3 lg:mt-10">
          <a
            href={journeyLink.href}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {journeyLink.label} <span aria-hidden>→</span>
          </a>
          {/* Abaixo de 360 px os quatro não cabem numa linha: grade 2×2 em vez de um órfão. */}
          <ul className="grid w-full grid-cols-2 gap-1.5 min-[360px]:flex min-[360px]:w-auto min-[360px]:flex-wrap sm:gap-2">
            <li>
              <ResumeMenu className={PILL} />
            </li>
            {profileLinks.map((l) => (
              <li key={l.label}>
                <a href={l.href} target="_blank" rel="noopener noreferrer" className={PILL}>
                  {l.label} <span aria-hidden className="hidden text-white/45 xl:inline">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {/* Contato direto sempre à vista; clique copia (o formulário e os links ficam no botão flutuante). */}
        <CopyContacts className="pointer-events-auto mt-4 lg:mt-6" />
      </div>
    </section>
  )
}
