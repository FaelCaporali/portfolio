/**
 * Painéis de texto no FUNDO da vida qa (REQUISITOS Q20, Q21; FICHA-PRODUCAO ADENDO v2.1), com a técnica da chuva do
 * FullStack (props/fullstack/chuva.ts): atlas de glifos em canvas numa grade monoespaçada, realce estilo IDE, corpo da
 * fonte fixo em px CSS por formato e a grade tirada do retângulo do painel na tela (diagramação dinâmica, recalculada
 * no resize, nunca por quadro). Um plano, um material e uma chamada por painel. O texto SURGE caractere a caractere:
 * por quadro só mudam uniformes (caracteres visíveis por linha, linhas verdes, cursor), sem alocação. O atlas tem a
 * versão normal e a verde (check) de cada linha. Brilho baixo (o rosto domina), esmaece nas bordas e apaga com a
 * desintegração do busto (uD).
 */
import * as THREE from 'three'
import { dissolveUniforms } from '../../dissolve'
import type { Formato } from './composicao'
import { COR, LOGOS, linhasDoPainel, type Bloco, type Linha, type Painel } from './fundo_texto'

/** Máximo de linhas físicas por painel (tamanho dos uniformes). */
const MAX = 40
/** Glifo no atlas: corpo e altura da faixa (px); a largura do passo sai da fonte. */
const ATLAS = { fonte: 26, faixa: 34 }
const FONTE = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', 'DejaVu Sans Mono', monospace"
/** Brilho do texto (alfa): claro o bastante para ler de relance (Q23), abaixo do rosto. */
const BRILHO = 0.95
/** Profundidade do plano no espaço do glb (atrás do rosto, ao lado da cabeça). */
export const Z_FUNDO = -0.22

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uLinhas;
uniform float uCols;
uniform float uChars[${MAX}];
uniform float uVerde[${MAX}];
uniform vec3 uCursor;
uniform float uD;
uniform float uBrilho;
varying vec2 vUv;
void main() {
  float yl = (1.0 - vUv.y) * uLinhas;
  float linha = floor(yl);
  float col = floor(vUv.x * uCols);
  int i = int(linha);
  if (i < 0 || i >= ${MAX}) discard;
  float fx = fract(vUv.x * uCols);
  // Cursor de digitação: barra fina na célula seguinte ao último caractere, piscando.
  bool cursor = linha == uCursor.x && col == uCursor.y && fx < 0.18 && uCursor.z > 0.5;
  if (col >= uChars[i] && !cursor) discard;
  float verde = uVerde[i];
  vec2 a = vec2(vUv.x, 1.0 - (linha + fract(yl) + verde * uLinhas) / (2.0 * uLinhas));
  vec4 g = cursor ? vec4(0.85, 0.85, 0.85, 1.0) : texture2D(uAtlas, a);
  float borda = smoothstep(0.0, 0.02, vUv.x) * smoothstep(0.0, 0.02, 1.0 - vUv.x);
  float alfa = g.a * uBrilho * borda * (1.0 - smoothstep(0.0, 0.3, uD));
  if (alfa < 0.004) discard;
  gl_FragColor = vec4(g.rgb, alfa);
  #include <colorspace_fragment>
}`

/** Retângulo do painel na tela (px CSS). */
export interface Retangulo {
  x0: number
  y0: number
  x1: number
  y1: number
}

function medirPasso() {
  const c = document.createElement('canvas').getContext('2d')
  if (!c) throw new Error('fundo: canvas 2D indisponível')
  c.font = `${ATLAS.fonte}px ${FONTE}`
  return Math.ceil(c.measureText('M').width)
}

/** Desenha as linhas (normal em cima, verde embaixo) num canvas do tamanho exato da grade. */
function desenharAtlas(linhas: readonly Linha[], cols: number, n: number, passo: number) {
  const canvas = document.createElement('canvas')
  canvas.width = cols * passo
  canvas.height = 2 * n * ATLAS.faixa
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('fundo: canvas 2D indisponível')
  ctx.textBaseline = 'middle'
  ctx.font = `${ATLAS.fonte}px ${FONTE}`
  for (let v = 0; v < 2; v++) {
    linhas.forEach((l, i) => {
      const y = (v * n + i) * ATLAS.faixa + ATLAS.faixa / 2
      const verde = v === 1 && l.passo
      if (l.logo) {
        const lado = ATLAS.faixa * 0.9
        ctx.save()
        ctx.translate(0, y - lado / 2)
        ctx.scale(lado / 24, lado / 24)
        ctx.fillStyle = LOGOS[l.logo].cor
        ctx.fill(new Path2D(LOGOS[l.logo].d))
        ctx.restore()
      }
      l.celulas.forEach((c, k) => {
        if (c.ch === ' ') return
        ctx.fillStyle = verde ? COR.verde : c.cor
        ctx.fillText(c.ch, k * passo, y)
      })
      // Passo que passou: check verde no recuo, logo antes do texto.
      if (verde && !l.continua) {
        const k = l.celulas.findIndex((c) => c.ch !== ' ')
        ctx.fillStyle = COR.verde
        ctx.fillText('✓', Math.max(0, k - 2) * passo, y)
      }
    })
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  // Nítido como a chuva: sem mipmap, filtro linear.
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  return tex
}

/** Progresso da narrativa por bloco (0–1) e quantos passos já passaram no Cypress. */
export type Revela = Record<Bloco, number> & { verdes: number; piscar: boolean }

export function criarPainel(painel: Painel) {
  const passo = medirPasso()
  const u = {
    uAtlas: { value: null as THREE.Texture | null },
    uLinhas: { value: 1 },
    uCols: { value: 1 },
    uChars: { value: new Float32Array(MAX) },
    uVerde: { value: new Float32Array(MAX) },
    uCursor: { value: new THREE.Vector3(-1, -1, 0) },
    uD: dissolveUniforms.uD,
    uBrilho: { value: BRILHO },
  }
  const material = new THREE.ShaderMaterial({
    name: `qa_fundo_${painel}`,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: u,
    transparent: true,
    depthWrite: false,
  })
  const geo = new THREE.PlaneGeometry(1, 1)
  const mesh = new THREE.Mesh(geo, material)
  mesh.name = `qa_fundo_${painel}`
  mesh.renderOrder = -1
  // Sem grade (antes do primeiro ajuste), o plano de 1 m cobriria a tela: fica escondido.
  mesh.visible = false
  let linhas: Linha[] = []
  /** Caracteres por bloco (para distribuir o progresso) e início de cada linha dentro do bloco. */
  const inicio = new Float32Array(MAX)
  const total: Record<Bloco, number> = { a: 0, b: 0, g: 0, c: 0 }
  /** Grade vigente (lida pelas ferramentas do estúdio). */
  const grade = { cols: 0, linhas: 0, corpo: 0, rect: { x0: 0, y0: 0, x1: 0, y1: 0 } }
  mesh.userData.grade = grade

  const raio = new THREE.Raycaster()
  const plano = new THREE.Plane()
  const inv = new THREE.Matrix4()
  const ndc = new THREE.Vector2()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  /** Ponto da tela (px CSS) no plano z = Z_FUNDO do pai, em coordenadas do pai. */
  const noPlano = (x: number, y: number, camera: THREE.Camera, w: number, h: number, out: THREE.Vector3) => {
    ndc.set((x / w) * 2 - 1, 1 - (y / h) * 2)
    raio.setFromCamera(ndc, camera)
    raio.ray.applyMatrix4(inv)
    plano.set(new THREE.Vector3(0, 0, 1), -Z_FUNDO)
    return raio.ray.intersectPlane(plano, out) ?? out.set(0, 0, Z_FUNDO)
  }

  /** Grade e plano para o retângulo `r` (px CSS) e o corpo `corpo` (px CSS): na montagem e no resize. */
  const ajustar = (camera: THREE.Camera, w: number, h: number, r: Retangulo, corpo: number, f: Formato) => {
    const pai = mesh.parent
    if (!pai) return
    pai.updateWorldMatrix(true, false)
    camera.updateMatrixWorld()
    inv.copy(pai.matrixWorld).invert()
    noPlano(r.x0, r.y0, camera, w, h, a)
    noPlano(r.x1, r.y1, camera, w, h, b)
    const faixaPx = (corpo * ATLAS.faixa) / ATLAS.fonte
    const charPx = (corpo * passo) / ATLAS.fonte
    const cols = Math.max(4, Math.floor((r.x1 - r.x0) / charPx))
    const n = Math.max(1, Math.min(MAX, Math.floor((r.y1 - r.y0) / faixaPx)))
    linhas = linhasDoPainel(painel, cols, n, f)
    // O plano encolhe para a grade exata (o texto não estica): a largura das colunas e a altura das linhas usadas.
    const usadas = Math.max(1, linhas.length)
    const kx = (cols * charPx) / (r.x1 - r.x0)
    const ky = (usadas * faixaPx) / (r.y1 - r.y0)
    const cx = a.x + (b.x - a.x) * (kx / 2)
    const cy = a.y + (b.y - a.y) * (ky / 2)
    mesh.position.set(cx, cy, Z_FUNDO)
    mesh.scale.set(Math.abs(b.x - a.x) * kx, Math.abs(a.y - b.y) * ky, 1)
    u.uAtlas.value?.dispose()
    u.uAtlas.value = desenharAtlas(linhas, cols, usadas, passo)
    u.uLinhas.value = usadas
    u.uCols.value = cols
    total.a = total.b = total.g = total.c = 0
    linhas.forEach((l, i) => {
      inicio[i] = total[l.bloco]
      total[l.bloco] += l.celulas.length
    })
    Object.assign(grade, { cols, linhas: usadas, corpo, rect: { ...r } })
    mesh.visible = true
  }

  /** Revela o texto no progresso `p` (por quadro, sem alocar). */
  const revelar = (p: Revela) => {
    const chars = u.uChars.value
    const verde = u.uVerde.value
    const cursor = u.uCursor.value
    cursor.set(-1, -1, p.piscar ? 1 : 0)
    chars.fill(0)
    verde.fill(0)
    let passos = 0
    linhas.forEach((l, i) => {
      const n = Math.max(0, Math.min(l.celulas.length, Math.floor(p[l.bloco] * total[l.bloco] - (inicio[i] ?? 0))))
      chars[i] = n
      if (n > 0 && n < l.celulas.length) cursor.set(i, n, cursor.z)
      // A continuação de um passo (quebra) fica verde com ele.
      if (l.passo && !l.continua) passos++
      if (l.passo) verde[i] = passos <= p.verdes ? 1 : 0
    })
  }
  const dispose = () => {
    u.uAtlas.value?.dispose()
    material.dispose()
    geo.dispose()
  }
  return { mesh, ajustar, revelar, dispose }
}
