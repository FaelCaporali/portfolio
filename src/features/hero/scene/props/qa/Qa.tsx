/**
 * Vida "QA Analyst" (qa), FICHA-PRODUCAO.md "FICHA v2 — NARRATIVA" (REQUISITOS N1–N5, Q9–Q19): o bug nasce solto e voa
 * em volta da cabeça (voo.ts) com um rastro que desbota (rastro.ts); dispara o alerta no ponto de captura (alerta.ts);
 * a lupa, sem mão, chega em linha reta e o trava sob a lente (bug.ts); no fundo, à esquerda, surge o bug report e, à
 * direita, o caso de teste em Gherkin que o Cypress deixa verde (fundo.ts, fundo_texto.ts; Q20, Q21); a lupa leva o bug
 * à vaga livre da caixa, onde ele é alfinetado (vaga.ts), e sai vazia. Tempo: roteiro.ts; composição: composicao.ts.
 *
 * Bug, lupa, rastro e anel ficam no espaço da cabeça (filhos do `frame`: seguem o olhar e o arrasto); a caixa (na mesa,
 * com o bug catalogado) e o fundo ficam presos ao mundo (../ancora.ts). Relógio: o ciclo 0 conta desde
 * a montagem no auge do furacão (montada já parada, a pausa começa agora: c = TIMING.in); com a pausa segurada (a vida
 * não sai), o ciclo recomeça e o bug escapa da vaga. Todo material passa pela desintegração. Movimento reduzido: o
 * estado final parado. Nó que o glb não tiver fica de fora.
 */
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import qaUrl from '../../../../../../3d/export/props/qa.glb?url'
import { TIMING } from '../../../model/carousel'
import { alvoDoAdereco } from '../../../model/gaze'
import { dissolveUniforms, withDissolve } from '../../dissolve'
import { criarAncora, type Grupo } from '../ancora'
import { useDisposal } from '../materials'
import { criarAlerta } from './alerta'
import { AMPLIA, PRESO, criarBug } from './bug'
import { COMPOSICAO, formato, fundoPara, type Composicao, type Formato } from './composicao'
import { criarPainel, type Revela } from './fundo'
import { criarRastro } from './rastro'
import { T, criarQuadro, fasePulso, quadroEm, quadroFinal } from './roteiro'
import { ESCALA_CATALOGADO, criarVaga } from './vaga'
import { ROTAS, posicaoNaRota, type Extremos } from './voo'

const CAIXA = 'qa_caixa'
const LUPA = 'qa_lupa_mao'
/** O bug preso fica atrás do vidro (a lente olha para +Z; com 1,6× o dorso fica a ~2 mm do vidro). */
const SOB_VIDRO = -0.012
/** Os olhos miram o bug este tanto (s de rota) à frente de onde ele está: antecipam. */
const ADIANTE = 0.12
/** Com a pausa segurada, o ciclo recomeça este tanto depois do fim (s), se a saída não começou. */
const RECOMECA = 0.3
/** Lupa saindo vazia: para onde sobe (m, relativo à vaga). */
const SAI = new THREE.Vector3(0, 0.05, 0.03)
const EIXO_Z = new THREE.Vector3(0, 0, 1)
const EIXO_Y = new THREE.Vector3(0, 1, 0)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as Partial<THREE.Mesh>).isMesh === true
const suave = (x: number) => 1 - (1 - x) ** 3
const copiar = (c: Composicao): Composicao => ({ ...c, caixa: { ...c.caixa } })
/** O fundo fica no espaço do glb, sem ajuste (a âncora só desfaz o giro da cabeça). */
const FUNDO: Grupo = { escala: 1, desloc: [0, 0, 0] }
/** Bordas da cabeça na altura dos olhos (glb; orelhas e cabelo), para os painéis do fundo não ficarem atrás dela. */
const CABECA = { esq: [-0.1, 0.18, -0.1] as const, dir: [0.1, 0.18, -0.1] as const }
/** Raio externo do aro da lente no glb (m), com a escala 1 da lupa. */
const ARO = 0.0414

/** Clona a cena (geometrias e texturas seguem do cache do useGLTF) e troca cada material por um com a desintegração. */
function useQaScene() {
  const { scene } = useGLTF(qaUrl, false)
  const cena = useMemo(() => {
    const raiz = scene.getObjectByName('qa')
    if (!raiz) throw new Error('qa.glb sem a raiz qa')
    const copy = raiz.clone(true)
    const materials: THREE.Material[] = []
    copy.traverse((o) => {
      if (!isMesh(o)) return
      const own = (m: THREE.Material) => {
        const c = withDissolve(m.clone(), { fadeUv1: o.geometry.hasAttribute('uv1') })
        // Vidro (lente e caixa) e asas: depois do bug (opaco), sem escrever profundidade.
        if (c.transparent) {
          c.depthWrite = false
          o.renderOrder = 2
        }
        materials.push(c)
        return c
      }
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material)
    })
    const comp = copiar(COMPOSICAO.largo)
    const grupoCaixa: Grupo = { escala: 1, desloc: [0, 0, 0] }
    const caixa = copy.getObjectByName(CAIXA) ?? null
    if (caixa) criarAncora(copy, [CAIXA], caixa, () => grupoCaixa, { nome: 'qa_mesa' })
    const noBug = copy.getObjectByName('qa_bug')
    const vaga = caixa && noBug ? criarVaga(caixa, noBug) : null
    const bug = criarBug(noBug)
    const lupa = copy.getObjectByName(LUPA) ?? null
    const escalaLupa = lupa?.scale.x ?? 1
    const qLupa = lupa?.quaternion.clone() ?? new THREE.Quaternion()
    // Lupa do outro lado do rosto: o giro de fábrica espelhado em X.
    const qLupaEspelho = new THREE.Quaternion(qLupa.x, -qLupa.y, -qLupa.z, qLupa.w)
    const rastro = criarRastro()
    const alerta = criarAlerta()
    copy.add(rastro.mesh, alerta.grupo)
    const report = criarPainel('report')
    const teste = criarPainel('teste')
    copy.add(report.mesh, teste.mesh)
    const fundo = criarAncora(copy, [report.mesh.name, teste.mesh.name], null, () => FUNDO, { nome: 'qa_fundo' })
    const revela: Revela = { a: 0, b: 0, g: 0, c: 0, verdes: 0, piscar: false }
    const pv = new THREE.Vector3()
    /** Painéis do fundo para a tela (na montagem e no resize, nunca por quadro). */
    const ajustarFundo = (f: Formato, camera: THREE.Camera, w: number, h: number) => {
      // A cabeça e a lente em repouso (o grupo do fundo é o frame sem o giro da cabeça).
      const px = (x: number, y: number, z: number) => pv.set(x, y, z).applyMatrix4(fundo.matrixWorld).project(camera)
      const c = COMPOSICAO[f]
      const [cx, cy, cz] = c.captura
      const ref = {
        esq: ((px(...CABECA.esq).x + 1) / 2) * w,
        dir: ((px(...CABECA.dir).x + 1) / 2) * w,
        lente: ((1 - px(cx, cy + ARO * c.lupa, cz).y) / 2) * h,
      }
      const r = fundoPara(f, w, h, ref)
      report.ajustar(camera, w, h, r.report, r.corpo, f)
      teste.ajustar(camera, w, h, r.teste, r.corpo, f)
    }
    const q = criarQuadro()
    const cap = new THREE.Vector3()
    const ext: Extremos = { cap: new THREE.Vector3(), vaga: new THREE.Vector3(), espelho: false, largura: 1 }
    const lenteVaga = new THREE.Vector3()
    const alvo = new THREE.Vector3()
    const giro = new THREE.Quaternion()
    const v3 = new THREE.Vector3()

    const compor = () => {
      cap.set(...comp.captura)
      ext.cap.set(cap.x, cap.y, cap.z + SOB_VIDRO)
      ext.espelho = comp.espelho
      ext.largura = comp.rotaX
      if (caixa) {
        caixa.position.set(...comp.caixa.pos)
        caixa.quaternion.setFromAxisAngle(EIXO_Y, comp.caixa.giroY)
        caixa.scale.setScalar(comp.caixa.escala)
      }
    }

    /** Lupa: sobe em linha reta até o anel, leva o bug até a vaga e sai vazia. */
    const lupaEm = () => {
      if (!lupa) return
      const k = 1 - suave(q.lupa)
      const [ex, ey, ez] = comp.entrada
      lupa.position.set(cap.x + ex * k, cap.y + ey * k, cap.z + ez * k)
      lupa.position.lerp(lenteVaga, q.leva)
      lupa.position.addScaledVector(SAI, suave(q.lupaSai))
      const escala = escalaLupa * comp.lupa * (1 - suave(q.lupaSai))
      lupa.scale.setScalar(escala)
      lupa.visible = q.lupa > 0 && escala > 1e-4
      const g = comp.giro + (comp.giroCaixa - comp.giro) * q.leva
      lupa.quaternion.copy(giro.setFromAxisAngle(EIXO_Z, g)).multiply(comp.espelho ? qLupaEspelho : qLupa)
    }

    /** Bug: voa, trava na lente, é levado à vaga e alfinetado (vira o catalogado, preso à caixa). */
    const bugEm = (ciclo: number, c: number, t: number, v: ReturnType<NonNullable<typeof vaga>['naRaiz']> | null) => {
      if (!bug) return
      const rota = ROTAS[q.rota] ?? ROTAS[0]
      if (!rota) return
      bug.objeto.visible = !q.preso
      if (vaga) vaga.catalogado.visible = q.preso
      if (q.leva <= 0) {
        // Na repetição, parado na vaga até os élitros abrirem; depois, preso na lente.
        const naVaga = ciclo > 0 && c < T.chega / 2 && v
        const qParado = naVaga ? v.q : PRESO
        bug.pose(rota, q.tv, ext, q.voo, t, qParado, naVaga ? ESCALA_CATALOGADO * v.s : AMPLIA)
        return
      }
      if (!v) return
      v3.copy(lenteVaga).setZ(lenteVaga.z + SOB_VIDRO)
      const p = alvo.copy(ext.cap).lerp(v3, q.leva).lerp(v.p, q.pino)
      const escala = AMPLIA + (ESCALA_CATALOGADO * v.s - AMPLIA) * q.pino
      bug.parado(p, giro.slerpQuaternions(PRESO, v.q, q.pino), escala)
    }

    /** Texto do fundo: cada bloco surge no tempo da narrativa; cursor piscando onde está sendo digitado. */
    const fundoEm = (t: number) => {
      revela.a = q.a
      revela.b = q.b
      revela.g = q.g
      revela.c = q.c
      revela.verdes = q.verdes
      revela.piscar = t % 0.5 < 0.3
      report.revelar(revela)
      teste.revelar(revela)
    }

    /** Alvo dos olhos: o bug um pouco à frente, a lente (o bug preso) e a vaga (levando o bug e catalogado). */
    const olharEm = (v: ReturnType<NonNullable<typeof vaga>['naRaiz']> | null) => {
      const rota = ROTAS[q.rota] ?? ROTAS[0]
      if (q.alvo === 'bug' && rota) posicaoNaRota(rota, q.tv + ADIANTE, ext, alvo, true)
      else if (q.alvo === 'lente') alvo.copy(cap)
      else if (bug && !q.preso) alvo.copy(bug.objeto.position)
      else if (v) alvo.copy(v.p)
      alvoDoAdereco.x = alvo.x
      alvoDoAdereco.y = alvo.y
      alvoDoAdereco.z = alvo.z
      alvoDoAdereco.peso = q.olhar
    }

    /** Pose no instante c do ciclo (s) e t (s desde a montagem, para a batida das asas). Nada alocado. */
    const pose = (c: number, ciclo: number, t: number) => {
      compor()
      quadroEm(c, ciclo, q)
      const v = vaga?.naRaiz(copy) ?? null
      if (v) {
        ext.vaga.copy(v.p)
        const [sx, sy, sz] = comp.sobreVaga
        lenteVaga.set(v.p.x + sx, v.p.y + sy, v.p.z + sz)
      }
      const rota = ROTAS[q.rota] ?? ROTAS[0]
      if (rota) rastro.atualizar(rota, q.tv, ext)
      alerta.atualizar(q.anel, fasePulso(c), cap, comp.lupa)
      lupaEm()
      bugEm(ciclo, c, t, v)
      fundoEm(t)
      olharEm(v)
    }
    /** Movimento reduzido: o estado final parado. */
    const parado = () => {
      compor()
      quadroFinal(q)
      if (bug) bug.objeto.visible = false
      if (vaga) vaga.catalogado.visible = true
      if (lupa) lupa.visible = false
      rastro.esconder()
      alerta.atualizar(0, 0, cap, comp.lupa)
      fundoEm(0)
      olharEm(vaga?.naRaiz(copy) ?? null)
    }
    const dispose = () => {
      materials.forEach((m) => m.dispose())
      rastro.dispose()
      alerta.dispose()
      report.dispose()
      teste.dispose()
    }
    return { root: copy, comp, pose, parado, ajustarFundo, dispose }
  }, [scene])
  useDisposal(cena)
  return cena
}

export function Qa() {
  const { root, comp, pose, parado, ajustarFundo } = useQaScene()
  const forma = useThree((s) => formato(s.size.width, s.size.height))
  const [reduced] = useState(prefersReducedMotion)
  const relogio = useRef({ c: 0, t: 0, ciclo: 0, iniciado: false })
  // Tela para a qual o fundo foi diagramado (no resize, no quadro seguinte; a âncora precisa de um quadro desenhado).
  const ajustado = useRef({ w: 0, h: 0, quadros: 0 })

  useLayoutEffect(() => {
    Object.assign(comp, copiar(COMPOSICAO[forma]))
    const r = relogio.current
    if (reduced) parado()
    else pose(Math.min(r.c, T.fim), r.ciclo, r.t)
  }, [comp, forma, pose, parado, reduced])

  // Fora da vida qa, os olhos voltam ao ponteiro.
  useEffect(
    () => () => {
      alvoDoAdereco.peso = 0
    },
    [],
  )

  useFrame(({ camera, size }, delta) => {
    const a = ajustado.current
    a.quadros += 1
    if (a.quadros > 1 && (a.w !== size.width || a.h !== size.height)) {
      ajustarFundo(formato(size.width, size.height), camera, size.width, size.height)
      a.w = size.width
      a.h = size.height
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
      // Montada no auge do furacão (troca de vida): c = 0; montada já parada (abertura): a pausa começa agora.
      r.iniciado = true
      r.c = dissolveUniforms.uD.value > 0 ? 0 : TIMING.in
    } else r.c += dt
    // Pausa segurada (sem saída): recomeça; na saída, fica no estado final até desintegrar.
    if (r.c >= T.fim + RECOMECA && dissolveUniforms.uD.value === 0) {
      r.ciclo += 1
      r.c = 0
    }
    pose(Math.min(r.c, T.fim), r.ciclo, r.t)
  })

  return <primitive object={root} />
}

useGLTF.preload(qaUrl, false)
