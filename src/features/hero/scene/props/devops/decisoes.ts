/**
 * DECISÕES POR TRADEOFF em movimento (REQUISITOS D18; FICHA, batida 2,0–2,8 s): os dois elementos comparados CRESCEM
 * lado a lado (ícone e nome legíveis de relance), o ✓ marca a escolha e, nos pares excludentes (SQS × RabbitMQ, ECS on
 * Fargate × Docker Swarm), o perdedor é CORTADO (risco vermelho) e some; o escolhido volta ao tamanho e DESLIZA para
 * o seu lugar no diagrama. Nos pares por serviço (RDS × DynamoDB, Lambda × Fargate) os dois ganham o ✓ e cada um
 * encaixa no serviço que o escolheu. O palco é a zona livre do par (zonas.ts: fora da UI com respiro e fora da
 * cabeça), então nada cresce sobre o rosto nem sobre a interface. No canvas do diagrama esses elementos só aparecem
 * quando pousam (o sprite sai no mesmo instante). Uma malha, uma chamada; por quadro só se reescrevem os vértices.
 */
import * as THREE from 'three'
import { withDissolve } from '../../dissolve'
import { COR, MONO } from './estilo'
import { desenharIcone, type Icone } from './icones'
import type { Quadro } from './pincel'

export interface ItemPar {
  id: Icone
  nome: string
  nota?: string
  /** Centro e lado do ícone no diagrama (px CSS). */
  x: number
  y: number
  lado: number
  vence: boolean
}

export interface Par {
  exclusivo: boolean
  /** Início e pouso (s do ciclo). */
  de: number
  ate: number
  palco: Quadro
  itens: readonly [ItemPar, ItemPar]
}

/** Janela de cada par dentro da batida de decisões (roteiro): escalonados, pousam antes de 2,9 s. */
export const JANELA = {
  sqs: [2.0, 2.45],
  runtime: [2.05, 2.5],
  dados: [2.15, 2.6],
  computacao: [2.4, 2.85],
} as const

/** Célula de um cartão no atlas (px): ícone em cima, nome e nota embaixo. */
const CEL = 160
const ICONE = 96
/** Cartão na tela: largura = CARTAO × lado do ícone. */
const CARTAO = CEL / ICONE
const MAX_PARES = 4
/** Cantos do quad: deslocamento (x, y) e a coordenada na célula (u, v). */
const CANTOS = [
  [-0.5, -0.5, 0, 1],
  [0.5, -0.5, 1, 1],
  [0.5, 0.5, 1, 0],
  [-0.5, 0.5, 0, 0],
] as const
const ATRIBUTOS = ['position', 'uv', 'color'] as const
/** Quads: por par, dois cartões, dois ✓ e um risco. */
const QUADS = MAX_PARES * 5

const liso = (x: number) => {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}

/** Atlas: um cartão por item (linha por par) e, na última coluna, o ✓ e o risco. */
function pintarAtlas(pares: readonly Par[], img: HTMLImageElement) {
  const cv = document.createElement('canvas')
  cv.width = CEL * 4
  cv.height = CEL * MAX_PARES
  const ctx = cv.getContext('2d')
  if (!ctx) throw new Error('decisões: canvas 2D indisponível')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  pares.forEach((p, i) => {
    p.itens.forEach((it, j) => {
      const x = j * CEL + CEL / 2
      const y = i * CEL
      desenharIcone(ctx, img, it.id, x, y + 4 + ICONE / 2, ICONE)
      ctx.font = `700 26px ui-sans-serif, system-ui, sans-serif`
      ctx.fillStyle = COR.nome
      ctx.fillText(it.nome, x, y + 118, CEL - 4)
      if (it.nota) {
        ctx.font = `20px ${MONO}`
        ctx.fillStyle = COR.contrato
        ctx.fillText(it.nota, x, y + 144, CEL - 4)
      }
    })
  })
  // ✓ (coluna 2, linha 0) e risco (coluna 3, linha 0).
  ctx.lineCap = 'round'
  ctx.strokeStyle = COR.check
  ctx.lineWidth = 22
  ctx.beginPath()
  ctx.moveTo(2 * CEL + 30, 85)
  ctx.lineTo(2 * CEL + 65, 120)
  ctx.lineTo(2 * CEL + 130, 40)
  ctx.stroke()
  ctx.strokeStyle = COR.risco
  ctx.lineWidth = 14
  ctx.beginPath()
  ctx.moveTo(3 * CEL + 12, CEL - 12)
  ctx.lineTo(4 * CEL - 12, 12)
  ctx.stroke()
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.generateMipmaps = false
  t.minFilter = THREE.LinearFilter
  return t
}

/** Onde o par cresce no palco: lado a lado na horizontal ou, em coluna estreita, empilhado. */
function arranjo(p: Par, grande: number) {
  const q = p.palco
  const w = q.x1 - q.x0
  const h = q.y1 - q.y0
  const lh = Math.min(grande, (w - 16) / 2 / CARTAO, (h - 8) / CARTAO)
  const lv = Math.min(grande, (w - 8) / CARTAO, (h - 16) / 2 / CARTAO)
  const horizontal = lh >= lv
  const lado = Math.max(horizontal ? lh : lv, 8)
  const c = lado * CARTAO
  const [a, b] = p.itens
  let cx = (a.x + b.x) / 2
  let cy = (a.y + b.y) / 2
  const mw = horizontal ? c + 4 : c / 2
  const mh = horizontal ? c / 2 : c + 4
  cx = Math.min(Math.max(cx, q.x0 + mw), q.x1 - mw)
  cy = Math.min(Math.max(cy, q.y0 + mh), q.y1 - mh)
  const d = c / 2 + 4
  const pos: [number, number][] = horizontal
    ? [
        [cx - d, cy],
        [cx + d, cy],
      ]
    : [
        [cx, cy - d],
        [cx, cy + d],
      ]
  return { lado, pos }
}

export function criarDecisoes() {
  const pos = new Float32Array(QUADS * 4 * 3)
  const uv = new Float32Array(QUADS * 4 * 2)
  // Cor por vértice RGBA: branco com o alfa do quad (o atlas dá a cor).
  const alfa = new Float32Array(QUADS * 4 * 4)
  const idx: number[] = []
  for (let i = 0; i < QUADS; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage))
  geo.setAttribute('color', new THREE.BufferAttribute(alfa, 4).setUsage(THREE.DynamicDrawUsage))
  geo.setIndex(idx)
  const u = { uAtlas: { value: null as THREE.Texture | null } }
  const mat = withDissolve(
    // Os cantos vão em y de tela (para baixo): o triângulo sai no sentido horário, então os dois lados.
    new THREE.MeshBasicMaterial({
      name: 'arq_decisoes',
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      side: THREE.DoubleSide,
    }),
  )
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'arq_decisoes'
  mesh.frustumCulled = false
  // Logo depois dos painéis do fundo (-1) e antes das outras transparências da cena.
  mesh.renderOrder = -0.5
  mesh.visible = false
  let pares: Par[] = []
  let arr: ReturnType<typeof arranjo>[] = []
  // Tela → plano do fundo: o raio exato por vértice (o frame tem inclinação; uma aproximação afim desloca tudo).
  let mapear: (x: number, y: number, out: THREE.Vector3) => void = (_x, _y, out) => {
    out.set(0, 0, 0)
  }
  const v = new THREE.Vector3()

  /** No resize: os pares pintados, o tamanho grande (px) e o mapa tela → plano. */
  const definir = (
    lista: Par[],
    img: HTMLImageElement,
    grande: number,
    mapa: (x: number, y: number, out: THREE.Vector3) => void,
  ) => {
    pares = lista.slice(0, MAX_PARES)
    arr = pares.map((p) => arranjo(p, grande))
    u.uAtlas.value?.dispose()
    u.uAtlas.value = pintarAtlas(pares, img)
    mat.map = u.uAtlas.value
    mat.needsUpdate = true
    mapear = mapa
  }

  let q = 0
  /** Um quad: centro (px), largura e altura (px), célula (coluna, linha) do atlas e alfa. */
  const quad = (x: number, y: number, w: number, h: number, col: number, lin: number, a: number) => {
    if (q >= QUADS) return
    for (let k = 0; k < 4; k++) {
      const [dx, dy, su, sv] = CANTOS[k] ?? CANTOS[0]
      const n = q * 4 + k
      mapear(x + dx * w, y + dy * h, v)
      v.z += 0.002
      v.toArray(pos, n * 3)
      uv[n * 2] = (col + su) / 4
      uv[n * 2 + 1] = 1 - (lin + 1 - sv) / MAX_PARES
      alfa.fill(1, n * 4, n * 4 + 3)
      alfa[n * 4 + 3] = a
    }
    q++
  }

  /** Quadro no instante c do ciclo; `parado` (movimento reduzido): nada em cena, tudo já pousado no diagrama. */
  const atualizar = (c: number, parado: boolean) => {
    q = 0
    alfa.fill(0)
    mesh.visible = !parado && pares.some((p) => c > p.de && c < p.ate)
    if (!mesh.visible) return
    pares.forEach((p, i) => {
      const f = (c - p.de) / (p.ate - p.de)
      if (f <= 0 || f >= 1) return
      const a = arr[i]
      if (!a) return
      const cresce = liso(f / 0.3)
      const volta = liso((f - 0.65) / 0.35)
      const entra = liso(f / 0.08)
      p.itens.forEach((it, j) => {
        const alvo = a.pos[j] ?? [it.x, it.y]
        const perde = p.exclusivo && !it.vence
        const k = perde ? cresce : cresce * (1 - volta)
        const x = it.x + (alvo[0] - it.x) * k
        const y = it.y + (alvo[1] - it.y) * k
        const lado = it.lado + (a.lado - it.lado) * k
        const some = perde ? 1 - liso((f - 0.45) / 0.2) : 1
        const w = lado * CARTAO
        // O cartão tem o ícone no alto: o centro do cartão fica abaixo do centro do ícone.
        const cy = y + w / 2 - (4 + ICONE / 2) * (lado / ICONE)
        quad(x, cy, w, w, j, i, entra * some)
        const marca = it.vence || !p.exclusivo
        const s = liso((f - 0.3) / 0.1) * (marca ? 1 - volta : 0)
        if (s > 0) quad(x + lado * 0.55, y - lado * 0.45, lado * 0.55, lado * 0.55, 2, 0, s)
        const corte = perde ? liso((f - 0.33) / 0.12) : 0
        if (corte > 0) quad(x, cy, w * 0.95 * corte, w * 0.95 * corte, 3, 0, corte * some)
      })
    })
    for (const nome of ATRIBUTOS) geo.getAttribute(nome).needsUpdate = true
  }
  const dispose = () => {
    u.uAtlas.value?.dispose()
    mat.dispose()
    geo.dispose()
  }
  return { mesh, definir, atualizar, dispose }
}
