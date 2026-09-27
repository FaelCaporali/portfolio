/**
 * Chuva de código (F10; ficha do fullstack, ADENDO 1): código REAL deste portfólio (os próprios arquivos da vida,
 * importados como texto) caindo em colunas atrás do busto, como no Matrix, sem números soltos nem binário. Trechos
 * CONSECUTIVOS do fonte, com a indentação e o realce de sintaxe do VS Code Dark+ (F10b, sintaxe.ts); em cada coluna um
 * "fio" desce com as linhas: a da frente inteira e com um leve brilho do acento da vida (#3ddc84), as de trás
 * desbotando pelo alfa. Queda rápida (F10a): cada linha atravessa o plano em 2,5–3,6 s, a velocidade por coluna.
 *
 * Grade dinâmica por tela (F10c, F10d): o corpo da fonte em px CSS é fixo por formato (12 no largo, 10,5 no retrato
 * estreito); as linhas saem da altura do plano projetada na tela e as colunas da largura projetada dividida pela
 * largura de coluna do formato (no celular, colunas mais curtas: menos glifos). Recalculado no resize (`ajustar`); o
 * atlas é redesenhado com as linhas cortadas na largura da coluna, sem quebrar token quando dá.
 *
 * Um plano, um material, uma chamada: a cor vai no próprio atlas (canvas, uma linha por faixa, sem mipmap). Por quadro,
 * só o relógio (uniforme) muda: nada alocado. A desintegração do busto (uD) apaga a chuva inteira.
 */
import * as THREE from 'three'
import ancoraSrc from '../ancora.ts?raw'
import { dissolveUniforms } from '../../dissolve'
import chuvaSrc from './chuva.ts?raw'
import fullstackSrc from './Fullstack.tsx?raw'
import { colorir, cortar, type Token } from './sintaxe'

/** Plano no espaço do glb, atrás da cabeça (o crânio vai a z −0,30); x > 0 porque a câmera olha à esquerda da
 * cabeça e o que está longe escorrega para o centro da tela. */
const PLANO = { largura: 0.7, altura: 0.38, centro: [0.06, 0.19, -0.42] as const }
/** Por formato: corpo da fonte (px CSS), caracteres por coluna (largura da coluna) e fração da largura da tela à
 * esquerda da qual não chove (no largo, o texto da UI vai até ~44% no 1024 e ~36% no 1440). */
const FORMATO = {
  largo: { corpo: 12, chars: 28, limiteEsq: 0.46 },
  estreito: { corpo: 10.5, chars: 16, limiteEsq: 0 },
}
/** Fio e distância entre fios, em fração da altura do plano: ~3/4 de cada coluna sempre com código (sem coluna vazia
 * na queda rápida). */
const FIO = 0.5
const PERIODO = 0.65
/** Fração da coluna com texto (o resto é o respiro entre colunas). */
const PREENCHE = 0.92
/** Atlas: linhas de código, caracteres por linha, corpo da fonte e altura da faixa (px); indentação máxima. */
const ATLAS = { linhas: 64, chars: 36, fonte: 24, faixa: 30, indentacao: 8 }
/** Segundos para uma linha atravessar o plano (a coluna mais lenta e a mais rápida): ~150–220 px/s no 1440 (F10a:
 * volume de código passando; ler a linha inteira deixou de limitar), proporcional nas outras telas. */
const TRAVESSIA = [3.6, 2.5] as const
/** Brilho do rastro (a frente é 1) e do acento na linha da frente. */
const COR = { rastro: 0.55, acento: '#3ddc84', brilhoAcento: 0.12 }

export type Formato = keyof typeof FORMATO

/** Linhas de código consecutivas (sem linha vazia nem só de comentário), coloridas uma vez. */
function linhasDeCodigo(): Token[][] {
  const linhas = [fullstackSrc, chuvaSrc, ancoraSrc]
    .flatMap((s) => s.split('\n'))
    .filter((l) => l.trim() && !/^\s*(\*|\/\*|\/\/)/.test(l))
    .map((l) => {
      const ind = l.length - l.trimStart().length
      return ' '.repeat(Math.min(ind, ATLAS.indentacao)) + l.trimStart()
    })
  // Um trecho do meio de cada arquivo cabe no atlas; o início (imports) fica de fora.
  const ini = Math.max(0, Math.floor((linhas.length - ATLAS.linhas) / 2))
  return linhas.slice(ini, ini + ATLAS.linhas).map(colorir)
}

function criarAtlas() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('chuva: canvas 2D indisponível')
  const fonte = `${ATLAS.fonte}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  ctx.font = fonte
  const passo = Math.ceil(ctx.measureText('M').width)
  canvas.width = passo * ATLAS.chars
  canvas.height = ATLAS.faixa * ATLAS.linhas
  const linhas = linhasDeCodigo()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  // Nítido: sem mipmap (que borrava o glifo), filtro linear.
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  /** Redesenha com cada linha cortada em `chars` caracteres (no fim de token quando dá). */
  const desenhar = (chars: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = fonte
    ctx.textBaseline = 'middle'
    linhas.forEach((tokens, i) => {
      const y = i * ATLAS.faixa + ATLAS.faixa / 2
      let c = 0
      for (const t of cortar(tokens, chars)) {
        ctx.fillStyle = t.cor
        for (const ch of t.texto) {
          if (ch !== ' ') ctx.fillText(ch, c * passo, y)
          c++
        }
      }
    })
    tex.needsUpdate = true
  }
  return { tex, desenhar, aspecto: passo / ATLAS.faixa }
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uTempo;
uniform float uD;
uniform vec3 uAcento;
uniform float uColunas;
uniform float uLinhas;
uniform float uChars;
uniform float uPreenche;
uniform float uMin;
uniform float uParado;
varying vec2 vUv;
const float ATLAS_LINHAS = ${ATLAS.linhas.toFixed(1)};
const float ATLAS_CHARS = ${ATLAS.chars.toFixed(1)};
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  // Parte do plano à esquerda de uMin fica de fora (a coluna do texto da UI no largo); as colunas no resto.
  float ux = (vUv.x - uMin) / (1.0 - uMin);
  if (ux < 0.0) discard;
  float c = floor(ux * uColunas);
  float fx = fract(ux * uColunas) / uPreenche;
  if (fx > 1.0) discard;
  // Linhas por segundo: a coluna atravessa o plano em ${TRAVESSIA[0]} a ${TRAVESSIA[1]} s.
  float vel = uLinhas / mix(${TRAVESSIA[0].toFixed(1)}, ${TRAVESSIA[1].toFixed(1)}, h1(c + 3.0));
  float andou = uTempo * vel + h1(c + 11.0) * 97.0;
  float y = (1.0 - vUv.y) * uLinhas;
  // Fios de FIO do plano, um a cada PERIODO do plano; atras = linhas atras da frente do fio.
  float periodo = max(4.0, floor(uLinhas * ${PERIODO.toFixed(2)}));
  float fio = max(3.0, floor(uLinhas * ${FIO.toFixed(2)}));
  // Movimento reduzido: parada, com a frente de cada coluna entre 45% e 70% da altura (longe das bordas esmaecidas).
  if (uParado > 0.5) andou = floor(h1(c + 11.0) * 9.0) * periodo + floor(uLinhas * (0.45 + 0.25 * h1(c + 5.0)));
  float atras = mod(andou - y, periodo);
  if (atras > fio) discard;
  float s = y - andou;
  float linha = floor(s);
  float volta = floor((andou - y) / periodo);
  // Trecho consecutivo do fonte: início por coluna e por volta, as linhas em ordem de cima para baixo.
  float inicio = floor(h1(c * 7.0 + volta * 3.0 + 1.0) * ATLAS_LINHAS);
  float id = mod(inicio + linha - volta * periodo, ATLAS_LINHAS);
  vec2 a = vec2(fx * uChars / ATLAS_CHARS, 1.0 - (id + fract(s)) / ATLAS_LINHAS);
  vec4 g = texture2D(uAtlas, a);
  float k = 1.0 - atras / fio;
  bool frente = atras < 1.0;
  vec3 cor = frente ? mix(g.rgb, uAcento, ${COR.brilhoAcento.toFixed(2)}) : g.rgb;
  float forca = frente ? 1.0 : ${COR.rastro.toFixed(2)} * k * sqrt(k);
  // Esmaece nas bordas: pouco dos lados, mais no alto e embaixo.
  float borda = smoothstep(0.0, 0.05, ux) * smoothstep(0.0, 0.05, 1.0 - vUv.x) * smoothstep(0.0, 0.2, 1.0 - vUv.y)
    * smoothstep(0.0, 0.2, vUv.y);
  float alfa = g.a * forca * borda * (1.0 - smoothstep(0.0, 0.3, uD));
  if (alfa < 0.004) discard;
  gl_FragColor = vec4(cor, alfa);
  #include <colorspace_fragment>
}`

/** O plano da chuva, o relógio dele (s) e o ajuste da grade à tela. */
export function criarChuva() {
  const atlas = criarAtlas()
  const u = {
    uAtlas: { value: atlas.tex },
    uTempo: { value: 0 },
    // O mesmo objeto do busto: a chuva apaga com a desintegração sem nada por quadro.
    uD: dissolveUniforms.uD,
    uAcento: { value: new THREE.Color(COR.acento) },
    uColunas: { value: 1 },
    uLinhas: { value: 1 },
    uChars: { value: 1 },
    uPreenche: { value: PREENCHE },
    uMin: { value: 0 },
    uParado: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({
    name: 'fs_chuva',
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: u,
    transparent: true,
    depthWrite: false,
  })
  const geo = new THREE.PlaneGeometry(PLANO.largura, PLANO.altura)
  const mesh = new THREE.Mesh(geo, material)
  mesh.name = 'fs_chuva'
  mesh.position.set(...PLANO.centro)
  // Atrás de tudo o que é transparente no adereço.
  mesh.renderOrder = -1
  /** Grade vigente (lida pelas ferramentas do estúdio). */
  const grade = { formato: 'largo' as Formato, colunas: 0, linhas: 0, chars: 0, corpo: ATLAS.fonte / ATLAS.faixa }
  mesh.userData.grade = grade
  const v = new THREE.Vector3()
  const px = (x: number, y: number, camera: THREE.Camera, w: number, h: number): [number, number] => {
    v.set(x, y, 0).applyMatrix4(mesh.matrixWorld).project(camera)
    return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h]
  }
  /** Grade para a tela (px CSS) e a câmera atuais: chamado na montagem e no resize, nunca por quadro. */
  const ajustar = (camera: THREE.Camera, w: number, h: number) => {
    const f: Formato = w < h ? 'estreito' : 'largo'
    const fmt = FORMATO[f]
    mesh.updateWorldMatrix(true, false)
    camera.updateMatrixWorld()
    const [xe, yt] = px(-PLANO.largura / 2, PLANO.altura / 2, camera, w, h)
    const [xd, yb] = px(PLANO.largura / 2, -PLANO.altura / 2, camera, w, h)
    // No largo, nada à esquerda de LIMITE_ESQ da tela (a coluna do texto da UI).
    const uMin = THREE.MathUtils.clamp((w * fmt.limiteEsq - xe) / (xd - xe), 0, 0.9)
    const faixaPx = fmt.corpo / grade.corpo
    const linhas = Math.max(4, Math.round(Math.abs(yb - yt) / faixaPx))
    const charPx = fmt.corpo * (atlas.aspecto / grade.corpo)
    const colunas = Math.max(1, Math.floor((Math.abs(xd - xe) * (1 - uMin)) / ((fmt.chars * charPx) / PREENCHE)))
    // Caracteres que cabem na coluna, na proporção do glifo do atlas (sem espremer).
    const colW = (PLANO.largura * (1 - uMin)) / colunas
    const charW = (PLANO.altura / linhas) * atlas.aspecto
    const chars = Math.max(1, Math.min(ATLAS.chars, Math.floor((colW * PREENCHE) / charW)))
    if (chars !== grade.chars) atlas.desenhar(chars)
    u.uMin.value = uMin
    u.uColunas.value = colunas
    u.uLinhas.value = linhas
    u.uChars.value = chars
    u.uPreenche.value = (chars * charW) / colW
    Object.assign(grade, { formato: f, colunas, linhas, chars })
  }
  const tempo = u.uTempo
  /** 1 com movimento reduzido (chuva parada). */
  const parado = u.uParado
  const dispose = () => {
    atlas.tex.dispose()
    material.dispose()
    geo.dispose()
  }
  return { mesh, tempo, parado, ajustar, dispose }
}
