/**
 * Celular do Uber (U7, EM TESTE: o Fael decide no site se fica). A tela (`uber_celular_tela`, UV 0–1) é pintada por
 * canvas: um mapa genérico e sóbrio (quadras numa grade girada, uma avenida, um parque e um rio inventados; nenhuma
 * cidade real, marca ou texto), uma rota pelas ruas e o ponto de posição avançando devagar por ela (U8: sem destaque,
 * sem emissivo). Para tirar o celular: apagar este arquivo e a linha que o cria em Uber.tsx (o nó do glb some com a
 * receita do modelador).
 */
import * as THREE from 'three'

const L = 192
const A = 384
/** Grade das ruas (px do canvas) e giro do mapa. */
const PASSO = 38
const GIRO = -0.24
/** Rota em coordenadas da grade (colunas × linhas de rua), de baixo para cima. */
const ROTA: readonly (readonly [number, number])[] = [
  [2, 10],
  [2, 8],
  [4, 8],
  [4, 5],
  [3, 5],
  [3, 2],
]
/** O ponto percorre a rota em VOLTA segundos; a pintura é refeita a cada PASSO_S. */
const VOLTA = 24
const INICIO = 0.3
const PASSO_S = 0.1
const COR = {
  terra: '#2a2d31',
  quadra: '#303338',
  rua: '#41454c',
  avenida: '#4c5058',
  parque: '#313b35',
  rio: '#28313a',
  casco: '#1d2024',
  rota: '#8c9fb2',
  ponto: '#e9edf0',
  halo: 'rgba(140, 159, 178, 0.45)',
  destino: '#b5bec7',
}

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true
/** Rua da grade → px do canvas (antes do giro). */
const px = (c: number) => c * PASSO

function girar(ctx: CanvasRenderingContext2D) {
  ctx.translate(L / 2, A / 2)
  ctx.rotate(GIRO)
  ctx.translate(-L / 2, -A / 2)
}

/** Mapa parado (terra, rio, quadras, parque, ruas e a rota). */
function desenharMapa(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COR.terra
  ctx.fillRect(0, 0, L, A)
  ctx.save()
  girar(ctx)
  const [x0, x1, y0, y1] = [-2 * PASSO, L + 2 * PASSO, -2 * PASSO, A + 2 * PASSO]
  ctx.fillStyle = COR.quadra
  for (let x = x0; x < x1; x += PASSO) {
    for (let y = y0; y < y1; y += PASSO) ctx.fillRect(x + 3, y + 3, PASSO - 6, PASSO - 6)
  }
  ctx.fillStyle = COR.parque
  ctx.fillRect(px(5) + 3, px(9) + 3, 2 * PASSO - 6, PASSO - 6)
  ctx.lineCap = 'round'
  ctx.strokeStyle = COR.rio
  ctx.lineWidth = 22
  ctx.beginPath()
  ctx.moveTo(x0, px(3.3))
  ctx.bezierCurveTo(L * 0.3, px(4.6), L * 0.7, px(2.2), x1, px(3.6))
  ctx.stroke()
  ctx.strokeStyle = COR.rua
  ctx.lineWidth = 4
  ctx.beginPath()
  for (let x = x0; x < x1; x += PASSO) {
    ctx.moveTo(x, y0)
    ctx.lineTo(x, y1)
  }
  for (let y = y0; y < y1; y += PASSO) {
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
  }
  ctx.stroke()
  ctx.strokeStyle = COR.avenida
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(x0, px(7))
  ctx.lineTo(x1, px(7))
  ctx.moveTo(px(1), y0)
  ctx.lineTo(px(6), y1)
  ctx.stroke()
  ctx.lineJoin = 'round'
  for (const [cor, largura] of [
    [COR.casco, 9],
    [COR.rota, 5],
  ] as const) {
    ctx.strokeStyle = cor
    ctx.lineWidth = largura
    ctx.beginPath()
    ROTA.forEach(([c, r], i) => (i ? ctx.lineTo(px(c), px(r)) : ctx.moveTo(px(c), px(r))))
    ctx.stroke()
  }
  const fim = ROTA[ROTA.length - 1]
  if (fim) {
    ctx.strokeStyle = COR.destino
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(px(fim[0]), px(fim[1]), 6, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

/** Comprimento acumulado da rota (px), para andar por ela a passo constante. */
const trechos = ROTA.slice(1).map((p, i) => {
  const q = ROTA[i] ?? p
  return Math.hypot(px(p[0]) - px(q[0]), px(p[1]) - px(q[1]))
})
const TOTAL = trechos.reduce((s, d) => s + d, 0)

export interface Celular {
  pose: (t: number) => void
  parado: () => void
  dispose: () => void
}

export function criarCelular(raiz: THREE.Object3D): Celular | null {
  const tela = raiz.getObjectByName('uber_celular_tela')
  if (!tela || typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  const fundo = document.createElement('canvas')
  canvas.width = fundo.width = L
  canvas.height = fundo.height = A
  const ctx = canvas.getContext('2d')
  const ctxFundo = fundo.getContext('2d')
  if (!ctx || !ctxFundo) return null
  desenharMapa(ctxFundo)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  // UV do glTF: v = 0 no topo da imagem.
  tex.flipY = false
  tex.anisotropy = 4
  // A face da tela no glb pode vir virada para o painel (volta 3: normal −Z, descartada pelo culling; o que se via
  // era o corpo cinza atrás). Desenhada dos dois lados; vista pelas costas, o mapa é espelhado para não inverter.
  raiz.updateWorldMatrix(true, true)
  const n = new THREE.Vector3()
  tela.traverse((o) => {
    if (!isMesh(o)) return
    if (o.geometry.hasAttribute('normal')) {
      n.fromBufferAttribute(o.geometry.getAttribute('normal'), 0).transformDirection(o.matrixWorld)
      // A câmera do site olha o rosto de +Z do glb (a raiz clonada está solta: o mundo dela é o glb).
      if (n.z < 0) [tex.repeat.x, tex.offset.x] = [-1, 1]
    }
    for (const m of [o.material].flat()) {
      const s = m as THREE.MeshStandardMaterial
      s.map = tex
      s.color.set('#ffffff')
      s.side = THREE.DoubleSide
      s.needsUpdate = true
    }
  })

  /** Pinta o ponto na fração f da rota. */
  const pintar = (f: number) => {
    ctx.drawImage(fundo, 0, 0)
    let resta = f * TOTAL
    let i = 0
    while (i < trechos.length - 1 && resta > (trechos[i] ?? 0)) resta -= trechos[i++] ?? 0
    const p = ROTA[i]
    const q = ROTA[i + 1]
    if (!p || !q) return
    const k = Math.min(resta / (trechos[i] || 1), 1)
    const x = px(p[0] + (q[0] - p[0]) * k)
    const y = px(p[1] + (q[1] - p[1]) * k)
    ctx.save()
    girar(ctx)
    ctx.fillStyle = COR.halo
    ctx.beginPath()
    ctx.arc(x, y, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = COR.ponto
    ctx.beginPath()
    ctx.arc(x, y, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    tex.needsUpdate = true
  }

  let passo = -1
  return {
    pose: (t) => {
      const n = Math.floor(t / PASSO_S)
      if (n === passo) return
      passo = n
      pintar((INICIO + t / VOLTA) % 1)
    },
    parado: () => pintar(0.5),
    dispose: () => tex.dispose(),
  }
}
