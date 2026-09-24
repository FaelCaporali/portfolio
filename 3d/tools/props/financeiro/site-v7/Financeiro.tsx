/**
 * Vida "Financial Assistant" (v7, em homologação — só no servidor de desenvolvimento com `?v7`, ver Props.tsx): painel
 * de planilha em vidro fosco com a macro digitada, linha de tendência em aço até a bandeira de meta e pilha de moedas.
 * glb `3d/export/props/financeiro_v7.glb` (receita `3d/tools/props/financeiro/`); posição, giro e escala já vêm no nó
 * raiz `financeiro`, então o componente só planta a cena clonada no grupo `frame` do busto.
 *
 * Movimento procedural (padrão da v6, props/ledger): relógio desde a montagem com passo máximo de 0,1 s, convertido
 * para o início da pausa (roteiro.ts). Painel: cruza por célula/caractere do atlas vazio para o cheio no shader
 * (painel.ts); linha revela por altura; bandeira sobe pelo mastro desfraldando; moedas descem 3 mm e assentam.
 * Movimento reduzido: estado final parado.
 */
import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import financeiroUrl from '../../../../../../3d/export/props/financeiro_v7.glb?url'
import { dissolveUniforms, withDissolve } from '../../dissolve'
import { useOwnEnvIntensity, withOwnEnv } from '../../envIntensity'
import { withTransmissionBackdrop } from '../../transmission'
import { useDisposal } from '../materials'
import emptyUrl from './atlas_vazio.png?url'
import { CELLS, CHAR_U1, TEXT } from './layout'
import { withHeightReveal, withSheetReveal, sheetUniforms, type SheetUniforms } from './painel'
import { END, R, activeAt, filledAt, landAt, lineAt, pauseOffset, typedAt } from './roteiro'

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Altura local da linha (malha `fio`): de um pouco abaixo do início ao pé do mastro (medido no glb). */
const LINE_Y: readonly [number, number] = [-0.0405, 0.0705]
/** Mastro em x (a bandeira desfralda a partir dele) e quanto ela sobe (base do mastro → posição exportada). */
const POLE_X = 0.0357
const FLAG_RISE = 0.0295
/** As moedas descem 3 mm até o lugar exportado. */
const COIN_DROP = 0.003

/** Clona a cena; cada material vira um clone com desintegração e fundo de transmissão, e painel e linha ganham o
 * shader do roteiro, encadeado (padrão de `dev/LabProp.tsx`). */
function prepare(source: THREE.Object3D, sheet: SheetUniforms, lineY: { value: number }) {
  const root = clone(source)
  const materials: THREE.Material[] = []
  const nodes: Record<string, THREE.Object3D> = {}
  root.traverse((o) => {
    nodes[o.name] = o
    if (!isMesh(o)) return
    const own = (m: THREE.Material) => {
      let c = withTransmissionBackdrop(withDissolve(m.clone()))
      if (o.name === 'painel') c = withSheetReveal(c, sheet)
      if (o.name === 'fio') c = withHeightReveal(c, lineY)
      materials.push(c)
      return c
    }
    o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material)
  })
  const flag = nodes.bandeira
  const coins = nodes.moedas
  return {
    root,
    flag,
    coins,
    coinsY: coins?.position.y ?? 0,
    flagPos: flag?.position.clone() ?? new THREE.Vector3(),
    ownEnv: withOwnEnv(materials),
    dispose: () => materials.forEach((m) => m.dispose()),
  }
}

/** Aplica o instante t (s desde o início da pausa) aos uniformes e nós. Nada alocado. */
function pose(t: number, u: SheetUniforms, lineY: { value: number }, p: ReturnType<typeof prepare>) {
  const filled = filledAt(t)
  u.uFilled.value = filled
  const cell = CELLS[activeAt(t)]
  // A célula que anda é desenhada no shader; ao preencher C4, a moldura e a alça do atlas cheio assumem.
  if (filled < R.cells && cell) u.uActive.value.fromArray(cell)
  else u.uActive.value.set(0, 0, 0, 0)

  const typed = typedAt(t)
  const done = typed >= CHAR_U1.length
  u.uTextU.value = typed > 0 ? (CHAR_U1[typed - 1] ?? TEXT[2]) : TEXT[0] - 0.01
  u.uCaretDone.value = done ? 1 : 0
  u.uCaretU.value = !done && t >= R.typeStart ? u.uTextU.value + 0.003 : -1

  const k = lineAt(t)
  lineY.value = k <= 0 ? -1 : LINE_Y[0] + (LINE_Y[1] - LINE_Y[0]) * k

  const land = landAt(t)
  const { flag, coins } = p
  if (flag) {
    flag.visible = land !== null
    const s = 0.15 + 0.85 * (land ?? 0)
    flag.scale.set(s, 1, 1)
    // Desfralda a partir do mastro (escala em x com pivô no mastro) enquanto sobe da base.
    flag.position.set(POLE_X * (1 - s) + p.flagPos.x * s, p.flagPos.y - FLAG_RISE * (1 - (land ?? 0)), p.flagPos.z)
  }
  if (coins) coins.position.y = p.coinsY + COIN_DROP * (1 - (land ?? 0))
}

export function Financeiro() {
  const gltf = useGLTF(financeiroUrl)
  const empty = useTexture(emptyUrl)
  const sheet = useMemo(() => {
    empty.flipY = false
    empty.colorSpace = THREE.SRGBColorSpace
    empty.needsUpdate = true
    return sheetUniforms(empty)
  }, [empty])
  const lineY = useMemo(() => ({ value: 1 }), [])
  const prop = useMemo(() => prepare(gltf.scene, sheet, lineY), [gltf.scene, sheet, lineY])
  useDisposal(prop)
  useOwnEnvIntensity(prop.ownEnv)
  // Montado com o busto desintegrado (troca de vida): a pausa começa depois da reconstrução. Lido uma vez.
  const clock = useRef<number | null>(null)

  useFrame((_, dt) => {
    if (clock.current === null) {
      clock.current = reducedMotion() ? END + 1 : -pauseOffset(dissolveUniforms.uD.value > 0.5)
    }
    // Mesmo passo máximo do relógio do carrossel: aba em segundo plano não pula o roteiro.
    else if (clock.current < END + 1) clock.current += Math.min(dt, 0.1)
    pose(clock.current, sheet, lineY, prop)
  })

  return <primitive object={prop.root} />
}

useGLTF.preload(financeiroUrl)
