import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasAcceleration } from './acceleration'

/** Troca o getContext do canvas (jsdom não implementa WebGL de verdade) para simular cada ambiente. */
function mockWebgl(renderer: string | null) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) => {
    if (!type.startsWith('webgl')) return null
    if (renderer === null) return null
    return {
      getExtension: (name: string) =>
        name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null,
      getParameter: () => renderer,
    }
  }) as typeof HTMLCanvasElement.prototype.getContext)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('hasAcceleration (R1, camada 2)', () => {
  it('sem WebGL (getContext não devolve contexto, jsdom real): false', () => {
    expect(hasAcceleration()).toBe(false)
  })

  it('getContext devolve null (ambiente sem WebGL algum): false', () => {
    mockWebgl(null)
    expect(hasAcceleration()).toBe(false)
  })

  it('renderizador de software (SwiftShader, caso do estúdio 3D e do Chromium headless): false', () => {
    mockWebgl('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)')
    expect(hasAcceleration()).toBe(false)
  })

  it('renderizador LLVMpipe/Mesa software (Linux sem driver de GPU): false', () => {
    mockWebgl('llvmpipe (LLVM 15.0.6, 256 bits)')
    expect(hasAcceleration()).toBe(false)
  })

  it('GPU real, sem indício de software: true', () => {
    mockWebgl('ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)')
    expect(hasAcceleration()).toBe(true)
  })
})
