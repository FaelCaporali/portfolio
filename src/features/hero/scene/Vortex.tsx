import { useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { DISSOLVE_MAX } from '../model/carousel'
import { NOISE_GLSL, dissolveUniforms } from './dissolve'
import { emFatias } from './pausa'

const COUNT = 42000
/** Eixo do furacão: vertical, pelo centro do crânio (espaço do glb). */
const AXIS = new THREE.Vector2(0, -0.125)

const vertex = /* glsl */ `
uniform float uD;
uniform float uSwirl;
uniform float uSize;
attribute vec3 aColor;
attribute float aSeed;
varying vec3 vColor;
varying float vAlpha;
${NOISE_GLSL}
void main() {
  float n = disField(position);
  float lt = clamp((uD - n) / (${DISSOLVE_MAX.toFixed(2)} - 1.0 + 0.001), 0.0, 1.0);
  float e = lt * lt * (3.0 - 2.0 * lt);
  vec2 rel = position.xz - vec2(${AXIS.x.toFixed(3)}, ${AXIS.y.toFixed(3)});
  float r0 = length(rel);
  // Redemoinho solto (o furacão é referência, não forma): cada partícula sobe girando e se afasta do eixo.
  float a = atan(rel.y, rel.x) + e * (4.0 + aSeed * 7.0) + e * uSwirl * (0.6 + aSeed);
  float r = r0 + e * (0.08 + aSeed * 0.26);
  float y = position.y + lt * lt * (0.18 + aSeed * 0.42);
  vec3 p = vec3(${AXIS.x.toFixed(3)} + cos(a) * r, y, ${AXIS.y.toFixed(3)} + sin(a) * r);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.6 + aSeed) / -mv.z;
  vColor = mix(vec3(1.0, 0.86, 0.62), aColor, smoothstep(0.0, 0.25, lt));
  vAlpha = step(0.0001, lt) * smoothstep(0.0, 0.06, lt) * (1.0 - 0.55 * lt);
}`

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25 || vAlpha <= 0.0) discard;
  gl_FragColor = vec4(vColor, vAlpha * (1.0 - d * 4.0));
}`

/**
 * Lê os texels do mapa de cor para colorir cada partícula com a pele do ponto de onde saiu. Em passos (#138): desenha,
 * e lê em faixas de linhas (cada pixel é o mesmo da leitura inteira).
 */
function* lerTexels(tex: THREE.Texture): Generator<void, (u: number, v: number, out: Float32Array, o: number) => void> {
  const img = tex.image as CanvasImageSource & { width: number; height: number }
  const cv = document.createElement('canvas')
  cv.width = img.width
  cv.height = img.height
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas 2D indisponível para ler a textura da pele')
  ctx.drawImage(img, 0, 0)
  yield
  const data = new Uint8ClampedArray(cv.width * cv.height * 4)
  const faixa = Math.max(1, Math.floor(131072 / cv.width))
  for (let y = 0; y < cv.height; y += faixa) {
    data.set(ctx.getImageData(0, y, cv.width, Math.min(faixa, cv.height - y)).data, y * cv.width * 4)
    yield
  }
  return (u, v, out, o) => {
    const x = Math.min(cv.width - 1, Math.max(0, Math.floor(u * cv.width)))
    const y = Math.min(cv.height - 1, Math.max(0, Math.floor(v * cv.height))) // glTF: flipY desligado
    const i = (y * cv.width + x) * 4
    out[o] = (data[i] ?? 0) / 255
    out[o + 1] = (data[i + 1] ?? 0) / 255
    out[o + 2] = (data[i + 2] ?? 0) / 255
  }
}

/** Partículas sorteadas na pele por passo (cada passo é bem menos que uma fatia). */
const POR_PASSO = 1500

/**
 * Sorteia as partículas na pele e as cores, em passos (#138: a mesma amostragem, com o mesmo aleatório, na mesma ordem
 * por partícula; só não numa tarefa só). Os atributos já existem (zerados) e sobem de novo no fim.
 */
function* sortear(skin: THREE.Mesh, toGlb: THREE.Matrix4, g: THREE.BufferGeometry): Generator<void, void> {
  const sampler = new MeshSurfaceSampler(new THREE.Mesh(skin.geometry)).build()
  yield
  const map = (skin.material as THREE.MeshStandardMaterial).map
  if (!map) throw new Error('pele sem mapa de cor: o furacão não tem de onde tirar as cores')
  const read = yield* lerTexels(map)
  const aPos = g.getAttribute('position') as THREE.BufferAttribute
  const aCol = g.getAttribute('aColor') as THREE.BufferAttribute
  const aSeed = g.getAttribute('aSeed') as THREE.BufferAttribute
  const pos = aPos.array as Float32Array
  const col = aCol.array as Float32Array
  const seed = aSeed.array as Float32Array
  const p = new THREE.Vector3(),
    nrm = new THREE.Vector3(),
    c = new THREE.Color(),
    uv = new THREE.Vector2()
  for (let i = 0; i < COUNT; i++) {
    sampler.sample(p, nrm, c, uv)
    p.applyMatrix4(toGlb)
    pos.set([p.x, p.y, p.z], i * 3)
    read(uv.x, uv.y, col, i * 3)
    seed[i] = Math.random()
    if (i % POR_PASSO === POR_PASSO - 1) yield
  }
  aPos.needsUpdate = true
  aCol.needsUpdate = true
  aSeed.needsUpdate = true
}

interface VortexProps {
  skin: THREE.Mesh
  toGlb: THREE.Matrix4
  fraction: number
  /** As partículas estão sorteadas (a cena só aparece depois). */
  onPronto: () => void
}

/** fraction: parte das partículas desenhada (qualidade adaptativa). A amostragem é aleatória, então o começo do
 * buffer já é uma amostra uniforme da pele: basta encurtar o drawRange, sem refazer a geometria. */
export function Vortex({ skin, toGlb, fraction, onPronto }: VortexProps) {
  const { gl } = useThree()
  const { geometry, material, uSize, uSwirl } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(COUNT), 1))
    g.setDrawRange(0, 0)
    const size = { value: 5 }
    const swirl = { value: 0 }
    const m = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uD: dissolveUniforms.uD, uSwirl: swirl, uSize: size },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geometry: g, material: m, uSize: size, uSwirl: swirl }
  }, [])
  const [sorteado, setSorteado] = useState(false)

  useEffect(() => {
    const t = emFatias(sortear(skin, toGlb, geometry))
    void t.fim.then((fim) => {
      if (fim) setSorteado(true)
    })
    return () => {
      t.cancelar()
    }
  }, [skin, toGlb, geometry])

  useEffect(() => {
    if (!sorteado) return
    geometry.setDrawRange(0, Math.round(COUNT * fraction))
    onPronto()
  }, [geometry, fraction, sorteado, onPronto])

  useFrame((_, dt) => {
    uSize.value = 5 * gl.getPixelRatio()
    // O giro só acumula enquanto há furacão; volta a zero com a cabeça inteira
    // (o caminho de volta é o de ida ao contrário).
    uSwirl.value = dissolveUniforms.uD.value > 0 ? uSwirl.value + dt * 2.2 : 0
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
