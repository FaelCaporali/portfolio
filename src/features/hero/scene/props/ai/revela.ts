/**
 * Material de REVELAÇÃO da vida ai: o da vida devops (../devops/revela.ts, que não se altera) com o FUNDO SOB O TEXTO.
 * O desenho é pintado UMA vez em canvas (Pincel de pincel.ts), no resize; o roteiro só mexe em uniformes. Três
 * texturas: COR (sRGB; metade de cima = estado A, de baixo = estado B), DADOS (R = instante em que o pixel aparece,
 * G = grupo de estado, B = instante do FUNDO sob ele) e FUNDO (a cor só do fundo): enquanto o texto de cima não
 * surgiu, o pixel mostra a janela por baixo (sem buraco). `uBrilho` é o foco da cena (ativa 1, passada em silhueta).
 * Uma chamada por malha; apaga com a desintegração (uD), como o fundo do QA e do techlead.
 */
import * as THREE from 'three'
import { dissolveUniforms } from '../../dissolve'
import { PASSO_T } from '../devops/revela'

const N_GRUPOS = 8
const FADE = 0.14

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const FRAG = /* glsl */ `
uniform sampler2D uCor;
uniform sampler2D uDados;
uniform sampler2D uFundo;
uniform float uT;
uniform float uEst[${N_GRUPOS}];
uniform float uD;
uniform float uBrilho;
varying vec2 vUv;
void main() {
  vec4 d = texture2D(uDados, vUv);
  if (d.a < 0.02) discard;
  float t0 = floor(d.r * 255.0 + 0.5) * ${PASSO_T.toFixed(4)};
  float surge = clamp((uT - t0) / ${FADE.toFixed(2)}, 0.0, 1.0);
  float tb = floor(d.b * 255.0 + 0.5) * ${PASSO_T.toFixed(4)};
  float surgeF = d.b > 0.002 ? clamp((uT - tb) / ${FADE.toFixed(2)}, 0.0, 1.0) : 0.0;
  if (surge <= 0.0 && surgeF <= 0.0) discard;
  int g = int(clamp(floor(d.g * 255.0 / 16.0 + 0.5), 0.0, ${N_GRUPOS - 1}.0));
  vec4 ca = texture2D(uCor, vec2(vUv.x, 0.5 + vUv.y * 0.5));
  vec4 cb = texture2D(uCor, vec2(vUv.x, vUv.y * 0.5));
  vec4 c = mix(ca, cb, uEst[g]);
  c.a *= surge;
  if (surge < 1.0 && surgeF > 0.0) {
    vec4 f = texture2D(uFundo, vUv);
    f.a *= surgeF * (1.0 - surge);
    c = vec4(mix(f.rgb, c.rgb, c.a / max(1e-3, c.a + f.a)), max(c.a, f.a));
  }
  float alfa = c.a * uBrilho * (1.0 - smoothstep(0.0, 0.3, uD));
  if (alfa < 0.004) discard;
  gl_FragColor = vec4(c.rgb, alfa);
  #include <colorspace_fragment>
}`

export interface Revela {
  material: THREE.ShaderMaterial
  u: {
    uT: { value: number }
    uEst: { value: Float32Array }
    uBrilho: { value: number }
  }
  /** Troca as texturas (no resize); as anteriores são liberadas. */
  texturas: (cor: HTMLCanvasElement, dados: HTMLCanvasElement, fundo: HTMLCanvasElement) => void
  dispose: () => void
}

const linear = (cv: HTMLCanvasElement, cor: boolean) => {
  const t = new THREE.CanvasTexture(cv)
  if (cor) t.colorSpace = THREE.SRGBColorSpace
  t.generateMipmaps = false
  t.minFilter = cor ? THREE.LinearFilter : THREE.NearestFilter
  t.magFilter = cor ? THREE.LinearFilter : THREE.NearestFilter
  return t
}

export function criarRevela(nome: string, opcoes: { brilho: number }): Revela {
  const u = {
    uCor: { value: null as THREE.Texture | null },
    uDados: { value: null as THREE.Texture | null },
    uFundo: { value: null as THREE.Texture | null },
    uT: { value: 0 },
    uEst: { value: new Float32Array(N_GRUPOS) },
    uD: dissolveUniforms.uD,
    uBrilho: { value: opcoes.brilho },
  }
  const material = new THREE.ShaderMaterial({
    name: nome,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: u,
    transparent: true,
    depthWrite: false,
  })
  const liberar = () => {
    u.uCor.value?.dispose()
    u.uDados.value?.dispose()
    u.uFundo.value?.dispose()
  }
  const texturas = (cor: HTMLCanvasElement, dados: HTMLCanvasElement, fundo: HTMLCanvasElement) => {
    liberar()
    u.uCor.value = linear(cor, true)
    u.uDados.value = linear(dados, false)
    u.uFundo.value = linear(fundo, true)
  }
  const dispose = () => {
    liberar()
    material.dispose()
  }
  return { material, u, texturas, dispose }
}
