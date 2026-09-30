/**
 * Vida "Uber Driver" (uber): o Fael visto pelo para-brisa, triste (U10: a expressão `browInnerUp` fica), com o volante
 * NA FRENTE do rosto (U1), as mãos nele (U2, U3, U5) e uma lágrima escorrendo de cada olho (U4). Em teste (U7): o
 * celular num suporte, com um mapa e uma rota (celular.ts). Forma e material: o glb do estúdio (raiz `uber`).
 *
 * Volante, mãos e celular ficam presos ao CARRO (../ancora.ts, ficha ADENDO 6): a cabeça se move atrás deles (olhar e
 * arrasto); as lágrimas, na pele, seguem a cabeça. Escala, deslocamento e pegada do grupo são do site (GRUPO, por
 * formato de tela). O volante faz correções pequenas de direção em volta do eixo da coluna, e as mãos, filhas dele,
 * giram junto. A metade de baixo do volante, os punhos e os antebraços somem num degradê para o fundo como o pescoço
 * (withDissolve com `fadeUv1`, o degradê pintado no 2º UV); tudo desintegra junto com o busto. Gota e rastro são os
 * únicos transparentes: desenhados depois da sombra do olho (renderOrder).
 * Movimento reduzido: volante reto, gota a meio caminho, mapa parado. Nó que o glb não tiver fica de fora.
 */
import { useGlb } from '../../carga'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import uberUrl from '../../../../../../3d/export/props/uber.glb?url'
import { withDissolve } from '../../dissolve'
import { useDisposal } from '../materials'
import { criarAncora, type Grupo, type Maos } from '../ancora'
import { criarCelular } from './celular'
import { criarLagrima } from './lagrima'

const VOLANTE = 'uber_volante'
/** Nós presos ao carro. */
const CARRO = [VOLANTE, 'uber_celular']
/** Mãos filhas do volante que a pegada corre pelo aro: [sinal do giro, lado] (a esquerda do Fael é o lado 0). */
const MAOS: Maos = { uber_mao_esq: [1, 0], uber_mao_dir: [-1, 1] }
/**
 * Ajuste do grupo do carro (medido com 3d/tools/props/volta_prop.mjs e colisao_orq.mjs, ADENDO 6): tela larga e
 * retrato estreito (largura < altura). Ordem das ferramentas: aproximar do busto (−z), fechar a pegada, reduzir a
 * escala (≥ 0,85; ≥ 0,8 no retrato). Nunca subir o aro sobre a boca. O −z tem limite: preso ao carro, a cabeça gira
 * contra as mãos e o aro (com z ≤ 0 o queixo e a mandíbula entram neles ao olhar para os lados); +z os traz para a
 * câmera, maiores e mais baixos na tela, e o y compensa.
 */
const GRUPO: Record<'largo' | 'estreito', Grupo> = {
  // 1440 e 1024: o aro fora do "Contact me" pede o grupo à esquerda; a altura sai da pose de boca mais baixa (olhar
  // para baixo): aro a ~19 px (1440) e ~14 px (1024) da borda do lábio, contra 12 e 8 exigidos; mãos a ≥ 1 cm do busto.
  largo: { escala: 0.85, desloc: [-0.035, 0.016, 0.03], pegada: [4, 4] },
  // 360: mãos acima do título (só o aro escuro passa sob ele, contraste ≥ 4,5:1) e fora da boca; aro a ~12 px do lábio
  // olhando para baixo (exigido 4). Mais baixo, a mão entra sob o título; mais alto, na boca.
  estreito: { escala: 0.8, desloc: [0, 0.016, 0.015], pegada: [13, 13] },
}
/** Celular (teste) mais para fora e para baixo: no arrasto a boca passava atrás dele. */
const DESLOC_CELULAR = new THREE.Vector3(0.07, -0.02, 0)
/** Eixo da coluna no espaço local de `uber_volante` (prop_uber_volante.py: +Z local, apontando para o painel). */
const EIXO_COLUNA = new THREE.Vector3(0, 0, 1)
/** Correção de direção: até ±5° (a ficha pede 5–8°; 5° mantém as mãos longe da boca e do título), duas ondas
 * lentas somadas (sem "boing"), entrando em 0,8 s. No retrato estreito, ±GIRO_ESTREITO: entre a boca (olhando para
 * baixo) e o título sobram poucos px para a mão, e o giro de 5° a leva a um ou ao outro (volta_prop.mjs no 360). */
const GIRO_MAX = { largo: THREE.MathUtils.degToRad(5), estreito: THREE.MathUtils.degToRad(3) }
const ENTRADA = 0.8
/** Reflexo do ambiente na água quando o material do glb não traz `envMapIntensity` nos extras: a luz do site é fraca
 * (envIntensity 0,35) e o brilho é o que lê. */
const REFLEXO = { gota: 3, rastro: 2 }
/** Água: fração da difusa que fica e refletância na incidência normal. */
const AGUA = { difusa: 0.35, f0: 0.12 }
/** Lágrimas depois da sombra do olho do busto (renderOrder 1, rig.ts); o lado direito atrasado. */
const ORDEM_LAGRIMA = 2
const LAGRIMA = /^uber_lagrima_/
const GOTA = /_gota$/
const DEFASAGEM = { esq: 0, dir: 1.15 }

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true

/** Algum ancestral (ou o próprio) casa com o teste. */
function sob(o: THREE.Object3D, teste: (p: THREE.Object3D) => boolean) {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (teste(p)) return true
  return false
}

/** Ângulo de direção (rad) no instante t: correções pequenas e lentas, começando do volante reto. */
function direcao(t: number, max: number) {
  const e = Math.min(t / ENTRADA, 1)
  const onda = 0.62 * Math.sin((2 * Math.PI * t) / 3.7) + 0.38 * Math.sin((2 * Math.PI * t) / 2.3)
  return max * e * e * (3 - 2 * e) * onda
}

/**
 * Água sem transmissão (que custaria um passe da cena): corpo translúcido pelo alfa do glb, e o especular (luz e
 * ambiente) opaco, como numa gota de verdade, onde o reflexo não fica transparente.
 */
function agua(c: THREE.Material, reflexo: number) {
  const s = c as THREE.MeshStandardMaterial
  const extra: unknown = c.userData.envMapIntensity
  s.envMapIntensity = typeof extra === 'number' ? extra : reflexo
  const antes = c.onBeforeCompile.bind(c)
  c.onBeforeCompile = (sh, r) => {
    antes(sh, r)
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <lights_physical_fragment>',
        // Pouca difusa (a água não tem cor própria) e reflexo mais forte que o dielétrico padrão (F0 0,04).
        `#include <lights_physical_fragment>\nmaterial.diffuseColor *= ${AGUA.difusa.toFixed(2)};\n` +
          `material.specularColor = vec3(${AGUA.f0.toFixed(3)});`,
      )
      .replace(
        '#include <opaque_fragment>',
        'diffuseColor.a = max(diffuseColor.a, clamp(dot(reflectedLight.directSpecular + ' +
          'reflectedLight.indirectSpecular, vec3(0.7)), 0.0, 1.0));\n#include <opaque_fragment>',
      )
  }
  const chave = c.customProgramCacheKey()
  c.customProgramCacheKey = () => `${chave}-agua`
}

/** Clona a cena (geometrias e texturas seguem do cache do useGLTF) e troca cada material por um com a desintegração. */
function useUberScene() {
  const { scene } = useGlb(uberUrl)
  const cena = useMemo(() => {
    const root = scene.getObjectByName('uber')
    if (!root) throw new Error('uber.glb sem a raiz uber')
    const copy = root.clone(true)
    const volante = copy.getObjectByName(VOLANTE) ?? null
    const materials: THREE.Material[] = []
    copy.traverse((o) => {
      if (!isMesh(o)) return
      // Volante e mãos somem para o fundo pelo degradê que o modelador pintou no 2º UV (TEXCOORD_1.x).
      const fadeUv1 = volante !== null && sob(o, (p) => p === volante) && o.geometry.hasAttribute('uv1')
      const lagrima = sob(o, (p) => LAGRIMA.test(p.name))
      const gota = sob(o, (p) => GOTA.test(p.name))
      const own = (m: THREE.Material) => {
        const c = withDissolve(m.clone(), { fadeUv1 })
        if (lagrima) {
          c.transparent = true
          c.depthWrite = false
          agua(c, gota ? REFLEXO.gota : REFLEXO.rastro)
          o.renderOrder = ORDEM_LAGRIMA
          // O rastro fica a menos de 1 mm da pele: vence a disputa de profundidade com ela.
          if (!gota) Object.assign(c, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 })
        }
        materials.push(c)
        return c
      }
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material)
    })
    const lagrimas = (['esq', 'dir'] as const).map((l) => ({ l: criarLagrima(copy, l), atraso: DEFASAGEM[l] }))
    // Celular em teste (U7): para tirar, apagar estas duas linhas, DESLOC_CELULAR e celular.ts.
    const extras = [criarCelular(copy)]
    copy.getObjectByName('uber_celular')?.position.add(DESLOC_CELULAR)
    // Ajuste vigente (o mesmo objeto; o componente troca os valores pelo formato da tela).
    const grupo: Grupo = { ...GRUPO.largo }
    const carro = criarAncora(copy, CARRO, volante, () => grupo, { nome: 'uber_carro', maos: MAOS })
    carro.userData.grupo = grupo
    // Giro máximo vigente (rad), trocado com o formato da tela.
    const giroMax = { rad: GIRO_MAX.largo }
    carro.userData.giroMax = giroMax
    const reto = volante?.quaternion.clone()
    const giro = new THREE.Quaternion()
    /** Pose no instante t (s desde a montagem). Nada alocado. */
    const pose = (t: number) => {
      if (volante && reto) {
        volante.quaternion.copy(reto).multiply(giro.setFromAxisAngle(EIXO_COLUNA, direcao(t, giroMax.rad)))
      }
      for (const { l, atraso } of lagrimas) l?.pose(t - atraso)
      for (const x of extras) x?.pose(t)
    }
    /** Movimento reduzido: volante reto (o do glb), gota a meio caminho, mapa parado. */
    const parado = () => {
      for (const { l } of lagrimas) l?.parado()
      for (const x of extras) x?.parado()
    }
    const dispose = () => {
      materials.forEach((mat) => mat.dispose())
      for (const x of extras) x?.dispose()
      for (const { l } of lagrimas) l?.dispose()
    }
    return { root: copy, grupo, giroMax, pose, parado, dispose }
  }, [scene])
  useDisposal(cena)
  return cena
}

export function Uber() {
  const { root, grupo, giroMax, pose, parado } = useUberScene()
  const estreito = useThree((s) => s.size.width < s.size.height)
  useLayoutEffect(() => {
    const formato = estreito ? 'estreito' : 'largo'
    Object.assign(grupo, GRUPO[formato])
    giroMax.rad = GIRO_MAX[formato]
  }, [grupo, giroMax, estreito])
  // Relógio da vida (s desde a montagem); com movimento reduzido não anda.
  const [reduced] = useState(prefersReducedMotion)
  const clock = useRef(0)

  // Primeiro quadro já na pose do relógio.
  useLayoutEffect(() => {
    if (reduced) parado()
    else pose(clock.current)
  }, [pose, parado, reduced])

  useFrame((_, delta) => {
    if (reduced) return
    // Mesmo passo máximo do relógio do carrossel: aba em segundo plano não pula o roteiro.
    clock.current += Math.min(delta, 0.1)
    pose(clock.current)
  })

  return <primitive object={root} />
}
