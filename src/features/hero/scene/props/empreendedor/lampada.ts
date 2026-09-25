/**
 * Lâmpada da ideia (E14): a ideia vem primeiro e dispara a cena. No relógio da vida (s desde a montagem) acende de
 * 0,85 a 1,10 s com duas piscadas curtas de filamento e fica acesa até o fim; o estado final (e o movimento reduzido)
 * é acesa. Brilho quente contido (2700 K), sem luz extra: o emissivo do material `lampada_luz` e um halo aditivo suave.
 */
import * as THREE from 'three'

export const LAMP_MATERIAL = 'lampada_luz'
/** 2700 K. */
export const LAMP_COLOR = new THREE.Color('#ffb46b')
/** Intensidade do emissivo acesa (com o tone mapping ACES do site: quente e claro, sem estourar em neon). */
export const LAMP_MAX = 1.4

// O topo da cabeça é o último a se reconstruir (furacão até ~0,8 s): a ideia acende quando a cabeça se completa.
const ON = 0.85
const FULL = 1.1
/** Piscadas do filamento (início, fim) dentro da subida: duas quedas curtas. */
const BLINKS = [
  [0.92, 0.945],
  [0.98, 1.005],
] as const

const smooth = (x: number) => x * x * (3 - 2 * x)

/** Opacidade do halo aceso (aditivo sobre o fundo escuro: brilho quente contido, sem neon). */
export const HALO_MAX = 0.55
/** Diâmetro do halo em relação à altura do bulbo. */
const HALO_SCALE = 2.4

/**
 * Halo suave da lâmpada acesa (sem bloom no site, o emissivo sozinho quase não separa acesa de apagada: +6 % de
 * luminância no bulbo, medido no 1440). Plano de frente para a câmera, gradiente radial, mistura aditiva; o material
 * passa pelo `dissolve` de quem chama. Centrado no bulbo (caixa da malha `lampada_luz`, no espaço do nó `lampada`).
 */
export function createHalo(luz: THREE.Mesh, dissolve: (m: THREE.Material) => THREE.Material) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  }
  const map = new THREE.CanvasTexture(canvas)
  const material = new THREE.MeshBasicMaterial({
    map,
    color: LAMP_COLOR,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const shaded = dissolve(material) as THREE.MeshBasicMaterial
  if (!luz.geometry.boundingBox) luz.geometry.computeBoundingBox()
  const box = luz.geometry.boundingBox ?? new THREE.Box3()
  const size = box.max.y - box.min.y
  const geometry = new THREE.PlaneGeometry(size * HALO_SCALE, size * HALO_SCALE)
  const mesh = new THREE.Mesh(geometry, shaded)
  mesh.name = 'lampada_halo'
  box.getCenter(mesh.position)
  mesh.position.y += size * 0.12
  mesh.renderOrder = 1
  const dispose = () => {
    shaded.dispose()
    geometry.dispose()
    map.dispose()
  }
  return { mesh, material: shaded, dispose }
}

/** Fração acesa (0..1) no instante t. */
export function lampAt(t: number): number {
  if (t <= ON) return 0
  if (t >= FULL) return 1
  for (const [a, b] of BLINKS) if (t >= a && t < b) return 0.12
  return smooth((t - ON) / (FULL - ON))
}
