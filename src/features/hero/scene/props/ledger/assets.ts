/**
 * Peças do adereço: geometria e materiais PBR do glb (3d/tools/prop_financeiro.py), clonados por montagem com a
 * desintegração; texturas geradas no site; geometrias do cursor e da linha de tendência.
 */
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import ledgerUrl from '../../../../../../3d/export/props/financeiro.glb?url'
import { withDissolve } from '../../dissolve'
import { useDisposal } from '../materials'
import { CELL_SIZE } from './sheet'
import { createSheetTexture, createWearTexture } from './textures'

type Nodes = Record<string, THREE.Object3D>

function part(nodes: Nodes, name: string) {
  const o = nodes[name]
  if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial)) {
    throw new Error(`financeiro.glb sem a malha ${name}`)
  }
  return { geometry: o.geometry as THREE.BufferGeometry, material: o.material }
}

/** Retângulos no plano XY (x0, y0, x1, y1) numa geometria só. */
function rectsGeometry(rects: readonly (readonly [number, number, number, number])[]) {
  const pos: number[] = []
  for (const [x0, y0, x1, y1] of rects) pos.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}

/** Borda de seleção do Excel: contorno da célula com a alça de preenchimento no canto inferior direito. */
function cursorGeometry() {
  const [w, h] = CELL_SIZE
  const s = 0.00085
  const x = w / 2
  const y = h / 2
  const q = 0.001
  return rectsGeometry([
    [-x - s, y - s, x + s, y + s],
    [-x - s, -y - s, x - q - s, -y + s],
    [-x - s, -y + s, -x + s, y - s],
    [x - s, -y + q + s, x + s, y - s],
    [x - q, -y - q, x + q, -y + q],
  ])
}

export const LINE_SEGMENTS = 160
const LINE_RADIAL = 6
/** Índices por segmento do tubo (TubeGeometry: 2 triângulos por face radial). */
export const LINE_INDEX_PER_SEGMENT = LINE_RADIAL * 6

/** Linha de tendência: tubo fino pela poligonal dos totais, crescida por drawRange. */
function trendGeometry(points: readonly THREE.Vector3[]) {
  const path = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (a && b) path.add(new THREE.LineCurve3(a, b))
  }
  const tube = new THREE.TubeGeometry(path, LINE_SEGMENTS, 0.00085, LINE_RADIAL, false)
  tube.setDrawRange(0, 0)
  const lengths = path.getCurveLengths()
  const total = path.getLength()
  return { tube, path, stops: lengths.map((l) => l / total) }
}

/** Metais e vidro refletem o ambiente da cena com intensidade própria (a do scene.environment é fraca, 0,35). */
function useSceneEnv(pairs: readonly (readonly [THREE.MeshStandardMaterial, number])[]) {
  const scene = useThree((s) => s.scene)
  useFrame(() => {
    const env = scene.environment
    for (const [m, k] of pairs) {
      if (m.envMap === env) continue
      m.envMap = env
      m.envMapIntensity = k
      m.needsUpdate = true
    }
  })
}

const basic = (color: string) => withDissolve(new THREE.MeshBasicMaterial({ color }))

export function useLedgerAssets(points: readonly THREE.Vector3[]) {
  const { nodes } = useGLTF(ledgerUrl) as unknown as { nodes: Nodes }
  const glb = useMemo(
    () => ({
      frame: part(nodes, 'Frame'),
      glass: part(nodes, 'Glass'),
      coin: part(nodes, 'Coin'),
      pole: part(nodes, 'Pole'),
      finial: part(nodes, 'Finial'),
      pennant: part(nodes, 'Pennant'),
    }),
    [nodes],
  )
  const sheet = useMemo(() => createSheetTexture(), [])
  useDisposal(sheet.texture)
  const wear = useMemo(() => createWearTexture(), [])
  useDisposal(wear)

  const mats = useMemo(() => {
    const frame = withDissolve(glb.frame.material.clone())
    const glass = withDissolve(glb.glass.material.clone())
    // O conteúdo da planilha é luz própria (emissivo, cores exatas do canvas); a cor difusa preta deixa para a
    // superfície só o que é do vidro: reflexo especular do ambiente e das luzes. O mapa difuso dá o alfa.
    glass.color.set('#000000')
    glass.map = sheet.texture
    glass.emissiveMap = sheet.texture
    glass.emissive.set('#ffffff')
    glass.emissiveIntensity = 1
    glass.opacity = 1
    glass.transparent = true
    glass.depthWrite = false
    // Moeda nova e moeda mais usada (ouro levemente avermelhado e escurecido): a pilha não parece clonada.
    const coinNew = withDissolve(glb.coin.material.clone())
    coinNew.roughness = 0.3
    coinNew.roughnessMap = wear
    const coinOld = withDissolve(coinNew.clone())
    coinOld.color.multiply(new THREE.Color(0.9, 0.84, 0.76))
    coinOld.roughness = 0.36
    const pole = withDissolve(glb.pole.material.clone())
    const pennant = withDissolve(glb.pennant.material.clone())
    pennant.emissive.copy(pennant.color)
    pennant.emissiveIntensity = 0
    return {
      frame,
      glass,
      coinNew,
      coinOld,
      pole,
      pennant,
      cursor: basic('#2fbf71'),
      // Acima de 1 e sem tone mapping: atrás do vidro ainda lê como traço de luz; fora dele, branco pleno.
      line: withDissolve(
        new THREE.MeshBasicMaterial({ color: new THREE.Color('#eef4fb').multiplyScalar(1.9), toneMapped: false }),
      ),
      tip: basic('#ffffff'),
    }
  }, [glb, sheet, wear])
  const all = useMemo(() => ({ dispose: () => Object.values(mats).forEach((m) => m.dispose()) }), [mats])
  useDisposal(all)
  useSceneEnv(
    useMemo(
      () =>
        [
          [mats.frame, 1.3],
          [mats.glass, 1],
          [mats.coinNew, 1.05],
          [mats.coinOld, 0.9],
          [mats.pole, 1.1],
          [mats.pennant, 0.9],
        ] as const,
      [mats],
    ),
  )

  const cursor = useMemo(() => cursorGeometry(), [])
  useDisposal(cursor)
  const trend = useMemo(() => trendGeometry(points), [points])
  useDisposal(trend.tube)
  const dot = useMemo(() => new THREE.SphereGeometry(0.0015, 12, 8), [])
  useDisposal(dot)

  return { glb, mats, sheet, cursor, trend, dot }
}

useGLTF.preload(ledgerUrl)
