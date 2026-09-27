/**
 * FUNDO da vida techlead (FICHA-PRODUCAO, FECHAMENTO, "Fundo e site (TD)"): "Da conversa à cadência" nas zonas livres
 * em volta da cabeça (zonas.ts), com a técnica do devops — cada zona é um plano com o material de revelação
 * (../devops/revela.ts; uma chamada por painel), pintado UMA vez no resize pelo Pincel (../devops/pincel.ts), e o
 * roteiro só mexe em uniformes. Os cartões do Jira andam numa malha própria (cartoes.ts).
 *   largo (1440): TOPO = chamada (balão, onda até o headset, legenda) e o novo balão; ESQ = post-its; DIR = mockup e
 *   fluxo em Mermaid; BASE = Jira (equipe, Kanban, sprints, burndown, release).
 *   médio (1024): TOPO = chamada; DIR = post-its, mockup e fluxo; BASE = Jira.
 *   estreito (360): silhueta — ESQ = chamada e post-its; DIR = Kanban e burndown.
 * Brilho contido (o rosto domina); apaga com a desintegração (uD).
 */
import * as THREE from 'three'
import type { Formato } from '../devops/composicao'
import { Pincel, type Ponto } from './pincel'
import { criarRevela, type Revela } from '../devops/revela'
import { chamada, chamadaMini, novoBalao, postits } from './bloco_chamada'
import { quadroJira, type Jira } from './bloco_jira'
import { solucao } from './bloco_solucao'
import { criarCartoes } from './cartoes'
import { TAM, type Tela } from './estilo'
import { T, type Alvo, type Quadro as QuadroRoteiro } from './roteiro'
import { Z_SAIDA, criarSaida } from './saida'
import { PAINEIS, zonasPara, type Medida, type Zonas } from './zonas'

/** Profundidade dos painéis no espaço do glb (atrás do rosto, ao lado da cabeça), como o fundo do QA e do devops. */
export const Z_FUNDO = -0.22
/** Resolução do canvas: px por px CSS (dpr, até 2). */
const ESCALA_MAX = 2
const BRILHO = 0.92
/** Pulso da voz correndo pela onda (mais claro que o acento, que é a cor da linha). */
const PULSO = '#f1e8ff'

/** Retrato (silhueta): a chamada e os post-its à esquerda da cabeça, o Kanban e o burndown à direita. */
function pintarRetrato(tl: Tela, z: Zonas, m: Medida): Jira | null {
  if (z.esq) {
    const ouvido: Ponto = [z.esq.x1 - 2, Math.min(z.esq.y1 - 120, Math.max(z.esq.y0 + 40, m.ouvido[1]))]
    const y = chamadaMini(tl, z.esq, ouvido)
    postits(tl, { ...z.esq, y0: y }, true)
  }
  return z.dir ? quadroJira(tl, z.dir, true) : null
}

/** Pinta o fundo inteiro no pincel (recortado pelo canvas dele); devolve os slots do Kanban e a chegada da voz. */
function pintar(tl: Tela, z: Zonas, m: Medida): Jira | null {
  const k = TAM[tl.f]
  if (tl.f === 'estreito') return pintarRetrato(tl, z, m)
  if (z.topo) {
    // A onda segue na altura do balão e desce ao ouvido junto à cabeça (sem cruzar a legenda).
    const desvio = z.topo.x1 - k.corpo * 3
    const ouvido: Ponto = z.esq ? m.ouvido : [z.topo.x1 - 4, Math.min(z.topo.y1 - 8, m.ouvido[1])]
    const y = chamada(tl, z.topo, ouvido, desvio)
    if (y + k.corpo * 2.6 < z.topo.y1) novoBalao(tl, z.topo.x0, y + k.corpo * 0.3, desvio - z.topo.x0 - 12)
    if (z.esq) postits(tl, { ...z.esq, x1: Math.min(z.esq.x1, desvio - 16) })
  }
  if (z.dir) {
    let r = z.dir
    if (!z.esq) {
      const alto = 3 * (k.corpo * 1.1 + k.rotulo * 1.3 + 2 * k.corpo * 1.3) + 20
      postits(tl, { ...r, y1: r.y0 + alto })
      r = { ...r, y0: r.y0 + alto + k.corpo * 1.2 }
    }
    solucao(tl, r)
  }
  return z.base ? quadroJira(tl, z.base) : null
}

export function criarFundo() {
  const paineis = PAINEIS.map((nome) => {
    const r: Revela = criarRevela(`tl_fundo_${nome}`, { campo: false, brilho: BRILHO, corFluxo: PULSO })
    const geo = new THREE.PlaneGeometry(1, 1)
    const mesh = new THREE.Mesh(geo, r.material)
    mesh.name = `tl_fundo_${nome}`
    mesh.renderOrder = -1
    mesh.visible = false
    return { nome, r, geo, mesh }
  })
  const cartoes = criarCartoes()
  const saida = criarSaida()
  /** Pontos do olhar (px CSS) e as zonas vigentes (lidas pelas ferramentas do estúdio). */
  const estado = { alvos: {} as Partial<Record<Alvo, { x: number; y: number }>>, zonas: null as Zonas | null }

  const raio = new THREE.Raycaster()
  const plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), -Z_FUNDO)
  const planoSaida = new THREE.Plane(new THREE.Vector3(0, 0, 1), -Z_SAIDA)
  const inv = new THREE.Matrix4()
  const ndc = new THREE.Vector2()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  /** Ponto da tela (px CSS) no plano z = Z_FUNDO do pai, em coordenadas do pai (`inv` já calculada). */
  const noPlano = (x: number, y: number, camera: THREE.Camera, w: number, h: number, out: THREE.Vector3) => {
    ndc.set((x / w) * 2 - 1, 1 - (y / h) * 2)
    raio.setFromCamera(ndc, camera)
    raio.ray.applyMatrix4(inv)
    return raio.ray.intersectPlane(plano, out) ?? out.set(0, 0, Z_FUNDO)
  }

  /** Pinta e encaixa os painéis e os cartões para a medida `m` (no resize). */
  const ajustar = (camera: THREE.Camera, f: Formato, m: Medida, img: HTMLImageElement) => {
    const pai = paineis[0]?.mesh.parent
    if (!pai) return
    // A matriz do grupo é a da âncora no último quadro (a cabeça em repouso).
    camera.updateMatrixWorld()
    inv.copy(pai.matrixWorld).invert()
    const zonas = zonasPara(f, m)
    const escala = Math.min(ESCALA_MAX, window.devicePixelRatio || 1)
    estado.zonas = zonas
    let jira: Jira | null = null
    let feito = false
    for (const p of paineis) {
      const q = zonas[p.nome]
      if (!q) {
        p.mesh.visible = false
        continue
      }
      const tl: Tela = { p: new Pincel(q, escala), img, f, alvos: {} }
      const s = pintar(tl, zonas, m)
      if (!feito) {
        estado.alvos = tl.alvos
        jira = s
        feito = true
      }
      p.r.texturas(tl.p.cor, tl.p.dados)
      noPlano(q.x0, q.y0, camera, m.w, m.h, a)
      noPlano(q.x1, q.y1, camera, m.w, m.h, b)
      p.mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, Z_FUNDO)
      p.mesh.scale.set(Math.abs(b.x - a.x), Math.abs(a.y - b.y), 1)
      p.mesh.userData.rect = { ...q }
      p.mesh.visible = true
    }
    if (!jira) {
      cartoes.mesh.visible = false
      return
    }
    cartoes.ajustar(f, jira.slots, (x, y, out) => noPlano(x, y, camera, m.w, m.h, out), escala)
    const naFrente = (x: number, y: number, out: THREE.Vector3) => {
      ndc.set((x / m.w) * 2 - 1, 1 - (y / m.h) * 2)
      raio.setFromCamera(ndc, camera)
      raio.ray.applyMatrix4(inv)
      return raio.ray.intersectPlane(planoSaida, out) ?? out.set(0, 0, Z_SAIDA)
    }
    saida.ajustar(naFrente, jira.chegada, m.cabeca.y1, f === 'estreito')
  }

  /** Ponto da tela (px CSS) no plano do fundo, em coordenadas do grupo do fundo (para o olhar). */
  const pontoNoFundo = (x: number, y: number, camera: THREE.Camera, w: number, h: number, out: THREE.Vector3) => {
    const pai = paineis[0]?.mesh.parent
    if (!pai) return out.set(0, 0, Z_FUNDO)
    inv.copy(pai.matrixWorld).invert()
    return noPlano(x, y, camera, w, h, out)
  }

  /** Uniformes, cartões e a voz que sai do microfone (em `mx`, `my`, px CSS), sem alocar. `tempo`: relógio da voz. */
  const atualizar = (q: QuadroRoteiro, tempo: number, mx: number, my: number) => {
    for (const p of paineis) {
      p.r.u.uT.value = q.t
      p.r.u.uEst.value.set(q.est)
      p.r.u.uFluxo.value = q.fluxo
      p.r.u.uTempo.value = tempo
    }
    cartoes.atualizar(q.t, T.cartoes)
    saida.atualizar(q.saida, tempo, mx, my)
  }
  const dispose = () => {
    cartoes.dispose()
    saida.dispose()
    for (const p of paineis) {
      p.r.dispose()
      p.geo.dispose()
    }
  }
  const meshes = [...paineis.map((p) => p.mesh), cartoes.mesh, saida.mesh]
  return { meshes, estado, ajustar, pontoNoFundo, atualizar, dispose }
}
