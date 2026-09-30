/**
 * Vida "Financial Assistant", lado direito do busto (à esquerda do rosto na tela): a calculadora de fita imprime a soma
 * da coluna D do painel (a meta da bandeira, total em vermelho) e o boleto de cobrança da Immersus, no mesmo valor,
 * assenta quando a linha toca a bandeira. Forma e material: 3d/tools/prop_financeiro_direita.py (raiz
 * `financeiro_direita` já posicionada no espaço do frame; meshopt com posição float, porque as malhas são
 * usadas fora dos nós delas: `otimizar.mjs --posicao-float`). Texto da fita e do boleto: canvas (fita.ts, boleto.ts).
 */
import { useGlb } from '../../carga'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import calculadoraUrl from '../../../../../../3d/export/props/financeiro_direita.glb?url'
import { withDissolve } from '../../dissolve'
import { useDisposal } from '../materials'
import { boletoSlideAt, createBoletoTexture } from './boleto'
import { alongV, createFitaTexture, fitaOffsetAt, lengthOf } from './fita'
import { END } from './timeline'

type Nodes = Record<string, THREE.Object3D>
type Part = { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }
const PARTS = ['carcaca', 'teclas', 'cabecote', 'bobina', 'fita', 'boleto'] as const
type PartName = (typeof PARTS)[number]
/** Peças paradas (o boleto se move sozinho). */
const STILL = PARTS.filter((p) => p !== 'boleto')

function part(nodes: Nodes, name: string): Part {
  const o = nodes[name]
  if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial)) {
    throw new Error(`financeiro_direita.glb sem a malha ${name}`)
  }
  return { geometry: o.geometry as THREE.BufferGeometry, material: o.material }
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function useCalculadoraAssets() {
  const { nodes } = useGlb(calculadoraUrl) as unknown as { nodes: Nodes }
  const glb = useMemo(() => {
    const root = nodes.financeiro_direita
    if (!root) throw new Error('financeiro_direita.glb sem a raiz financeiro_direita')
    const parts = {} as Record<PartName, Part>
    for (const p of PARTS) parts[p] = part(nodes, p)
    return { root, parts }
  }, [nodes])

  // O canvas da fita tem a proporção do papel: largura fixa, comprimento medido na malha (soma dos trechos em v).
  const fita = useMemo(() => createFitaTexture(lengthOf(alongV(glb.parts.fita.geometry))), [glb])
  useDisposal(fita)
  const boleto = useMemo(() => createBoletoTexture(), [])
  useDisposal(boleto)

  const mats = useMemo(() => {
    const m = {} as Record<PartName, THREE.MeshStandardMaterial>
    for (const p of PARTS) m[p] = withDissolve(glb.parts[p].material.clone())
    m.fita.map = fita
    m.fita.color.set('#ffffff')
    m.boleto.map = boleto
    m.boleto.color.set('#ffffff')
    return m
  }, [glb, fita, boleto])
  const all = useMemo(() => ({ dispose: () => Object.values(mats).forEach((m) => m.dispose()) }), [mats])
  useDisposal(all)

  /** Direção em que o boleto desliza: do pé para o topo da face (v cresce para baixo). */
  const slide = useMemo(() => {
    const pts = alongV(glb.parts.boleto.geometry)
    const top = pts[0]
    const foot = pts[pts.length - 1]
    return top && foot ? top.clone().sub(foot).normalize() : new THREE.Vector3(0, 1, 0)
  }, [glb])

  return { glb, mats, fita, slide }
}

export function Calculadora() {
  const { glb, mats, fita, slide } = useCalculadoraAssets()
  const clock = useRef(prefersReducedMotion() ? END : 0)
  const boletoRef = useRef<THREE.Mesh>(null)

  useFrame((_, dt) => {
    // Mesmo relógio do painel (Ledger.tsx): desde a montagem, passo máximo de 0,1 s.
    const t = (clock.current += Math.min(dt, 0.1))
    fita.offset.y = fitaOffsetAt(t)
    const b = boletoRef.current
    if (b) b.position.copy(slide).multiplyScalar(boletoSlideAt(t))
  })

  const { root, parts } = glb
  return (
    <group position={root.position} quaternion={root.quaternion} scale={root.scale}>
      {STILL.map((p) => (
        <mesh key={p} geometry={parts[p].geometry} material={mats[p]} />
      ))}
      <mesh ref={boletoRef} geometry={parts.boleto.geometry} material={mats.boleto} />
    </group>
  )
}
