/**
 * Shaders do movimento do financeiro v7, ENCADEADOS no `onBeforeCompile` que o material já tem (withDissolve e o fundo
 * de transmissão): nunca o substituem.
 *  - Painel: por célula / caractere, cruza do atlas VAZIO (sem preenchimento, números, texto, cursor e moldura) para o
 *    atlas CHEIO do glb, e desenha a moldura verde da célula ativa que anda e o cursor de texto durante a digitação.
 *  - Linha: revela por altura local (vLocalY, que o withDissolve já passa), subindo monotonicamente.
 */
import * as THREE from 'three'
import { CARET, CELLS, FRAME_UV, HANDLE, TEXT } from './layout'

const v4 = (r: readonly number[]) => new THREE.Vector4(r[0], r[1], r[2], r[3])

export function sheetUniforms(empty: THREE.Texture) {
  return {
    uEmpty: { value: empty },
    uCells: { value: CELLS.map(v4) },
    /** Células cheias (0..12). */
    uFilled: { value: 12 },
    /** Retângulo da célula ativa desenhada no shader; largura 0 = nenhuma (a do atlas cheio vale). */
    uActive: { value: new THREE.Vector4() },
    /** u até onde a fórmula já foi digitada. */
    uTextU: { value: TEXT[2] },
    /** u do cursor de texto desenhado; < 0 = sem cursor desenhado. */
    uCaretU: { value: -1 },
    /** Cursor do atlas cheio (fim da fórmula) visível. */
    uCaretDone: { value: 1 },
  }
}
export type SheetUniforms = ReturnType<typeof sheetUniforms>

const f = (x: number) => x.toFixed(5)
const vec4 = (r: readonly number[]) => `vec4(${r.map(f).join(', ')})`

// Verde da célula ativa (#3fae6e) e tinta da fórmula (L ≈ 20 %), em linear (o mapa já chega decodificado).
const SHEET_FRAGMENT = /* glsl */ `
#ifdef USE_MAP
  vec2 finL = vec2(vMapUv.x, 1.0 - vMapUv.y);
  float finK = 0.0;
  for (int i = 0; i < 12; i++) {
    // Meio filete de folga; C4 (a ativa final) leva a moldura e a alça do atlas cheio, que passam da borda.
    float e = i == 11 ? 0.006 : 0.0015;
    vec4 r = uCells[i] + vec4(-e, -e, e, e);
    if (float(i) < uFilled && finIn(finL, r)) finK = 1.0;
  }
  if (finIn(finL, vec4(${f(TEXT[0] - 0.004)}, ${f(TEXT[1] - 0.006)}, uTextU, ${f(TEXT[3] + 0.006)}))) finK = 1.0;
  if (uCaretDone > 0.5 && finIn(finL, ${vec4([CARET[0] - 0.003, CARET[1] - 0.003, CARET[2] + 0.003, CARET[3] + 0.003])})) finK = 1.0;
  vec4 sampledDiffuseColor = mix(texture2D(uEmpty, vMapUv), texture2D(map, vMapUv), finK);
  if (uActive.z > uActive.x) {
    vec2 w = vec2(${f(FRAME_UV[0])}, ${f(FRAME_UV[1])});
    vec4 outer = uActive + vec4(-w * 0.5, w * 0.5);
    vec4 inner = uActive + vec4(w * 0.5, -w * 0.5);
    vec2 hs = vec2(${f(HANDLE[2] - HANDLE[0])}, ${f(HANDLE[3] - HANDLE[1])});
    bool handle = finIn(finL, vec4(uActive.z - hs.x * 0.5, uActive.y - hs.y * 0.5, uActive.z + hs.x * 0.5, uActive.y + hs.y * 0.5));
    if ((finIn(finL, outer) && !finIn(finL, inner)) || handle) sampledDiffuseColor = vec4(0.0497, 0.4233, 0.1559, 1.0);
  }
  if (uCaretU >= 0.0 && finIn(finL, vec4(uCaretU, ${f(CARET[1])}, uCaretU + ${f(CARET[2] - CARET[0])}, ${f(CARET[3])})))
    sampledDiffuseColor = vec4(0.033, 0.033, 0.033, 1.0);
  diffuseColor *= sampledDiffuseColor;
#endif
`

/** Painel: cruza vazio → cheio por célula e caractere; moldura verde e cursor de texto desenhados. */
export function withSheetReveal<T extends THREE.Material>(m: T, u: SheetUniforms): T {
  const previous = m.onBeforeCompile.bind(m)
  const key = m.customProgramCacheKey.bind(m)
  m.onBeforeCompile = (sh, renderer) => {
    previous(sh, renderer)
    Object.assign(sh.uniforms, u)
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uEmpty; uniform vec4 uCells[12]; uniform float uFilled; uniform vec4 uActive;
uniform float uTextU; uniform float uCaretU; uniform float uCaretDone;
bool finIn(vec2 p, vec4 r) { return p.x >= r.x && p.y >= r.y && p.x <= r.z && p.y <= r.w; }`,
      )
      .replace('#include <map_fragment>', SHEET_FRAGMENT)
  }
  m.customProgramCacheKey = () => `${key()}-fin-sheet`
  return m
}

/** Linha: descarta o que está acima de `uLineY` (altura local da malha; sobe de baixo até o pé do mastro). */
export function withHeightReveal<T extends THREE.Material>(m: T, uLineY: { value: number }): T {
  const previous = m.onBeforeCompile.bind(m)
  const key = m.customProgramCacheKey.bind(m)
  m.onBeforeCompile = (sh, renderer) => {
    previous(sh, renderer)
    sh.uniforms.uLineY = uLineY
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLineY;')
      .replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif (vLocalY > uLineY) discard;',
      )
  }
  m.customProgramCacheKey = () => `${key()}-fin-line`
  return m
}
