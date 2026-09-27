/**
 * Vida "FullStack Dev" (fullstack): o Fael usando um notebook, visto por trás da tampa (F6), com as stacks dele em
 * adesivos de vinil na tampa (F1, F2, F3, F7, F8; tamanho, posição e desgaste no atlas do glb). Sem marca do notebook e
 * sem os fones de antes (F9). Forma e material: o glb do estúdio (raiz `fullstack`, FICHA-PRODUCAO.md, FECHAMENTO).
 *
 * O notebook fica preso à MESA (../ancora.ts, como o volante do Uber): a cabeça se move atrás dele (olhar e arrasto).
 * Escala e deslocamento do grupo são do site (GRUPO, por formato de tela), em volta da origem de `fs_notebook` (centro
 * da borda de cima da tampa). A parte de baixo da tampa e a base somem num degradê para o fundo (withDissolve com
 * `fadeUv1`, o degradê pintado no 2º UV); tudo desintegra junto com o busto.
 * A tela acende o rosto por baixo: uma luz spot fria no empty `fs_notebook_tela` (−Z para o rosto), que apaga com a
 * desintegração e pulsa muito de leve (troca de janela). Atrás do busto, a chuva de código (chuva.ts, F10), presa ao
 * mundo como o notebook. Movimento reduzido: luz constante e chuva parada. O notebook não se move.
 */
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import fullstackUrl from '../../../../../../3d/export/props/fullstack.glb?url'
import { dissolveUniforms, withDissolve } from '../../dissolve'
import { criarAncora, type Grupo } from '../ancora'
import { useDisposal } from '../materials'
import { criarChuva } from './chuva'

const NOTEBOOK = 'fs_notebook'
const TELA = 'fs_notebook_tela'
/** A chuva fica no espaço do glb, sem ajuste (a âncora só desfaz o giro da cabeça). */
const FUNDO: Grupo = { escala: 1, desloc: [0, 0, 0] }
/**
 * Ajuste do grupo da mesa (medido com 3d/tools/props/volta_prop.mjs e colisao_orq.mjs; LOG da volta 1): tela larga e
 * retrato estreito (largura < altura). A borda de cima da tampa fica abaixo do lábio (≥ 12 / 8 / 4 px), longe do
 * "Contact me" e da borda da tela; no 360, sem adesivo sob o título.
 */
const GRUPO: Record<'largo' | 'estreito', Grupo> = {
  largo: { escala: 0.8, desloc: [-0.03, -0.011, 0] },
  estreito: { escala: 0.66, desloc: [0, -0.009, 0] },
}
/** Luz da tela: fria, suave, com um toque do acento da vida (#3ddc84). Intensidade em candela (three 0.180). */
const LUZ = {
  cor: '#cfeee6',
  intensidade: 0.15,
  alcance: 0.6,
  cone: THREE.MathUtils.degToRad(70),
  penumbra: 1,
  /** A luz apaga enquanto a desintegração avança (uD de 0 a este valor). */
  apaga: 0.15,
  /** Pulso da troca de janela: amplitude relativa e período (s). */
  pulso: 0.04,
  periodo: 4.3,
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true

/** Clona a cena (geometrias e texturas seguem do cache do useGLTF) e troca cada material por um com a desintegração. */
function useFullstackScene() {
  const { scene } = useGLTF(fullstackUrl, false)
  const cena = useMemo(() => {
    const root = scene.getObjectByName('fullstack')
    if (!root) throw new Error('fullstack.glb sem a raiz fullstack')
    const copy = root.clone(true)
    const materials: THREE.Material[] = []
    copy.traverse((o) => {
      if (!isMesh(o)) return
      // Tampa e base somem para o fundo pelo degradê do 2º UV (TEXCOORD_1.x); nos adesivos ele vale 1.
      const fadeUv1 = o.geometry.hasAttribute('uv1')
      const own = (m: THREE.Material) => {
        const c = withDissolve(m.clone(), { fadeUv1 })
        materials.push(c)
        return c
      }
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material)
    })
    const notebook = copy.getObjectByName(NOTEBOOK) ?? null
    // Ajuste vigente (o mesmo objeto; o componente troca os valores pelo formato da tela).
    const grupo: Grupo = { ...GRUPO.largo }
    const mesa = criarAncora(copy, [NOTEBOOK], notebook, () => grupo, { nome: 'fs_mesa' })
    mesa.userData.grupo = grupo
    const chuva = criarChuva()
    copy.add(chuva.mesh)
    criarAncora(copy, [chuva.mesh.name], null, () => FUNDO, { nome: 'fs_fundo' })

    const luz = new THREE.SpotLight(LUZ.cor, 0, LUZ.alcance, LUZ.cone, LUZ.penumbra, 2)
    luz.name = 'fs_luz_tela'
    // O three nasce a spot em (0, 1, 0): a luz vai para o centro da tela, mirando o −Z do empty.
    luz.position.set(0, 0, 0)
    luz.target.position.set(0, 0, -1)
    luz.add(luz.target)
    copy.getObjectByName(TELA)?.add(luz)

    /** Intensidade no instante t (s desde a montagem); `parado` sem pulso. Nada alocado. */
    const acender = (t: number, parado: boolean) => {
      const d = THREE.MathUtils.smoothstep(dissolveUniforms.uD.value, 0, LUZ.apaga)
      const pulso = parado ? 1 : 1 + LUZ.pulso * Math.sin((2 * Math.PI * t) / LUZ.periodo)
      luz.intensity = LUZ.intensidade * (1 - d) * pulso
      chuva.tempo.value = t
      chuva.parado.value = parado ? 1 : 0
    }
    const dispose = () => {
      materials.forEach((mat) => mat.dispose())
      luz.dispose()
      chuva.dispose()
    }
    return { root: copy, grupo, acender, ajustarChuva: chuva.ajustar, dispose }
  }, [scene])
  useDisposal(cena)
  return cena
}

export function Fullstack() {
  const { root, grupo, acender, ajustarChuva } = useFullstackScene()
  const estreito = useThree((s) => s.size.width < s.size.height)
  useLayoutEffect(() => {
    Object.assign(grupo, GRUPO[estreito ? 'estreito' : 'largo'])
  }, [grupo, estreito])
  // Tela para a qual a grade da chuva foi ajustada (no resize, reajusta no quadro seguinte; nunca por quadro).
  const ajustada = useRef({ w: 0, h: 0 })
  // Relógio da vida (s desde a montagem); com movimento reduzido não anda.
  const [reduced] = useState(prefersReducedMotion)
  const clock = useRef(0)

  useFrame(({ camera, size }, delta) => {
    const a = ajustada.current
    if (a.w !== size.width || a.h !== size.height) {
      ajustarChuva(camera, size.width, size.height)
      a.w = size.width
      a.h = size.height
    }
    // Mesmo passo máximo do relógio do carrossel: aba em segundo plano não pula o roteiro.
    if (!reduced) clock.current += Math.min(delta, 0.1)
    acender(clock.current, reduced)
  })

  return <primitive object={root} />
}

useGLTF.preload(fullstackUrl, false)
