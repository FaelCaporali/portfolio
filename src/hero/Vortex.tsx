import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { NOISE_GLSL, DISSOLVE_MAX, dissolveUniforms } from './dissolve'

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

/** Lê os texels do mapa de cor para colorir cada partícula com a pele do ponto de onde saiu. */
function texelReader(tex: THREE.Texture) {
  const img = tex.image as CanvasImageSource & { width: number; height: number }
  const cv = document.createElement('canvas')
  cv.width = img.width
  cv.height = img.height
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, cv.width, cv.height).data
  return (u: number, v: number, out: number[], o: number) => {
    const x = Math.min(cv.width - 1, Math.max(0, Math.floor(u * cv.width)))
    const y = Math.min(cv.height - 1, Math.max(0, Math.floor(v * cv.height))) // glTF: flipY desligado
    const i = (y * cv.width + x) * 4
    out[o] = (data[i] ?? 0) / 255
    out[o + 1] = (data[i + 1] ?? 0) / 255
    out[o + 2] = (data[i + 2] ?? 0) / 255
  }
}

export function Vortex({ skin }: { skin: THREE.Mesh }) {
  const { gl } = useThree()
  const { geometry, material, uSize, uSwirl } = useMemo(() => {
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(skin.geometry)).build()
    const read = texelReader((skin.material as THREE.MeshStandardMaterial).map!)
    const pos = new Float32Array(COUNT * 3)
    const col: number[] = new Array(COUNT * 3)
    const seed = new Float32Array(COUNT)
    const p = new THREE.Vector3(), nrm = new THREE.Vector3(), c = new THREE.Color(), uv = new THREE.Vector2()
    for (let i = 0; i < COUNT; i++) {
      sampler.sample(p, nrm, c, uv)
      pos.set([p.x, p.y, p.z], i * 3)
      read(uv.x, uv.y, col, i * 3)
      seed[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(col), 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
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
  }, [skin])

  useFrame((_, dt) => {
    uSize.value = 5 * gl.getPixelRatio()
    // O giro só acumula enquanto há furacão; volta a zero com a cabeça inteira (o caminho de volta é o de ida ao contrário).
    uSwirl.value = dissolveUniforms.uD.value > 0 ? uSwirl.value + dt * 2.2 : 0
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
