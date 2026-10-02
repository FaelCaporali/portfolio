/**
 * Quem pinta o fundo de uma vida (ai, devops, techlead; #138): uma pintura por vez, em fatias, e nenhuma cancela a
 * que está em curso — um pedido novo espera a atual acabar (fica só o último pedido). Lembra para que tela pintou e se
 * as fontes já estavam carregadas: repinta só se a tela mudou ou se as fontes chegaram depois.
 */
import { emFatias, type Trabalho } from '../pausa'

export type Pedido = () => Generator<unknown, unknown> | null

export function criarPintor() {
  let trabalho: Trabalho | null = null
  let espera: { chave: string; pedido: Pedido } | null = null
  let pintada: string | null = null
  let comFontes = false

  const rodar = (chave: string, pedido: Pedido) => {
    const passos = pedido()
    if (!passos) return false
    pintada = chave
    comFontes = document.fonts.status === 'loaded'
    const t = emFatias(passos)
    trabalho = t
    // Pintura que falha (erro no desenho) não prende o pintor: o erro vai para o console e o próximo pedido corre.
    const acabou = t.fim.catch((e: unknown) => {
      console.error(e)
    })
    void acabou.then(() => {
      if (trabalho !== t) return
      trabalho = null
      const seguinte = espera
      espera = null
      if (seguinte) rodar(seguinte.chave, seguinte.pedido)
    })
    return true
  }

  return {
    /** Precisa pintar para a tela `chave` (a pintada ou pedida é outra, ou as fontes chegaram depois dela). */
    precisa(chave: string) {
      const alvo = espera?.chave ?? pintada
      return alvo !== chave || (!comFontes && !espera && document.fonts.status === 'loaded')
    },
    /** Pinta já ou, com uma pintura em curso, logo depois dela. false: `pedido` não pôde medir a tela. */
    pedir(chave: string, pedido: Pedido) {
      if (trabalho) {
        espera = { chave, pedido }
        return true
      }
      return rodar(chave, pedido)
    },
    /** Resolve quando não há pintura em curso nem pedida. */
    async pronta() {
      while (trabalho) await trabalho.fim.catch(() => undefined)
    },
    cancelar() {
      espera = null
      trabalho?.cancelar()
      trabalho = null
    },
  }
}
