/** Copia texto para a área de transferência (exige HTTPS ou localhost). false = navegador recusou. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
