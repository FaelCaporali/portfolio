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
