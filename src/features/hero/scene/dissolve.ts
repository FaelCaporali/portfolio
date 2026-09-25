import * as THREE from 'three'

/**
 * Desintegração ("desaparatar"). Um único campo escalar n(p) no espaço do glb decide quando cada ponto some:
 * a malha descarta o fragmento quando n < uD, e a partícula nascida naquele ponto parte no mesmo instante.
 * Por isso o furacão sai exatamente de onde a pele se desfaz. uD vai de 0 (inteiro) a DISSOLVE_MAX (só furacão),
 * conduzido pelo relógio do carrossel (model/carousel.ts).
 */

export const dissolveUniforms = {
  uD: { value: 0 },
  /** Mundo → espaço do glb (atualizado por quadro, a cabeça gira com o olhar). */
  uToGlb: { value: new THREE.Matrix4() },
}

export const NOISE_GLSL = /* glsl */ `
float disHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float disNoise3(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(disHash(i), disHash(i + vec3(1,0,0)), f.x), mix(disHash(i + vec3(0,1,0)), disHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(disHash(i + vec3(0,0,1)), disHash(i + vec3(1,0,1)), f.x), mix(disHash(i + vec3(0,1,1)), disHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
// De cima para baixo, com grão: o topo (e os adereços acima da cabeça) some primeiro.
float disField(vec3 p) {
  float h = clamp(1.0 - p.y / 0.34, 0.0, 1.0);
  float g = 0.6 * disNoise3(p * 34.0) + 0.4 * disNoise3(p * 90.0);
  return 0.55 * h + 0.45 * g;
}
`

const EDGE = 'vec3(1.0, 0.86, 0.62)'
const BG_SRGB = 'vec3(0.0431, 0.0431, 0.0549)' // #0b0b0e

/** Pescoço: o corte da malha some num degradê até a cor do fundo (altura no espaço do glb: a posição crua da malha
 * quantizada vem em inteiros normalizados, e a desquantização está na matriz do nó). */
const NECK_FADE = `gl_FragColor.rgb = mix(${BG_SRGB}, gl_FragColor.rgb, smoothstep(0.012, 0.075, vDisPos.y));\n`
/** Borda quente onde a pele está se desfazendo. */
const EDGE_GLOW = `gl_FragColor.rgb = mix(gl_FragColor.rgb, ${EDGE}, (1.0 - smoothstep(uD, uD + 0.035, disN)) * step(0.001, uD));\n`

/** Aplica a desintegração a um material (e, na pele, o degradê que esconde o corte do pescoço). */
export function withDissolve<T extends THREE.Material>(m: T, opts: { neckFade?: boolean } = {}): T {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uD = dissolveUniforms.uD
    sh.uniforms.uToGlb = dissolveUniforms.uToGlb
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uToGlb;\nvarying vec3 vDisPos;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvDisPos = (uToGlb * modelMatrix * vec4(transformed, 1.0)).xyz;',
      )
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uD;\nvarying vec3 vDisPos;\n${NOISE_GLSL}`)
      .replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nfloat disN = disField(vDisPos);\nif (disN < uD) discard;',
      )
      .replace(
        '#include <dithering_fragment>',
        (opts.neckFade ? NECK_FADE : '') + EDGE_GLOW + '#include <dithering_fragment>',
      )
  }
  m.customProgramCacheKey = () => (opts.neckFade ? 'dissolve-neck' : 'dissolve')
  return m
}
