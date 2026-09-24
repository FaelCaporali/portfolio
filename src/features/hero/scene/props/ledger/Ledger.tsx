/**
 * Vida "Financial Assistant": painel de planilha em vidro fosco atrás e à direita da cabeça. A macro é digitada, roda e
 * preenche as células com o cursor verde passeando (meticulosidade); os totais viram a linha de tendência, que sai do
 * painel até a bandeira de meta; a meta atingida paga uma pilha de moedas (o resultado da análise).
 * Coordenadas do painel: origem no centro do vidro, +Y para cima, +Z para fora do vidro (metros na escala do scan).
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Float } from '../Float'
import { LINE_INDEX_PER_SEGMENT, LINE_SEGMENTS, useLedgerAssets } from './assets'
import { TOTALS, cellCenter, columnX } from './sheet'
import { COINS, END, T, activeAt, coinAt, filledAt, glowAt, lineAt, typedAt } from './timeline'

/** Painel no espaço do glb: atrás da orelha direita (de quem vê), girado para o centro e levemente inclinado. */
const PANEL_POS: [number, number, number] = [0.17, 0.19, -0.27]
const PANEL_ROT: [number, number, number] = [0.06, -0.38, 0]
/** Escala do conjunto: cabe com folga na borda direita em 1024×768 e a coluna A sai de trás da cabeça. */
const PANEL_SCALE = 0.97
/**
 * Linha logo ATRÁS do vidro: os números ficam por cima e legíveis, o traço aparece através do vidro fosco e sai por
 * trás da moldura, já com brilho pleno, até a bandeira (o resultado rompe o quadro).
 */
const LINE_Z = -0.0045
/** Pé do mastro: o total do 4º trimestre passa do topo do painel e é a meta. Mastro atrás da pilha de moedas. */
const FLAG: [number, number, number] = [columnX(3), 0.1, -0.008]
/** Pilha de moedas logo acima da moldura, à frente do mastro, inclinada para a câmera (mostra a face com o Σ). */
const STACK: [number, number, number] = [columnX(3), 0.094, 0.009]
const STACK_TILT = 0.32
const COIN_T = 0.0036
/** Desalinhamento e giro de cada moeda (pilha de mão, não de fábrica). */
const COIN_JITTER = [
  [0, 0, 0],
  [0.0007, -0.0005, 0.3],
  [-0.0006, 0.0006, 0.72],
  [0.0009, 0.0003, 1.15],
  [-0.0004, -0.0006, 1.54],
] as const

/** Totais → altura no painel: a queda do 2º trimestre fica embaixo; o 4º trimestre chega ao pé do mastro. */
function trendPoints() {
  const lo = Math.min(...TOTALS)
  const hi = Math.max(...TOTALS)
  const y0 = -0.035
  const k = (FLAG[1] - y0) / (hi - lo)
  const pts = TOTALS.slice(0, 3).map((v, c) => new THREE.Vector3(columnX(c), y0 + (v - lo) * k, LINE_Z))
  pts.push(new THREE.Vector3(...FLAG))
  return pts
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Ledger() {
  const points = useMemo(() => trendPoints(), [])
  const { glb, mats, sheet, cursor, trend, dot } = useLedgerAssets(points)
  const clock = useRef(prefersReducedMotion() ? END : 0)
  const cursorRef = useRef<THREE.Mesh>(null)
  const tipRef = useRef<THREE.Mesh>(null)
  const nodeRefs = useRef<(THREE.Mesh | null)[]>([])
  const coinRefs = useRef<(THREE.Group | null)[]>([])
  const pennantRef = useRef<THREE.Group>(null)
  const tip = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    // Mesmo passo máximo do relógio do carrossel: aba em segundo plano não pula o roteiro.
    const t = (clock.current += Math.min(dt, 0.1))
    const active = activeAt(t)
    sheet.update({ typed: typedAt(t), filled: filledAt(t), active, caret: t > T.typeStart && t < T.fillStart })

    const c = cursorRef.current
    if (c) {
      const [x, y] = cellCenter(active)
      const k = 1 - Math.exp(-dt * 28)
      c.position.x += (x - c.position.x) * k
      c.position.y += (y - c.position.y) * k
    }

    const p = lineAt(t)
    trend.tube.setDrawRange(0, Math.floor(p * LINE_SEGMENTS) * LINE_INDEX_PER_SEGMENT)
    if (tipRef.current) {
      tipRef.current.visible = p > 0 && p < 1
      trend.path.getPointAt(p, tip)
      tipRef.current.position.copy(tip)
    }
    nodeRefs.current.forEach((n, i) => {
      if (n) n.visible = p >= (i === 0 ? 0.001 : (trend.stops[i - 1] ?? 1))
    })

    mats.pennant.emissiveIntensity = glowAt(t)
    const pen = pennantRef.current
    if (pen) {
      // Tremula no toque e depois só respira.
      const flutter = t > T.lineStart + T.lineDur ? 0.22 * Math.exp(-(t - T.lineStart - T.lineDur) * 4) : 0
      // Em repouso a flâmula aponta para trás e para a cabeça: vista em ângulo, as dobras do tecido aparecem.
      pen.rotation.y = -0.5 + Math.sin(t * 1.4) * 0.06 + Math.sin(t * 17) * flutter
    }

    coinRefs.current.forEach((g, i) => {
      if (!g) return
      const s = coinAt(t, i)
      g.visible = s !== null
      if (!s) return
      const j = COIN_JITTER[i] ?? COIN_JITTER[0]
      g.position.set(j[0], COIN_T * (i + 0.5) * 1.004 + s.lift, j[1])
      g.rotation.set(s.tilt * 0.6, j[2], s.tilt * 0.4)
    })
  })

  const [cx, cy] = cellCenter(0)
  return (
    <Float position={PANEL_POS} speed={0.9} amp={0.0025}>
      <group rotation={PANEL_ROT} scale={PANEL_SCALE}>
        <mesh geometry={glb.frame.geometry} material={mats.frame} />
        <mesh geometry={glb.glass.geometry} material={mats.glass} renderOrder={1} />
        <mesh ref={cursorRef} geometry={cursor} material={mats.cursor} position={[cx, cy, 0.0006]} renderOrder={2} />
        <mesh geometry={trend.tube} material={mats.line} />
        <mesh ref={tipRef} geometry={dot} material={mats.tip} scale={1.25} visible={false} />
        {points.slice(0, 3).map((pt, i) => (
          <mesh
            // eslint-disable-next-line @eslint-react/no-array-index-key -- nós fixos da linha, nunca reordenam
            key={i}
            ref={(m) => {
              nodeRefs.current[i] = m
            }}
            geometry={dot}
            material={mats.line}
            position={pt}
            visible={false}
          />
        ))}
        <group position={FLAG}>
          <mesh geometry={glb.pole.geometry} material={mats.pole} />
          <mesh geometry={glb.finial.geometry} material={mats.coinNew} />
          <group ref={pennantRef}>
            <mesh geometry={glb.pennant.geometry} material={mats.pennant} />
          </group>
        </group>
        <group position={STACK} rotation-x={STACK_TILT}>
          {Array.from({ length: COINS }, (_, i) => (
            <group
              key={i}
              ref={(g) => {
                coinRefs.current[i] = g
              }}
              visible={false}
            >
              <mesh geometry={glb.coin.geometry} material={i % 2 ? mats.coinOld : mats.coinNew} />
            </group>
          ))}
        </group>
      </group>
    </Float>
  )
}
