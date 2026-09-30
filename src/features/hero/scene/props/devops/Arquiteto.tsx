/**
 * Vida "Solutions Architect" (devops), FICHA-PRODUCAO.md "FECHAMENTO" (REQUISITOS D1–D16): na frente, a prancheta de
 * arquiteto com a planta azul (glb do estúdio, raiz `devops`); a planta é desenhada no site (folha.ts): o MONÓLITO,
 * riscado e decomposto em serviços; os traços SOBEM da folha (tracos.ts) e viram, no fundo, o DIAGRAMA DE SOLUÇÕES
 * do sistema inteiro (fundo.ts e blocos): ícones oficiais da AWS e das ferramentas, contratos, decisões por tradeoff,
 * entrega (CloudFormation, pipeline blue/green) e produção (tráfego, alarme do CloudWatch, auto scale).
 * Tempo: roteiro.ts; composição por tela: composicao.ts e zonas.ts.
 *
 * A prancheta fica presa à MESA (../ancora.ts, como o notebook do FullStack) e o fundo preso ao mundo; tudo passa pela
 * desintegração. Relógio: o ciclo 0 conta desde a montagem no auge do furacão (montada já parada, começa em
 * TIMING.in); com a pausa segurada o ciclo recomeça com o fundo limpo. Movimento reduzido: estado final parado.
 */
import { useGlb } from '../../carga'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import devopsUrl from '../../../../../../3d/export/props/devops.glb?url'
import { TIMING } from '../../../model/carousel'
import { alvoDoAdereco } from '../../../model/gaze'
import { dissolveUniforms, withDissolve } from '../../dissolve'
import { criarPintor } from '../pintor'
import { criarAncora, type Grupo } from '../ancora'
import { useDisposal } from '../materials'
import { GRUPO_MESA, formato, type Formato } from './composicao'
import { ORIGENS_UV, criarPlanta } from './folha'
import { criarFundo } from './fundo'
import { carregarAtlas } from './icones'
import { medirReferencias } from './referencias'
import { T, criarQuadro, quadroEm, quadroFinal } from './roteiro'
import { criarTracos, parear } from './tracos'
import type { Referencias } from './zonas'

const PRANCHETA = 'arq_prancheta'
const FOLHA = 'arq_folha'
/** O fundo fica no espaço do glb, sem ajuste (a âncora só desfaz o giro da cabeça). */
const FUNDO: Grupo = { escala: 1, desloc: [0, 0, 0] }
/** Com a pausa segurada, o ciclo recomeça este tanto depois do fim (s), se a saída não começou. */
const RECOMECA = 0.3
/** A vida no carrossel (a amostra do texto dela no herói, HeroCopy). */
const VIDA = 'architect'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true

interface Marco {
  x: number
  y: number
  t: number
}

/** O ícone que está surgindo agora no diagrama (o último já revelado no instante t). */
function marcoAtual(marcos: readonly Marco[], t: number) {
  let m: Marco | undefined
  for (const k of marcos) if (k.t <= t && (!m || k.t >= m.t)) m = k
  return m ?? marcos[0]
}

/** Clona a cena (geometrias e texturas seguem do cache do useGLTF) e troca cada material por um com a desintegração. */
function useArquitetoScene() {
  const { scene } = useGlb(devopsUrl)
  const cena = useMemo(() => {
    const raiz = scene.getObjectByName('devops')
    if (!raiz) throw new Error('devops.glb sem a raiz devops')
    const copy = raiz.clone(true)
    const materials: THREE.Material[] = []
    copy.traverse((o) => {
      if (!isMesh(o)) return
      // O pé do tampo e o cavalete somem para o fundo pelo degradê do 2º UV; a folha fica inteira (1).
      const fadeUv1 = o.geometry.hasAttribute('uv1')
      const own = (m: THREE.Material) => {
        const c = withDissolve(m.clone(), { fadeUv1 })
        materials.push(c)
        return c
      }
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material)
    })
    const prancheta = copy.getObjectByName(PRANCHETA) ?? null
    // Ajuste vigente (o mesmo objeto; o componente troca os valores pelo formato da tela).
    const grupo: Grupo = { ...GRUPO_MESA.largo }
    const mesa = criarAncora(copy, [PRANCHETA], prancheta, () => grupo, { nome: 'arq_mesa' })
    mesa.userData.grupo = grupo
    const noFolha = copy.getObjectByName(FOLHA)
    const folha = noFolha && isMesh(noFolha) ? noFolha : null
    const planta = folha ? criarPlanta(folha) : null
    const tracos = criarTracos()
    copy.add(tracos.linhas)

    const fundo = criarFundo()
    copy.add(...fundo.meshes)
    const grupoFundo = criarAncora(
      copy,
      fundo.meshes.map((m) => m.name),
      null,
      () => FUNDO,
      { nome: 'arq_fundo' },
    )
    grupoFundo.userData.estado = fundo.estado

    const q = criarQuadro()
    const v = new THREE.Vector3()
    const w = new THREE.Vector3()
    /**
     * Planta (uma vez) e diagrama em passos (#138), e no fim tudo de uma vez: diagrama, planta e traços, como antes.
     * Cancelado no meio, a planta pintada e não mostrada descarta as texturas.
     */
    function* ajuste(
      camera: THREE.Camera,
      f: Formato,
      ref: Referencias,
      larg: number,
      alt: number,
      img: HTMLImageElement,
      subir: (t: THREE.Texture) => void,
    ): Generator<unknown, void> {
      let daPlanta: { aplicar: () => void; descartar: () => void } | null = null
      let trocar: (() => void) | null = null
      try {
        if (planta) daPlanta = yield* planta.pintar(img, subir)
        trocar = yield* fundo.ajustar(camera, f, ref, img, subir)
      } finally {
        if (!trocar) daPlanta?.descartar()
      }
      trocar()
      if (!planta || !daPlanta) return
      daPlanta.aplicar()
      // Cada traço: de uma caixa da decomposição na planta até um ícone do diagrama (no resize, não por quadro).
      const voos = parear(ORIGENS_UV, fundo.estado.marcos).map(({ origem, destino }) => ({
        de: planta.local(origem[0], origem[1], new THREE.Vector3()),
        para: fundo.pontoNoFundo(destino.x, destino.y, camera, larg, alt, new THREE.Vector3()),
        chega: destino.t,
      }))
      tracos.definir(voos)
    }
    /** Pintura do diagrama em curso (em fatias): um ajuste novo cancela o anterior. */
    const pintor = criarPintor()
    /**
     * Diagrama para a tela (no resize, nunca por quadro); precisa do atlas carregado. O texto que conta é a amostra
     * parada desta vida (HeroCopy): o mesmo nos bastidores e em cena.
     */
    const ajustarFundo = (
      gl: THREE.WebGLRenderer,
      camera: THREE.Camera,
      f: Formato,
      larg: number,
      alt: number,
      img: HTMLImageElement,
    ) =>
      pintor.pedir(`${String(larg)}x${String(alt)}`, () => {
        const ref = medirReferencias(gl.domElement, camera, larg, alt, grupoFundo.matrixWorld, mesa, VIDA)
        if (!ref) return null
        const subir = (t: THREE.Texture) => {
          gl.initTexture(t)
        }
        return ajuste(camera, f, ref, larg, alt, img, subir)
      })
    const precisaFundo = (larg: number, alt: number) => pintor.precisa(`${String(larg)}x${String(alt)}`)
    /**
     * Nos bastidores (Props.tsx, #138): o diagrama, a planta e os traços prontos antes de a vida entrar, como estarão
     * no 1º quadro dela (a mesa já no formato da tela, que em cena o componente ajusta).
     */
    copy.userData.prepararFundo = async (gl: THREE.WebGLRenderer, camera: THREE.Camera, w: number, h: number) => {
      const img = await carregarAtlas()
      await document.fonts.ready
      const f = formato(w, h)
      Object.assign(grupo, GRUPO_MESA[f])
      copy.updateMatrixWorld(true)
      ajustarFundo(gl, camera, f, w, h, img)
      await pintor.pronta()
    }
    const planos = (tempo: number, parar = false) => {
      fundo.atualizar(q, tempo, parar)
      if (!planta) return
      planta.revela.u.uT.value = q.t
      planta.revela.u.uEst.value.set(q.est)
    }
    /** Alvo dos olhos (espaço da raiz, o do frame): a folha, o diagrama se formando, o alarme. */
    const olhar = (camera: THREE.Camera, larg: number, alt: number) => {
      // No diagrama: o ícone que está surgindo agora; no alarme, o CloudWatch.
      const m = q.alvo === 'alarme' ? fundo.estado.alarme : marcoAtual(fundo.estado.marcos, q.t)
      if (q.alvo === 'folha' && folha) copy.worldToLocal(folha.getWorldPosition(v))
      else if (m) {
        fundo.pontoNoFundo(m.x, m.y, camera, larg, alt, w)
        copy.worldToLocal(v.copy(w).applyMatrix4(grupoFundo.matrixWorld))
      }
      alvoDoAdereco.x = v.x
      alvoDoAdereco.y = v.y
      alvoDoAdereco.z = v.z
      alvoDoAdereco.peso = q.olhar
    }
    /** Pose no instante c do ciclo; `tempo` = relógio do tráfego. Nada alocado. */
    const pose = (c: number, tempo: number, camera: THREE.Camera, larg: number, alt: number) => {
      quadroEm(c, q)
      planos(tempo)
      if (folha) tracos.atualizar(c, folha, grupoFundo, copy)
      olhar(camera, larg, alt)
    }
    const parado = () => {
      quadroFinal(q)
      planos(0, true)
      tracos.linhas.visible = false
      alvoDoAdereco.peso = 0
    }
    const dispose = () => {
      pintor.cancelar()
      materials.forEach((m) => m.dispose())
      fundo.dispose()
      planta?.revela.dispose()
      tracos.dispose()
    }
    return { root: copy, grupo, ajustarFundo, precisaFundo, pose, parado, dispose }
  }, [scene])
  useDisposal(cena)
  return cena
}

export function Arquiteto() {
  const { root, grupo, ajustarFundo, precisaFundo, pose, parado } = useArquitetoScene()
  const forma = useThree((s) => formato(s.size.width, s.size.height))
  const [reduced] = useState(prefersReducedMotion)
  const relogio = useRef({ c: 0, t: 0, iniciado: false })
  // Atlas dos ícones (carregado uma vez).
  const atlas = useRef<HTMLImageElement | null>(null)
  const quadros = useRef(0)

  useLayoutEffect(() => {
    // A prancheta no formato da tela (outra tela, outro formato: o diagrama repinta pela tela nova).
    Object.assign(grupo, GRUPO_MESA[forma])
  }, [grupo, forma])

  useEffect(() => {
    let vivo = true
    carregarAtlas()
      .then((img) => {
        if (vivo) atlas.current = img
      })
      .catch(() => {
        // Sem o atlas, o fundo fica vazio; a prancheta continua.
      })
    return () => {
      vivo = false
      // Fora da vida, os olhos voltam ao ponteiro.
      alvoDoAdereco.peso = 0
    }
  }, [])

  useFrame(({ camera, size, gl }, delta) => {
    quadros.current += 1
    const img = atlas.current
    // Pintado nos bastidores, não repinta; aqui só no resize ou com as fontes chegando depois (o 1º quadro desenha
    // a âncora, se a vida não passou pelos bastidores).
    if (img && quadros.current > 1 && precisaFundo(size.width, size.height)) {
      ajustarFundo(gl, camera, formato(size.width, size.height), size.width, size.height, img)
    }
    if (reduced) {
      parado()
      return
    }
    const r = relogio.current
    // Mesmo passo máximo do relógio do carrossel: aba em segundo plano não pula o roteiro.
    const dt = Math.min(delta, 0.1)
    r.t += dt
    if (!r.iniciado) {
      r.iniciado = true
      r.c = dissolveUniforms.uD.value > 0 ? 0 : TIMING.in
    } else r.c += dt
    // Pausa segurada (sem saída): recomeça; na saída, fica no estado final até desintegrar.
    if (r.c >= T.fim + RECOMECA && dissolveUniforms.uD.value === 0) r.c = 0
    pose(Math.min(r.c, T.fim), r.t, camera, size.width, size.height)
  })

  return <primitive object={root} />
}
