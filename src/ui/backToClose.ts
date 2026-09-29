/**
 * Botão voltar com um painel aberto (contato, menu do mapa; J85): 1) fecha o teclado virtual, 2) fecha o painel,
 * 3) só então navega. Ao abrir, o painel ganha uma entrada no histórico (mesmo endereço) que o voltar consome.
 * Fechar por outro meio (Esc, toque fora, enviar) tira essa entrada, para o voltar seguinte navegar; escolher um item
 * que leva a outro ponto da página troca essa entrada pela do destino.
 */
export function backToClose(close: () => void) {
  let armed = false
  let skip = false

  const onPop = () => {
    if (skip) {
      skip = false
      return
    }
    if (!armed) return
    if (keyboardOpen()) {
      // O voltar fecha o teclado (tira o foco do campo) e o painel continua aberto, com a entrada de volta.
      ;(document.activeElement as HTMLElement).blur()
      history.pushState(history.state, '')
      return
    }
    armed = false
    close()
  }
  window.addEventListener('popstate', onPop)

  return {
    opened() {
      if (armed) return
      armed = true
      history.pushState(history.state, '')
    },
    /** O painel fechou por outro meio (Esc, toque fora, enviar): a entrada dele sai do histórico. */
    closed() {
      if (!armed) return
      armed = false
      skip = true
      history.back()
    },
    /**
     * O painel fechou indo a `url` na mesma página (um marco do índice): a entrada dele vira a do destino. Voltar no
     * histórico e só então navegar não serve: o navegador restaura a rolagem depois do `popstate`, por cima da ida.
     */
    closedTo(url: string) {
      if (armed) history.replaceState(history.state, '', url)
      else history.pushState(history.state, '', url)
      armed = false
    },
    dispose() {
      window.removeEventListener('popstate', onPop)
    },
  }
}

/**
 * Teclado virtual aberto: um campo de texto com foco e a área visível encolhida. No Android o próprio sistema fecha o
 * teclado no primeiro voltar sem tirar o foco do campo; por isso o foco sozinho não basta.
 */
function keyboardOpen() {
  const el = document.activeElement
  const typing = el instanceof HTMLElement && el.matches('input, textarea, select, [contenteditable="true"]')
  const vv = window.visualViewport
  return typing && !!vv && vv.height < window.innerHeight - 120
}
