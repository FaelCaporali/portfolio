/**
 * Laboratório do estúdio 3D (só no servidor de desenvolvimento): `?lab=<caminho do glb>` mostra aquele glb no lugar do
 * adereço da vida, no enquadramento real. O glb vem no espaço do busto (metros na escala do scan, Y para cima, rosto
 * para +Z), com a posição já aplicada na receita do Blender. Caminho relativo à raiz do projeto, que o Vite serve
 * (ex.: `?lab=3d/export/props/lab/financeiro_v7_blockout.glb`).
 */
export function readLabUrl(search: string): string | null {
  const raw = new URLSearchParams(search).get('lab')?.trim()
  if (!raw?.toLowerCase().endsWith('.glb')) return null
  // Só caminho do próprio servidor: nada de URL externa nem subida de diretório.
  if (/^[a-z]+:|^\/\/|\.\./i.test(raw)) return null
  return raw.startsWith('/') ? raw : `/${raw}`
}

export interface LabRequest {
  url: string
  /** `&solo=1`: esconde o adereço da vida e mostra só o glb (peça que vai SUBSTITUIR o adereço). Sem ele, soma. */
  solo: boolean
}

/** Pedido completo do laboratório; null sem `?lab=` válido (`solo` sozinho não faz nada). */
export function readLab(search: string): LabRequest | null {
  const url = readLabUrl(search)
  if (!url) return null
  const solo = new URLSearchParams(search).get('solo')?.trim().toLowerCase()
  return { url, solo: solo === '1' || solo === 'true' }
}
