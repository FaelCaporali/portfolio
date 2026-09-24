/**
 * Vidro por transmissão sobre o canvas transparente do herói.
 *
 * O three renderiza a cena opaca numa textura para a refração; com o canvas transparente (clear alpha 0) ele limpa essa
 * textura com branco a 50 %, pré-multiplicado: (0,5; 0,5; 0,5; 0,5) (`WebGLRenderer.renderTransmissionPass` +
 * `ColorBuffer.setClear`). O vidro passa a "refratar" um cinza claro e sai semitransparente: lê como plástico leitoso
 * (prova de material do financeiro v7, 24/09). Aqui a amostra da refração troca esse cinza pelo fundo real da página
 * (#0b0b0e) na proporção exata da cobertura k = 2a − 1 (a = 0,5 vazio, 1 objeto opaco; vale nas mipmaps do fosco, que
 * são médias lineares) e o vidro sai opaco no canvas, com o fundo já composto. Materiais com transmissão devem ter uma
 * face só (a face de trás de um transmissivo duplo é desenhada na mesma textura).
 * Encadeia no `onBeforeCompile` que já existir (aplicar DEPOIS de `withDissolve`).
 */
import * as THREE from 'three'

// O alvo da transmissão é linear e ANTES do tone mapping; o fundo da página (#0b0b0e = linear 0,0033/0,0044) é CSS, sem
// ACES. Este é o valor que o ACESFilmic do three leva a #0b0b0e (inversa da curva RRT/ODT, exposição 1): um vidro que
// transmite 100 % some no fundo; o real (Fresnel, tinta) fica um pouco mais escuro e verde, como vidro de verdade.
const BG_LINEAR = 'vec3(0.0227, 0.0227, 0.0300)'

// Valor negativo aqui explode no ACES (a curva devolve claro para entrada negativa): sempre com max(0).
const FIX = `float cover_ = clamp( 2.0 * transmittedLight.a - 1.0, 0.0, 1.0 );
		transmittedLight.rgb = max( transmittedLight.rgb + ( 1.0 - cover_ ) * ( ${BG_LINEAR} - vec3( 0.5 ) ), 0.0 );
		transmittedLight.a = 1.0;
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;`

const TARGET = 'vec3 attenuatedColor = transmittance * transmittedLight.rgb;'

const isPhysical = (m: THREE.Material): m is THREE.MeshPhysicalMaterial =>
  (m as Partial<THREE.MeshPhysicalMaterial>).isMeshPhysicalMaterial === true

/** Material com transmissão (> 0)? Só esses recebem a correção. */
export const isTransmissive = (m: THREE.Material) => isPhysical(m) && m.transmission > 0

/** Faz a refração do material ver o fundo da página em vez do branco da textura de transmissão. */
export function withTransmissionBackdrop<T extends THREE.Material>(m: T): T {
  if (!isTransmissive(m)) return m
  const previous = m.onBeforeCompile.bind(m)
  const previousKey = m.customProgramCacheKey.bind(m)
  m.onBeforeCompile = (sh, renderer) => {
    previous(sh, renderer)
    const chunk = THREE.ShaderChunk.transmission_pars_fragment
    if (!chunk.includes(TARGET))
      throw new Error('transmission: trecho do three mudou; revisar withTransmissionBackdrop')
    sh.fragmentShader = sh.fragmentShader.replace('#include <transmission_pars_fragment>', chunk.replace(TARGET, FIX))
  }
  m.customProgramCacheKey = () => `${previousKey()}|transmission-backdrop`
  // O vidro sai opaco no canvas e as partículas da desintegração (transparentes, desenhadas depois) não entram na
  // textura de refração: com profundidade gravada, o resto do vidro abria um buraco preto no furacão. Sem ela, as
  // partículas de trás passam por cima do vidro (sem refração, imperceptível em 1 s de troca).
  m.depthWrite = false
  return m
}
