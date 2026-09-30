import { Component, type ErrorInfo, type ReactNode } from 'react'

/** A rejeição solta do renderer que não nasceu (three: "Error creating WebGL context", "WebGL 1 is not supported"). */
const isWebGLFailure = (reason: unknown) => reason instanceof Error && reason.message.includes('WebGL')

/**
 * A fronteira de erro da cena 3D do herói (C1): se o pedaço do canvas falha, some só ele, e o texto, o indicador, o
 * link do código e o contato ficam; sem erro, nada muda. `onFail` avisa o herói (sem cena, o indicador troca o texto).
 *
 * Cobre: o import da cena que falha (o `lazy` lança no render) e erro de render ou de commit dentro do <Canvas> (o R3F
 * 9 pega o erro na fronteira dele, guarda no estado do <Canvas> e o relança no render do <Canvas>, na árvore do React
 * da página: chega aqui). O contexto WebGL que não nasce não chega por esse caminho: o R3F cria o renderer numa função
 * assíncrona que ninguém espera (a promessa rejeita solta); por isso, enquanto a cena está montada, a rejeição solta
 * que fala de WebGL também derruba a cena.
 */
export class SceneBoundary extends Component<{ children: ReactNode; onFail?: () => void }, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Hero: a cena 3D falhou e saiu da página; o resto segue.', error, info.componentStack)
    this.props.onFail?.()
  }

  override componentDidMount() {
    window.addEventListener('unhandledrejection', this.onRejection)
  }

  override componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.onRejection)
  }

  private readonly onRejection = (event: PromiseRejectionEvent) => {
    if (this.state.failed || !isWebGLFailure(event.reason)) return
    // O erro já vai para o console aqui, uma vez, sem o "Uncaught (in promise)" do navegador.
    event.preventDefault()
    console.error('Hero: o WebGL não nasceu; a cena 3D saiu da página e o resto segue.', event.reason)
    this.setState({ failed: true })
    this.props.onFail?.()
  }

  override render() {
    return this.state.failed ? null : this.props.children
  }
}
