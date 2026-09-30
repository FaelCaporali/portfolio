import { useFrame } from '@react-three/fiber'
import { Activity, useEffect, useRef, useState } from 'react'
import type * as THREE from 'three'
import type { PropId } from '../../../../content/journey'
import { VIDAS, posicaoNaOrdem, useCarga } from '../carga'
import type { Palco } from '../palco'
import { proximaNosBastidores } from '../../model/bastidores'
import { BASTIDOR, fixarProgramas, prepararVida } from '../preparo'
import { Ai } from './ai/Ai'
import { Empreendedor } from './empreendedor/Empreendedor'
import { Arquiteto } from './devops/Arquiteto'
import { Fullstack } from './fullstack/Fullstack'
import { Calculadora } from './ledger/Calculadora'
import { Ledger } from './ledger/Ledger'
import { Qa } from './qa/Qa'
import { TechLead } from './techlead/TechLead'
import { Uber } from './uber/Uber'
import { BastidorContext, type Descartavel } from './materials'
import { Vela } from './vela/Vela'

/**
 * Adereços por vida — BLOCKOUT em primitivas, para aprovar forma, tamanho e posição antes da modelagem no Blender.
 * Coordenadas no espaço do glb do S13 (metros na escala do scan, Y para cima, rosto para +Z), medidas na malha:
 * topo da cabeça y 0,32; olhos y 0,18, z −0,02, x ±0,04; orelhas x ±0,09, y 0,17–0,19, z −0,08 a −0,18;
 * crânio a y 0,22: x ±0,09, z −0,30 a 0,01; boca y 0,10, z 0,02.
 */
function Vida({ id }: { id: PropId }) {
  switch (id) {
    case 'ai':
      return <Ai />
    case 'qa':
      return <Qa />
    case 'ledger':
      return (
        <>
          <Ledger />
          <Calculadora />
        </>
      )
    case 'fullstack':
      return <Fullstack />
    case 'rocket':
      return <Empreendedor />
    case 'techlead':
      return <TechLead />
    case 'sailor':
      return <Vela />
    case 'architect':
      return <Arquiteto />
    case 'uber':
      return <Uber />
  }
}

/** A próxima preparada depois de uma troca espera a entrada da vida nova terminar (1 s): nada é montado na troca. */
const RENOVAR_MS = 1500
/** Depois de uma preparação que falhou, a próxima tentativa (ms). */
const NOVA_TENTATIVA_MS = 2000
/**
 * Quanto o fundo pintado nos bastidores pode segurar a vida (ms): a pausa da 1ª vida (3 s). Esperar mais que uma vida
 * dura, com a cena sem aparecer, é pior que a vida entrar sem o fundo; o atlas e as fontes chegam em menos de 1 s num
 * 4G. Passado o limite, a vida fica pronta sem ele e o fundo pinta quando o atlas chegar (em cena, como antes).
 */
const LIMITE_FUNDO_MS = 3000
const limite = (ms: number) =>
  new Promise<'tempo'>((resolve) => {
    setTimeout(() => {
      resolve('tempo')
    }, ms)
  })

type PrepararFundo = (gl: THREE.WebGLRenderer, camera: THREE.Camera, w: number, h: number) => Promise<void>

/**
 * Prepara a vida nos bastidores: primeiro o fundo que ela pinta (ai, devops, techlead: pronto como estará no 1º quadro
 * dela, e com os mapas que ele põe nos materiais), depois os shaders e as texturas (preparo.ts). false: não ficou
 * pronta.
 */
function prepararTudo(
  gl: THREE.WebGLRenderer,
  g: THREE.Object3D,
  camera: THREE.Camera,
  scene: THREE.Scene,
  size: { width: number; height: number },
  prioridade: () => number,
) {
  const pintar = async () => {
    for (const raiz of [...g.children]) {
      const fundo = raiz.userData.prepararFundo as PrepararFundo | undefined
      if (!fundo) continue
      // Sem o fundo (atlas que não carregou ou demorou), a vida entra como antes sem ele.
      const pintura = fundo(gl, camera, size.width, size.height).catch((e: unknown) => {
        console.error(e)
      })
      await Promise.race([pintura, limite(LIMITE_FUNDO_MS)])
    }
  }
  return prepararVida(gl, g, camera, scene, prioridade, pintar)
}

interface BastidorProps {
  id: PropId
  /** A vida do carrossel agora: aparece (ela está pronta: o relógio só troca para uma vida pronta). */
  atual: boolean
  /**
   * Uma troca acabou de acontecer: a vida espera a entrada da atual terminar (RENOVAR_MS) para montar — nada é montado
   * na troca. Uma vez montada, fica.
   */
  aguardar: boolean
  palco: Palco
  /** A cena já apareceu (o busto): antes dela, nenhuma vida sai dos bastidores. */
  emCena: boolean
}

/**
 * Uma vida nos bastidores (#138): montada escondida (Activity hidden: sem efeitos nem useFrame, como se não existisse),
 * com os shaders compilados em paralelo e as texturas na GPU; só então pode entrar em cena, e entra como se montasse
 * naquele instante (efeitos e relógio começam ali). O grupo da vida atual se chama `prop` (gancho de depuração).
 * Desmontada sem nunca ter aparecido, descarta o que a vida criou (os efeitos dela nunca rodaram).
 */
function Bastidor({ id, atual, aguardar, palco, emCena }: BastidorProps) {
  const grupo = useRef<THREE.Group>(null)
  const preparando = useRef(false)
  const apareceu = useRef(false)
  const montado = useRef(true)
  const [pronta, setPronta] = useState(false)
  const [liberada, setLiberada] = useState(!aguardar)
  if (!liberada && (atual || !aguardar)) setLiberada(true)
  const [descartes] = useState(() => new Set<Descartavel>())
  const visivel = atual && pronta && emCena
  useEffect(() => {
    if (visivel) apareceu.current = true
  }, [visivel])
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      palco.prontas.delete(id)
      // Depois do commit: o modo estrito do React desmonta e remonta na hora (e aí nada se descarta).
      queueMicrotask(() => {
        if (!montado.current && !apareceu.current) for (const d of descartes) d.dispose()
      })
    }
  }, [palco, id, descartes])
  useFrame(({ gl, camera, scene, size }) => {
    const g = grupo.current
    // O React desenha a vida escondida num passo de baixa prioridade: espera ela chegar ao grupo.
    if (pronta || preparando.current || !g || g.children.length === 0) return
    preparando.current = true
    void prepararTudo(gl, g, camera, scene, size, () => posicaoNaOrdem(id)).then((ok) => {
      if (!montado.current) return
      if (!ok) {
        // Não preparou (contexto perdido, falha): tenta de novo mais tarde; até lá o carrossel pula esta vida.
        setTimeout(() => {
          preparando.current = false
        }, NOVA_TENTATIVA_MS)
        return
      }
      setPronta(true)
      palco.prontas.add(id)
      if (palco.marcadas.has(id)) return
      palco.marcadas.add(id)
      // Lida pela sonda da #138: cada vida pronta antes da vez dela.
      performance.mark(`vida-pronta:${id}`)
    })
  })
  return (
    <group ref={grupo} name={visivel ? 'prop' : `bastidor-${id}`} userData={BASTIDOR}>
      <Activity mode={visivel ? 'visible' : 'hidden'}>
        <BastidorContext value={descartes}>{(liberada || atual) && <Vida id={id} />}</BastidorContext>
      </Activity>
    </group>
  )
}

interface PropsProps {
  /** A vida atual. */
  id: PropId
  /**
   * Para onde a troca pode ir, em ordem: a escolhida no indicador (só ela) ou as seguintes do carrossel, sem a atual e
   * sem as que falharam. Dela sai a próxima preparada (model/bastidores.ts).
   */
  candidatas: readonly PropId[]
  palco: Palco
  /** A cena já apareceu (Bust): a vida sai dos bastidores no mesmo commit do busto. */
  emCena: boolean
}

/**
 * Nos bastidores só a vida atual e a próxima (D-138d): no primeiro acesso, a inicial e a seguinte; a cada troca, entra
 * só a nova próxima (depois de RENOVAR_MS). As outras seguem baixando (carga.ts) e montam quando chegar a vez delas de
 * serem a próxima; os programas de shader ficam presos (fixarProgramas), e remontar não recompila. A que sai de cena
 * desmonta (o adereço descarta o que criou, como antes); voltando a ser a próxima, monta uma instância nova.
 */
export function Props({ id, candidatas, palco, emCena }: PropsProps) {
  const { baixadas } = useCarga()
  const [anterior, setAnterior] = useState(id)
  const [visitas, setVisitas] = useState<Partial<Record<PropId, number>>>({})
  // Trocas de vida: quantas houve e até qual a entrada já terminou (RENOVAR_MS depois); diferentes = entrada em curso.
  const [trocas, setTrocas] = useState(0)
  const [assentadas, setAssentadas] = useState(0)
  const [reservada, setReservada] = useState<PropId | null>(null)
  if (anterior !== id) {
    setAnterior(id)
    setVisitas((v) => ({ ...v, [anterior]: (v[anterior] ?? 0) + 1 }))
    setTrocas((n) => n + 1)
  }
  const proxima = proximaNosBastidores(candidatas, baixadas, reservada) ?? null
  if (proxima !== reservada) setReservada(proxima)
  useEffect(() => {
    if (trocas === 0) return
    const t = setTimeout(() => {
      setAssentadas(trocas)
    }, RENOVAR_MS)
    return () => {
      clearTimeout(t)
    }
  }, [trocas])
  useFrame(({ gl }) => {
    fixarProgramas(gl)
  })
  return VIDAS.filter((v) => baixadas.has(v) && (v === id || v === proxima)).map((v) => (
    <Bastidor
      key={`${v}-${String(visitas[v] ?? 0)}`}
      id={v}
      atual={v === id}
      aguardar={trocas !== assentadas}
      palco={palco}
      emCena={emCena}
    />
  ))
}
