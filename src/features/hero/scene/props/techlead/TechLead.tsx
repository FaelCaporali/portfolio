/**
 * Vida "Tech Lead" (techlead), "Da conversa à cadência" (REQUISITOS T1–T6; FICHA-PRODUCAO.md, FECHAMENTO): na
 * frente, o HEADSET vestível (o diálogo, junto do cliente); no fundo (fundo.ts e blocos), a chamada vira legenda, a
 * legenda vira post-its, os post-its viram mockup e fluxo de uso, o fluxo vira issues no Kanban do Jira que a equipe
 * puxa, e a cadência fecha com sprints, burndown e release; um novo balão recomeça. Tempo: roteiro.ts; zonas por
 * tela: zonas.ts.
 *
 * O headset (glb do estúdio, raiz `techlead` → `tl_headset`) é filho do `frame` e gira com a cabeça, sem âncora; o
 * LED (`tl_led`) acende na escuta; o cabo some com o degradê do pescoço. O fundo fica preso ao mundo (../ancora.ts).
 * Relógio: o ciclo 0 conta desde a montagem no auge do
 * furacão (montada já parada, começa em TIMING.in); com a pausa segurada o ciclo recomeça com o fundo limpo. Tudo
 * apaga com a desintegração. Movimento reduzido: estado final parado.
 */
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import techleadUrl from '../../../../../../3d/export/props/techlead.glb?url'
import { TIMING } from '../../../model/carousel'
import { alvoDoAdereco } from '../../../model/gaze'
import { dissolveUniforms, withDissolve } from '../../dissolve'
import { formato } from '../devops/composicao'
import { criarAncora, type Grupo } from '../ancora'
import { useDisposal } from '../materials'
import { criarFundo } from './fundo'
import { carregarLogos } from './logos'
import { T, criarQuadro, quadroEm, quadroFinal } from './roteiro'
import { medirTela } from './zonas'

/** O fundo fica no espaço do glb, sem ajuste (a âncora só desfaz o giro da cabeça). */
const FUNDO: Grupo = { escala: 1, desloc: [0, 0, 0] }
/** Com a pausa segurada, o ciclo recomeça este tanto depois do fim (s), se a saída não começou. */
const RECOMECA = 0.3

/** O cabo desce pela lateral do pescoço: só ele some com o degradê do pescoço (notas do modelador, LOG v1). */
const CABO = 'tl_cabo'
const LED = 'tl_led'
const MIC = 'tl_mic'
/** Emissão do LED: apagado (fora da escuta) e aceso (na escuta), sobre a do glb. */
const LED_APAGADO = 0.08
const LED_ACESO = 2.2

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true
const dentroDe = (o: THREE.Object3D, nome: string) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.name === nome) return true
  return false
}

/** Clona a cena (geometrias e texturas seguem do cache do useGLTF) e troca cada material por um com a desintegração. */
function useTechLeadScene() {
  const { scene } = useGLTF(techleadUrl, false)
  const cena = useMemo(() => {
    const raiz = scene.getObjectByName('techlead')
    if (!raiz) throw new Error('techlead.glb sem a raiz techlead')
    const root = raiz.clone(true)
    const materials: THREE.Material[] = []
    const leds: THREE.MeshStandardMaterial[] = []
    root.traverse((o) => {
      if (!isMesh(o)) return
      const neckFade = dentroDe(o, CABO)
      const own = (m: THREE.Material) => {
        const c = withDissolve(m.clone(), { neckFade })
        materials.push(c)
        if (dentroDe(o, LED) && c instanceof THREE.MeshStandardMaterial) leds.push(c)
        return c
      }
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material)
    })
    const fundo = criarFundo()
    root.add(...fundo.meshes)
    const grupoFundo = criarAncora(
      root,
      fundo.meshes.map((m) => m.name),
      null,
      () => FUNDO,
      { nome: 'tl_fundo' },
    )
    grupoFundo.userData.estado = fundo.estado
    const q = criarQuadro()
    const v = new THREE.Vector3()
    const mic = root.getObjectByName(MIC) ?? null
    const pMic = new THREE.Vector3()
    // Vértices do headset em repouso (um a cada quatro, sem o cabo, que desce atrás do pescoço), no espaço do glb:
    // projetados no resize, dão a silhueta dele na tela, e as zonas do fundo não ficam atrás dele.
    root.updateMatrixWorld(true)
    const cantos: [number, number, number][] = []
    root.getObjectByName('tl_headset')?.traverse((o) => {
      if (!isMesh(o) || dentroDe(o, CABO)) return
      const n = o.geometry.getAttribute('position').count
      for (let i = 0; i < n; i += 4) {
        o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld)
        cantos.push([v.x, v.y, v.z])
      }
    })

    /** Fundo para a tela (no resize, nunca por quadro); precisa do atlas de logos. */
    const ajustarFundo = (
      canvas: HTMLCanvasElement,
      camera: THREE.Camera,
      w: number,
      h: number,
      img: HTMLImageElement,
    ) => {
      const m = medirTela(canvas, camera, w, h, grupoFundo.matrixWorld, cantos)
      if (m) fundo.ajustar(camera, formato(w, h), m, img)
    }
    /** Alvo dos olhos (espaço da raiz, o do frame): o ponto do fundo da batida atual. */
    const olhar = (camera: THREE.Camera, w: number, h: number) => {
      const p = fundo.estado.alvos[q.alvo]
      if (!p) {
        alvoDoAdereco.peso = 0
        return
      }
      fundo.pontoNoFundo(p.x, p.y, camera, w, h, v)
      root.worldToLocal(v.applyMatrix4(grupoFundo.matrixWorld))
      alvoDoAdereco.x = v.x
      alvoDoAdereco.y = v.y
      alvoDoAdereco.z = v.z
      alvoDoAdereco.peso = q.olhar
    }
    /** Pose no instante c do ciclo; `tempo` = relógio da voz na onda. Nada alocado. */
    /** LED do headset: aceso na escuta, com a voz pulsando de leve. */
    const led = (tempo: number) => {
      const k = LED_APAGADO + (LED_ACESO - LED_APAGADO) * q.led * (0.8 + 0.2 * Math.sin(tempo * 18))
      for (const m of leds) m.emissiveIntensity = k
    }
    /** Microfone na tela (px CSS), para a voz que sai dele na destrava. */
    const micNaTela = (camera: THREE.Camera, w: number, h: number) => {
      if (!mic) return pMic.set(-1, -1, 0)
      mic.getWorldPosition(pMic).project(camera)
      return pMic.set(((pMic.x + 1) / 2) * w, ((1 - pMic.y) / 2) * h, 0)
    }
    const pose = (c: number, tempo: number, camera: THREE.Camera, w: number, h: number) => {
      quadroEm(c, q)
      const p = q.saida > 0 ? micNaTela(camera, w, h) : pMic
      fundo.atualizar(q, tempo, p.x, p.y)
      led(tempo)
      olhar(camera, w, h)
    }
    const parado = () => {
      quadroFinal(q)
      q.fluxo = 0
      q.led = 0
      fundo.atualizar(q, 0, 0, 0)
      led(0)
      alvoDoAdereco.peso = 0
    }
    const dispose = () => {
      materials.forEach((m) => m.dispose())
      fundo.dispose()
    }
    return { root, ajustarFundo, pose, parado, dispose }
  }, [scene])
  useDisposal(cena)
  return cena
}

export function TechLead() {
  const { root, ajustarFundo, pose, parado } = useTechLeadScene()
  const [reduced] = useState(prefersReducedMotion)
  const relogio = useRef({ c: 0, t: 0, iniciado: false })
  const atlas = useRef<HTMLImageElement | null>(null)
  const ajustado = useRef({ w: 0, h: 0, quadros: 0, img: false })
  useEffect(() => {
    let vivo = true
    carregarLogos()
      .then((img) => {
        if (vivo) atlas.current = img
      })
      .catch(() => {
        // Sem o atlas, o fundo fica vazio; o headset continua.
      })
    return () => {
      vivo = false
      // Fora da vida, os olhos voltam ao ponteiro.
      alvoDoAdereco.peso = 0
    }
  }, [])

  useFrame(({ camera, size, gl }, delta) => {
    const a = ajustado.current
    a.quadros += 1
    const img = atlas.current
    // O primeiro quadro desenha a âncora; o 30º repinta com o texto da UI já na fonte final.
    if (img && a.quadros > 1 && (a.w !== size.width || a.h !== size.height || !a.img || a.quadros === 30)) {
      ajustarFundo(gl.domElement, camera, size.width, size.height, img)
      a.w = size.width
      a.h = size.height
      a.img = true
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

useGLTF.preload(techleadUrl, false)
