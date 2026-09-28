/**
 * Material de REVELAÇÃO da vida devops (FICHA-PRODUCAO, FECHAMENTO): o desenho inteiro (diagrama no fundo e planta na
 * folha) é pintado UMA vez em canvas (pincel.ts), no resize, e o roteiro só mexe em uniformes — nada é redesenhado nem
 * reenviado por quadro. Duas texturas:
 * - COR (sRGB), com duas metades: em cima o estado A de cada elemento, embaixo o estado B (alarme OK × ALARM, target
 *   group blue × green, alternativa normal × descartada, deploy rodando × verde);
 * - DADOS (linear, sem filtro), por pixel: R = instante em que o pixel aparece (1/40 s, até 6,4 s: cobre a pausa de 5 s
 *   e a saída em 6,0; é assim que o texto se digita
 *   e o traço se desenha), G = grupo de estado (0–7, uEst escolhe a metade), B = posição ao longo da seta (2 px por
 *   unidade; o tráfego corre por ela quando uFluxo > 0).
 * Uma chamada por malha. Desintegração: no fundo, apaga com uD (como o fundo do QA); na folha, o mesmo campo do busto
 * (dissolve.ts) no espaço do glb, para as linhas sumirem junto com o papel.
 */
import * as THREE from 'three'
import { NOISE_GLSL, dissolveUniforms } from '../../dissolve'

/** Grupos de estado (G): cada um com o seu uEst. */
export const GRUPO = {
  fixo: 0,
  alarme: 1,
  blueGreen: 2,
  decisao: 3,
  deploy: 4,
  monolito: 5,
} as const
const N_GRUPOS = 8
/** Resolução do instante no canal R (s por unidade) e o que um pixel leva para acender. */
export const PASSO_T = 1 / 40
const FADE = 0.14

const VERT = /* glsl */ `
uniform mat4 uToGlb;
varying vec2 vUv;
varying vec3 vDisPos;
void main() {
  vUv = uv;
  vDisPos = (uToGlb * modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const FRAG = /* glsl */ `
uniform sampler2D uCor;
uniform sampler2D uDados;
uniform float uT;
uniform float uEst[${N_GRUPOS}];
uniform float uFluxo;
uniform float uTempo;
uniform vec3 uCorFluxo;
uniform float uD;
uniform float uBrilho;
uniform float uCampo;
varying vec2 vUv;
varying vec3 vDisPos;
${NOISE_GLSL}
void main() {
  vec4 d = texture2D(uDados, vUv);
  if (d.a < 0.02) discard;
  float t0 = floor(d.r * 255.0 + 0.5) * ${PASSO_T.toFixed(4)};
  float surge = clamp((uT - t0) / ${FADE.toFixed(2)}, 0.0, 1.0);
  if (surge <= 0.0) discard;
  int g = int(clamp(floor(d.g * 255.0 / 16.0 + 0.5), 0.0, ${N_GRUPOS - 1}.0));
  float e = uEst[g];
  vec4 ca = texture2D(uCor, vec2(vUv.x, 0.5 + vUv.y * 0.5));
  vec4 cb = texture2D(uCor, vec2(vUv.x, vUv.y * 0.5));
  vec4 c = mix(ca, cb, e);
  // Tráfego: traços curtos correndo pela seta (período de 24 px), na cor do acento da vida.
  float f = floor(d.b * 255.0 + 0.5);
  if (f > 0.5 && uFluxo > 0.0) {
    float fase = fract((f - uTempo * 30.0) / 12.0);
    float pulso = (1.0 - smoothstep(0.0, 0.3, fase)) * uFluxo;
    c.rgb = mix(c.rgb, uCorFluxo, pulso);
    c.a = max(c.a, pulso * d.a);
  }
  float some = uCampo > 0.5 ? step(uD, disField(vDisPos)) : 1.0 - smoothstep(0.0, 0.3, uD);
  float alfa = c.a * surge * uBrilho * some;
  if (alfa < 0.004) discard;
  gl_FragColor = vec4(c.rgb, alfa);
  #include <colorspace_fragment>
}`

export interface Revela {
  material: THREE.ShaderMaterial
  u: {
    uT: { value: number }
    uEst: { value: Float32Array }
    uFluxo: { value: number }
    uTempo: { value: number }
    uBrilho: { value: number }
  }
  /** Troca as texturas (no resize); as anteriores são liberadas. */
  texturas: (cor: HTMLCanvasElement, dados: HTMLCanvasElement) => void
  dispose: () => void
}

/** `campo`: desintegra pelo campo do busto (folha) em vez de apagar por inteiro (fundo). */
export function criarRevela(nome: string, opcoes: { campo: boolean; brilho: number; corFluxo: string }): Revela {
  const u = {
    uCor: { value: null as THREE.Texture | null },
    uDados: { value: null as THREE.Texture | null },
    uT: { value: 0 },
    uEst: { value: new Float32Array(N_GRUPOS) },
    uFluxo: { value: 0 },
    uTempo: { value: 0 },
    uCorFluxo: { value: new THREE.Color(opcoes.corFluxo) },
    uD: dissolveUniforms.uD,
    uToGlb: dissolveUniforms.uToGlb,
    uBrilho: { value: opcoes.brilho },
    uCampo: { value: opcoes.campo ? 1 : 0 },
  }
  const material = new THREE.ShaderMaterial({
    name: nome,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: u,
    transparent: true,
    depthWrite: false,
  })
  const texturas = (cor: HTMLCanvasElement, dados: HTMLCanvasElement) => {
    u.uCor.value?.dispose()
    u.uDados.value?.dispose()
    const tc = new THREE.CanvasTexture(cor)
    tc.colorSpace = THREE.SRGBColorSpace
    tc.generateMipmaps = false
    tc.minFilter = THREE.LinearFilter
    tc.magFilter = THREE.LinearFilter
    const td = new THREE.CanvasTexture(dados)
    td.generateMipmaps = false
    td.minFilter = THREE.NearestFilter
    td.magFilter = THREE.NearestFilter
    u.uCor.value = tc
    u.uDados.value = td
  }
  const dispose = () => {
    u.uCor.value?.dispose()
    u.uDados.value?.dispose()
    material.dispose()
  }
  return { material, u, texturas, dispose }
}
