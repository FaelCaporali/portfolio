/**
 * Vida "AI Product Engineer" (ai), "O que ele decide de dia protege o cliente à noite" (REQUISITOS I8–I11; FICHA §4):
 * uma história em cinco cenas — às 18:40 ele revisa o harness que o agente de código escreveu e troca o limiar do
 * guardrail de 0.6 para 0.8; o deploy leva o caso até o robô da mesa, que se monta e liga o rosto; às 02:14 uma cliente
 * escreve no chat do produto e o trace da resposta aparece sob o balão; a confiança baixa bate no guardrail(0.8) — o
 * mesmo número dele — e o caso passa pelo n8n até o operador, que decide; às 09:02 o caso volta à IDE como teste. O
 * fio de luz desenha o 8 nessa ordem, cruzando por trás da cabeça. Tempo: roteiro.ts; janelas: fundo.ts; robô: robo.ts.
 *
 * O robô fica preso à mesa e o fundo ao mundo (../ancora.ts). Relógio: o ciclo 0 conta desde a montagem no auge do
 * furacão (montada já parada, começa em TIMING.in); com a pausa segurada o ciclo recomeça. Tudo desintegra com o busto.
 * Movimento reduzido: estado final parado (o 8 completo, as decisões aprovadas, o robô montado e comemorando).
 */
import { useGlb } from '../../carga'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import aiUrl from '../../../../../../3d/export/props/ai.glb?url'
import { TIMING } from '../../../model/carousel'
import { alvoDoAdereco } from '../../../model/gaze'
import { dissolveUniforms, withDissolve } from '../../dissolve'
import { ateATroca } from '../../pausa'
import { criarPintor } from '../pintor'
import { useOwnEnvIntensity, withOwnEnv } from '../../envIntensity'
import { formato } from '../devops/composicao'
import { criarAncora, type Grupo } from '../ancora'
import { useDisposal } from '../materials'
import { criarFundo } from './fundo'
import { carregarLogos } from './logos'
import { GRUPO_ROBO, prepararRobo } from './robo'
import { criarRosto } from './rosto'
import { T, criarQuadro, quadroEm, quadroFinal } from './roteiro'
import { medirTela, verticesCabeca } from './zonas'

/** O fundo fica no espaço do glb, sem ajuste (a âncora só desfaz o giro da cabeça). */
const FUNDO: Grupo = { escala: 1, desloc: [0, 0, 0] }
/** Com a pausa segurada, o ciclo recomeça este tanto depois do fim (s), se a saída não começou. */
const RECOMECA = 0.3
const TELA = 'ai_tela'
/** A vida no carrossel (a amostra do texto dela no herói, HeroCopy). */
const VIDA = 'ai'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true
const dentroDe = (o: THREE.Object3D, nome: string) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.name === nome) return true
  return false
}
function acharFrame(o: THREE.Object3D) {
  for (let p: THREE.Object3D | null = o.parent; p; p = p.parent) if (p.name === 'frame') return p
  return null
}

/** Clona a cena do glb, troca os materiais (desintegração; a tela vira o rosto) e monta fundo, mesa e robô. */
function useAiScene() {
  const { scene } = useGlb(aiUrl)
  const cena = useMemo(() => {
    const raiz = scene.getObjectByName('ai')
    if (!raiz) throw new Error('ai.glb sem a raiz ai')
    const root = raiz.clone(true)
    const rosto = criarRosto()
    const materials: THREE.Material[] = []
    root.traverse((o) => {
      if (!isMesh(o)) return
      if (dentroDe(o, TELA)) {
        const m = withDissolve(new THREE.MeshBasicMaterial({ map: rosto.textura, color: 0xe6e6e6 }))
        materials.push(m)
        o.material = m
        return
      }
      // A base some para o fundo abaixo da mesa pelo degradê do 2º UV; acima da mesa fica em 1.
      const fadeUv1 = o.geometry.hasAttribute('uv1')
      const own = (m: THREE.Material) => {
        const c = withDissolve(m.clone(), { fadeUv1 })
        materials.push(c)
        return c
      }
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material)
    })
    const robo = prepararRobo(root)
    // Até a cena 2 o robô não existe: as peças só aparecem na vez delas.
    robo.montar(0)
    const grupo: Grupo = { ...GRUPO_ROBO.largo }
    const pivo = robo.robo?.position.clone() ?? new THREE.Vector3()
    const mesa = criarAncora(root, ['ai_robo'], robo.robo, () => grupo, { nome: 'ai_mesa' })
    const fundo = criarFundo()
    root.add(...fundo.meshes)
    const grupoFundo = criarAncora(
      root,
      fundo.meshes.map((m) => m.name),
      null,
      () => FUNDO,
      { nome: 'ai_fundo' },
    )
    grupoFundo.userData.estado = fundo.estado
    const q = criarQuadro()
    const v = new THREE.Vector3()
    const mira: [number, number] = [0, 0]
    let cabeca: Float32Array | null = null

    /** Pinta o fundo (em fatias, uma pintura por vez; #138). */
    const pintor = criarPintor()
    /**
     * Fundo e mesa para a tela (no resize, nunca por quadro); precisa do atlas e da silhueta da cabeça. O texto que
     * conta é a amostra parada desta vida (HeroCopy): o mesmo nos bastidores e em cena.
     */
    const ajustarFundo = (gl: THREE.WebGLRenderer, camera: THREE.Camera, w: number, h: number, img: HTMLImageElement) =>
      pintor.pedir(`${String(w)}x${String(h)}`, () => {
        const frame = acharFrame(root)
        const bust = frame?.getObjectByName('bust')
        if (!frame || !bust) return null
        const f = formato(w, h)
        Object.assign(grupo, GRUPO_ROBO[f])
        root.updateMatrixWorld(true)
        cabeca ??= verticesCabeca(bust, frame)
        const r = { cantos: robo.cantos, base: robo.base, mundo: mesa.matrixWorld }
        const m = medirTela(gl.domElement, camera, w, h, grupoFundo.matrixWorld, cabeca, r, VIDA)
        if (!m) return null
        return ateATroca(
          fundo.ajustar(camera, f, m, img, (t) => {
            gl.initTexture(t)
          }),
        )
      })
    const precisaFundo = (w: number, h: number) => pintor.precisa(`${String(w)}x${String(h)}`)
    /** Nos bastidores (Props.tsx, #138): o fundo pronto antes de a vida entrar, como estará no 1º quadro dela. */
    root.userData.prepararFundo = async (gl: THREE.WebGLRenderer, camera: THREE.Camera, w: number, h: number) => {
      const img = await carregarLogos()
      await document.fonts.ready
      ajustarFundo(gl, camera, w, h, img)
      await pintor.pronta()
    }
    /** Olhos do Fael (espaço da raiz): o ponto do fundo da cena atual. */
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
    /** Cabeça do robô: câmera, Fael (handoff) ou a janela da cena ativa. */
    const servos = (camera: THREE.Camera, w: number, h: number, k: number) => {
      const alvo = q.mira === 'chat' || q.mira === 'humano' ? fundo.estado.alvos[q.mira] : null
      if (alvo) robo.servos(robo.mirar(fundo.pontoNoFundo(alvo.x, alvo.y, camera, w, h, v), grupo, pivo, mira), k)
      else robo.servos(q.mira === 'fael' ? robo.fael : robo.camera, k)
    }
    /** Pose no instante c do ciclo; `tempo` anima o rosto. Nada alocado. */
    const pose = (c: number, tempo: number, dt: number, camera: THREE.Camera, w: number, h: number) => {
      quadroEm(c, q)
      fundo.atualizar(q, false)
      robo.montar(q.montagem)
      rosto.desenhar(q.rosto, tempo)
      servos(camera, w, h, Math.min(1, dt * 7))
      olhar(camera, w, h)
    }
    const parado = (camera: THREE.Camera, w: number, h: number) => {
      quadroFinal(q)
      fundo.atualizar(q, true)
      robo.montar(1)
      rosto.desenhar(q.rosto, 0)
      servos(camera, w, h, 1)
      alvoDoAdereco.peso = 0
    }
    const dispose = () => {
      pintor.cancelar()
      materials.forEach((m) => m.dispose())
      rosto.dispose()
      fundo.dispose()
    }
    return { root, materials, ajustarFundo, precisaFundo, pose, parado, dispose }
  }, [scene])
  useDisposal(cena)
  return cena
}

export function Ai() {
  const { root, materials, ajustarFundo, precisaFundo, pose, parado } = useAiScene()
  useOwnEnvIntensity(useMemo(() => withOwnEnv(materials), [materials]))
  const [reduced] = useState(prefersReducedMotion)
  const relogio = useRef({ c: 0, t: 0, iniciado: false })
  const atlas = useRef<HTMLImageElement | null>(null)
  const quadros = useRef(0)
  useEffect(() => {
    let vivo = true
    carregarLogos()
      .then((img) => {
        if (vivo) atlas.current = img
      })
      .catch(() => {
        // Sem o atlas, as janelas ficam vazias; o robô continua.
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
      ajustarFundo(gl, camera, size.width, size.height, img)
    }
    if (reduced) {
      parado(camera, size.width, size.height)
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
    pose(Math.min(r.c, T.fim), r.t, dt, camera, size.width, size.height)
  })

  return <primitive object={root} />
}
