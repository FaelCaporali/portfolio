/**
 * O 8 da vida ai (FICHA §4.1): não é moldura, é o PERCURSO do caso na ordem da história, desenhado pelo fio de luz:
 *   IDE (canto de cima à esquerda) → diagonal POR TRÁS da cabeça → a mesa do robô (embaixo à direita) → sobe a coluna
 *   da direita até o chat → diagonal por trás da cabeça → n8n e operador (embaixo à esquerda) → sobe a borda esquerda →
 *   IDE. As duas diagonais se cruzam atrás da cabeça (o busto fica na frente); dentro das janelas o fio passa por baixo
 *   delas (a janela o cobre). O fio nunca cruza o bloco de UI (título, botões, contato) e fica a ≥ 16 px dele.
 * Tudo em px CSS no resize. `marcos`: o arco (px) em que o fio chega à mesa, ao chat, ao n8n e de volta à IDE.
 */
import type { Ponto, Quadro } from './pincel'
import type { Medida, Zonas } from './zonas'

export interface Caminho {
  pts: Ponto[]
  /** Comprimento acumulado (px) em cada ponto. */
  s: Float32Array
  total: number
  marcos: { mesa: number; chat: number; humano: number }
}

const PASSO = 5

function reta(a: Ponto, b: Ponto, out: Ponto[]) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / PASSO))
  for (let i = 1; i <= n; i++) out.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n])
}

function curva(a: Ponto, c: Ponto, b: Ponto, out: Ponto[]) {
  const n = Math.max(
    2,
    Math.ceil((Math.hypot(c[0] - a[0], c[1] - a[1]) + Math.hypot(b[0] - c[0], b[1] - c[1])) / PASSO),
  )
  for (let i = 1; i <= n; i++) {
    const u = i / n
    const p = (1 - u) * (1 - u)
    const q = 2 * u * (1 - u)
    const r = u * u
    out.push([p * a[0] + q * c[0] + r * b[0], p * a[1] + q * c[1] + r * b[1]])
  }
}

/** Polilinha pelos pontos `v` com os cantos arredondados (raio R); acrescenta a `out` (sem o primeiro ponto). */
function arredondada(v: readonly Ponto[], R: number, out: Ponto[]) {
  let atual = v[0] as Ponto
  for (let i = 1; i < v.length - 1; i++) {
    const c = v[i] as Ponto
    const prox = v[i + 1] as Ponto
    const la = Math.hypot(c[0] - atual[0], c[1] - atual[1]) || 1
    const lb = Math.hypot(prox[0] - c[0], prox[1] - c[1]) || 1
    const r = Math.min(R, la / 2, lb / 2)
    const a: Ponto = [c[0] + ((atual[0] - c[0]) * r) / la, c[1] + ((atual[1] - c[1]) * r) / la]
    const b: Ponto = [c[0] + ((prox[0] - c[0]) * r) / lb, c[1] + ((prox[1] - c[1]) * r) / lb]
    reta(atual, a, out)
    curva(a, c, b, out)
    atual = b
  }
  reta(atual, v[v.length - 1] as Ponto, out)
}

const perto = (pts: readonly Ponto[], alvo: Ponto) => {
  let melhor = Infinity
  let k = 0
  pts.forEach((p, i) => {
    const d = (p[0] - alvo[0]) ** 2 + (p[1] - alvo[1]) ** 2
    if (d < melhor) {
      melhor = d
      k = i
    }
  })
  return k
}

/** O caminho do 8 para a medida `md` e as janelas `z` (as três precisam existir). */
export function montarOito(md: Medida, z: Zonas): Caminho | null {
  const { ide, chat, humano } = z
  if (!ide || !chat || !humano) return null
  const R = Math.max(8, Math.round((md.cabeca.y1 - md.cabeca.y0) * 0.05))
  const retrato = md.w < md.h
  // A borda esquerda (entre a borda da tela e o texto) e a da direita (além do chat, acima do contato).
  const xE = retrato ? ide.x0 + 3 : Math.max(18, Math.min(md.ui.x0 - 22, md.ui.x0 / 2))
  const xD = chat.x1 - 6
  const A: Ponto = [ide.x1 - R * 1.5, ide.y1 - R]
  const mesa = md.pe
  const baixoD = Math.min(md.balao ? md.balao.y0 - 22 : md.h - 24, retrato ? md.ui.y0 - 22 : Infinity, mesa[1])
  const B: Ponto = [mesa[0], baixoD]
  const D: Ponto = [chat.x0 + R * 2, chat.y0 + R * 3]
  const E: Ponto = [humano.x1 - R * 2, humano.y0 + R * 2]
  const pts: Ponto[] = [A]
  // IDE → mesa (diagonal por trás da cabeça) → direita → sobe a coluna até o chat.
  arredondada([A, B, [xD, B[1]], [xD, D[1]], D], R, pts)
  const kMesa = perto(pts, B)
  const kChat = pts.length - 1
  // Chat → n8n/operador (diagonal por trás da cabeça) → esquerda, sob as janelas → sobe a borda → IDE.
  arredondada([D, E, [xE, E[1]], [xE, A[1]], A], R, pts)
  const kHumano = perto(pts.slice(kChat), E) + kChat
  const s = new Float32Array(pts.length)
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Ponto
    const b = pts[i] as Ponto
    s[i] = (s[i - 1] ?? 0) + Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  const total = s[pts.length - 1] ?? 0
  return { pts, s, total, marcos: { mesa: s[kMesa] ?? 0, chat: s[kChat] ?? 0, humano: s[kHumano] ?? 0 } }
}

/**
 * O elo de luz do 0.8 da IDE ao escudo do guardrail: desce do número ao rodapé da IDE (sem cruzar código), corre até a
 * borda dela e segue em diagonal por trás da cabeça até o escudo — sempre acima do bloco de texto do herói.
 */
export function montarElo(de: Ponto, ide: Quadro, ate: Ponto): Caminho {
  const pe = ide.y1 - 8
  const pts: Ponto[] = [de]
  arredondada([de, [de[0], pe], [ide.x1 - 4, pe], ate], 6, pts)
  const s = new Float32Array(pts.length)
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Ponto
    const b = pts[i] as Ponto
    s[i] = (s[i - 1] ?? 0) + Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return { pts, s, total: s[pts.length - 1] ?? 0, marcos: { mesa: 0, chat: 0, humano: 0 } }
}
