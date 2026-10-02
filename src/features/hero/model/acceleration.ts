/**
 * Sonda real de aceleração de GPU (R1, camada 2 de 03-plano-versao-robos.md §2): o Googlebot não suporta WebGL
 * (01-google-renderizacao.md) e uma pessoa real sem GPU (VM, hardware antigo) cai no mesmo estado já testado de
 * queda da cena (SceneBoundary.tsx). `failIfMajorPerformanceCaveat` recusa o contexto quando o navegador cairia para
 * software; mas em alguns ambientes (Chromium com `--use-gl=swiftshader`, usado pelo próprio estúdio 3D) o contexto
 * ainda é concedido — por isso a segunda checagem, pelo nome do renderizador em WEBGL_debug_renderer_info.
 */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software/i

/** Sem WebGL de verdade, ou com um renderizador de software: `false` (a cena 3D não entra). */
export function hasAcceleration(): boolean {
  const canvas = document.createElement('canvas')
  let gl: WebGL2RenderingContext | null = null
  try {
    gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true })
    if (!gl) return false
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    return !SOFTWARE_RENDERER.test(renderer)
  } catch {
    return false
  } finally {
    // A sonda é descartável: libera o contexto assim que lê o renderizador, em todo caminho em que foi criado.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
