/**
 * Devolve a vez ao navegador (entre as fatias de um trabalho longo): scheduler.yield, onde existe; senão uma mensagem
 * (MessageChannel), sem o mínimo de 4 ms do setTimeout encadeado.
 */
interface ComYield {
  scheduler?: { yield?: () => Promise<void> }
}

let canal: MessageChannel | null = null
const esperando: (() => void)[] = []

export function pausa(): Promise<void> {
  const s = (globalThis as ComYield).scheduler
  if (typeof s?.yield === 'function') return s.yield()
  return new Promise<void>((resolve) => {
    if (!canal) {
      canal = new MessageChannel()
      canal.port1.onmessage = () => {
        esperando.shift()?.()
      }
    }
    esperando.push(resolve)
    canal.port2.postMessage(null)
  })
}

/**
 * Orçamento de uma fatia (ms): bem abaixo dos 50 ms de uma tarefa longa, com folga para o passo que passa do tempo e
 * para o quadro.
 */
const FATIA_MS = 12

/**
 * Roda os passos de `trabalho` em fatias de até `FATIA_MS`, devolvendo a vez entre elas (também antes da 1ª: quem pede
 * costuma estar num quadro). `cancelar` para no próximo passo (outro ajuste começou, ou a peça saiu de cena) e fecha o
 * gerador (os `finally` dele descartam o que ficou pela metade); `fim` resolve com true se terminou.
 */
export function emFatias(trabalho: Generator<unknown, unknown>) {
  const estado = { cancelado: false }
  const fim = (async () => {
    for (;;) {
      await pausa()
      const t0 = performance.now()
      while (performance.now() - t0 < FATIA_MS) {
        if (estado.cancelado) return false
        const passo = trabalho.next()
        if (passo.done) return true
        // Passo que espera algo fora da thread (a GPU terminar um desenho): a fatia acaba aqui.
        if (passo.value instanceof Promise) {
          await passo.value
          break
        }
      }
    }
  })()
  return {
    fim,
    cancelar: () => {
      if (estado.cancelado) return
      estado.cancelado = true
      trabalho.return(undefined)
    },
  }
}

/** Os passos de um ajuste e, no fim, a troca que ele devolve (tudo aparece de uma vez). */
export function* ateATroca(passos: Generator<unknown, () => void>) {
  const trocar = yield* passos
  trocar()
}
export type Trabalho = ReturnType<typeof emFatias>

/**
 * Promessa que resolve quando o desenho pendente do canvas 2D terminou na GPU (#138): a cópia assíncrona
 * (createImageBitmap) o termina fora da thread; a leitura (getImageData) ou a subida para a GPU (texImage2D) que vem
 * depois não espera mais o desenho. Para passar pela fila de fatias (`yield desenhado(cv)`).
 */
export const desenhado = (cv: CanvasImageSource) =>
  createImageBitmap(cv).then(
    (b) => {
      b.close()
    },
    () => undefined,
  )
