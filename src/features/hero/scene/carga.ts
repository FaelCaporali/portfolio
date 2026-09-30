/**
 * Carga do 3D do herói (#138, D-138): todos os glb começam a baixar no carregamento da página, em fila por prioridade,
 * no máximo 2 ao mesmo tempo. O busto sai primeiro; as vidas esperam a ordem do carrossel (priorizar, chamado pelo
 * herói assim que a cena monta): a vida inicial e depois as outras na ordem do lineup; a escolhida no indicador passa
 * para a frente. A malha meshopt é decodificada em Web Workers, fora da thread principal.
 */
import { useGLTF } from '@react-three/drei'
import { useSyncExternalStore } from 'react'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import bustoUrl from '../../../../3d/export/s13/busto-s13.glb?url'
import aiUrl from '../../../../3d/export/props/ai.glb?url'
import devopsUrl from '../../../../3d/export/props/devops.glb?url'
import empreendedorUrl from '../../../../3d/export/props/empreendedor.glb?url'
import ledgerUrl from '../../../../3d/export/props/financeiro.glb?url'
import calculadoraUrl from '../../../../3d/export/props/financeiro_direita.glb?url'
import fullstackUrl from '../../../../3d/export/props/fullstack.glb?url'
import qaUrl from '../../../../3d/export/props/qa.glb?url'
import techleadUrl from '../../../../3d/export/props/techlead.glb?url'
import uberUrl from '../../../../3d/export/props/uber.glb?url'
import velaUrl from '../../../../3d/export/props/vela.glb?url'
import type { PropId } from '../../../content/journey'

/** Os glb de cada vida (a financeira tem dois: a mesa e a calculadora). */
const GLB: Record<PropId, readonly string[]> = {
  ai: [aiUrl],
  qa: [qaUrl],
  ledger: [ledgerUrl, calculadoraUrl],
  fullstack: [fullstackUrl],
  rocket: [empreendedorUrl],
  techlead: [techleadUrl],
  sailor: [velaUrl],
  uber: [uberUrl],
  architect: [devopsUrl],
}
export const VIDAS = Object.keys(GLB) as readonly PropId[]

/** Downloads de glb ao mesmo tempo (D-138: "um por um, mas não todos"). */
const SIMULTANEOS = 2

type ExtendLoader = NonNullable<Parameters<typeof useGLTF>[3]>

// O decodificador do three-stdlib (o padrão do drei) decodifica na thread principal; o do three usa workers (blob: e
// wasm, já permitidos pela CSP). Draco fica desligado: o decodificador viria do gstatic, barrado pela CSP.
// (Acesso por índice: o nome começa com `use`, e o lint o tomaria por um gancho do React.)
if (typeof Worker !== 'undefined') MeshoptDecoder['useWorkers'](2)
const comMeshopt: ExtendLoader = (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder)
}

/** O glb do cache do useGLTF, o mesmo da fila. Suspende enquanto carrega. */
export const useGlb = (url: string) => useGLTF(url, false, false, comMeshopt)

/**
 * O useLoader do R3F (por trás do useGLTF) é só o suspend() do suspend-react, sem estado do React: fora de um
 * componente, a leitura devolve o glb pronto ou lança a promessa do carregamento (e a primeira leitura o começa).
 * A fila lê assim para saber quando o glb terminou (baixado e decodificado), sem um segundo cache.
 */
const lerCache = useGLTF
function carregar(url: string): Promise<void> {
  try {
    lerCache(url, false, false, comMeshopt)
    return Promise.resolve()
  } catch (pendente) {
    if (pendente instanceof Promise) return pendente.then(() => carregar(url))
    return Promise.reject(pendente instanceof Error ? pendente : new Error(`glb ${url} não carregou`))
  }
}

interface Carga {
  /** Vidas com todos os glb no cache (baixados e decodificados). */
  baixadas: ReadonlySet<PropId>
  /** Vidas cujo glb falhou: a cena segue sem elas. */
  falhas: ReadonlySet<PropId>
}
let carga: Carga = { baixadas: new Set(), falhas: new Set() }
const ouvintes = new Set<() => void>()
function mudar(vida: PropId, campo: keyof Carga, entra: boolean) {
  const conjunto = new Set(carga[campo])
  if (entra) conjunto.add(vida)
  else conjunto.delete(vida)
  carga = { ...carga, [campo]: conjunto }
  ouvintes.forEach((f) => {
    f()
  })
}

interface Pedido {
  /** null: o busto. */
  vida: PropId | null
  url: string
}
let fila: Pedido[] = []
let emCurso = 0
let ordemConhecida = false
const faltam = new Map(VIDAS.map((v) => [v, GLB[v].length]))

/**
 * Um glb de vida que não termina neste tempo (rede travada, sem erro) libera a vaga da fila e conta como falha — o
 * carrossel pula a vida —, e segue baixando: chegando depois, a vida volta (#138: o carrossel nunca fica preso).
 */
const TEMPO_LIMITE_MS = 20_000
const esperar = (ms: number) =>
  new Promise<'tempo'>((resolve) => {
    setTimeout(() => {
      resolve('tempo')
    }, ms)
  })

function chegou(vida: PropId) {
  const resta = (faltam.get(vida) ?? 1) - 1
  faltam.set(vida, resta)
  if (resta > 0) return
  if (carga.falhas.has(vida)) mudar(vida, 'falhas', false)
  mudar(vida, 'baixadas', true)
}

function bombear() {
  for (let p = fila[0]; p && emCurso < SIMULTANEOS && (p.vida === null || ordemConhecida); p = fila[0]) {
    fila.shift()
    emCurso += 1
    const { vida } = p
    let liberada = false
    const liberar = () => {
      if (liberada) return
      liberada = true
      emCurso -= 1
      bombear()
    }
    const carregando = carregar(p.url)
    void carregando.then(
      () => {
        if (vida) chegou(vida)
        liberar()
      },
      () => {
        if (vida) mudar(vida, 'falhas', true)
        liberar()
      },
    )
    if (vida) {
      void esperar(TEMPO_LIMITE_MS).then(() => {
        if (liberada) return
        mudar(vida, 'falhas', true)
        liberar()
      })
    }
  }
}

/** A ordem do carrossel dita pelo herói (a escolhida no indicador, a atual e as seguintes). */
let ordemVidas: readonly PropId[] = VIDAS
/** Posição da vida na ordem do carrossel (a fila do preparo, preparo.ts, segue a mesma). */
export function posicaoNaOrdem(vida: PropId) {
  const i = ordemVidas.indexOf(vida)
  return i < 0 ? ordemVidas.length : i
}

/** Reordena as vidas que ainda não começaram: as de `ordem` na frente, nessa ordem; as demais depois. */
export function priorizar(ordem: readonly PropId[]) {
  ordemVidas = ordem
  const pos = ({ vida }: Pedido) => {
    if (vida === null) return -1
    const i = ordem.indexOf(vida)
    return i < 0 ? ordem.length : i
  }
  fila = [...fila].sort((a, b) => pos(a) - pos(b))
  ordemConhecida = true
  bombear()
}

/** O estado da carga fora do React (quadro a quadro). */
export const lerCarga = () => carga
const assinar = (f: () => void) => {
  ouvintes.add(f)
  return () => {
    ouvintes.delete(f)
  }
}
/** O estado da carga no React: renderiza de novo quando uma vida termina de baixar. */
export const useCarga = () => useSyncExternalStore(assinar, lerCarga, lerCarga)

// Começa já, ao carregar o módulo da cena: o busto sai sozinho até o herói dizer a ordem das vidas.
if (typeof window !== 'undefined') {
  fila = [{ vida: null, url: bustoUrl }, ...VIDAS.flatMap((vida) => GLB[vida].map((url) => ({ vida, url })))]
  bombear()
}
