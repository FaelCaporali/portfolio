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
import { desenhado } from '../../pausa'
import type { Formato } from '../devops/composicao'
import { Pincel, type Ponto, type Quadro } from './pincel'
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
const Z_FUNDO = -0.22
/** Resolução do canvas: px por px CSS (dpr, até 2). */
const ESCALA_MAX = 2
const BRILHO = 0.92
/** Pulso da voz correndo pela onda (mais claro que o acento, que é a cor da linha). */
const PULSO = '#f1e8ff'

/** Retrato (silhueta): a chamada e os post-its à esquerda da cabeça, o Kanban e o burndown à direita. */
function* pintarRetrato(tl: Tela, z: Zonas, m: Medida): Generator<void, Jira | null> {
  if (z.esq) {
    const r = z.esq
    // Coluna baixa (J74, 320×568): a onda chega ao ouvido dentro dela.
    const oy =
      r.y1 - 120 < r.y0 + 40
        ? Math.min(r.y1 - 4, Math.max(r.y0 + 24, m.ouvido[1]))
        : Math.min(r.y1 - 120, Math.max(r.y0 + 40, m.ouvido[1]))
    const y = chamadaMini(tl, r, [r.x1 - 2, oy])
    yield
    if (z.chamada === 'retrato') postits(tl, { ...r, y0: y }, true)
    yield
  }
  return z.dir ? quadroJira(tl, z.dir, true) : null
}

/** Coluna à direita da cabeça: post-its (sem a coluna da esquerda), o mockup e o fluxo de uso. */
function* pintarDir(tl: Tela, z: Zonas, dir: Quadro, m: Medida): Generator<void, void> {
  const k = TAM[tl.f]
  if (z.chamada === 'dir') {
    // J74: sem faixa em cima nem coluna ao lado do texto (800×360): a chamada em silhueta no alto da coluna (a onda
    // chega à concha direita), os post-its só com o rótulo e a solução se sobrar altura.
    const y = chamadaMini(tl, dir, [dir.x0 + 2, Math.min(dir.y0 + 50, Math.max(dir.y0 + 24, m.ouvido[1]))])
    const alto = 3 * k.rotulo * 2.4 + 12
    yield
    postits(tl, { ...dir, y0: y, y1: Math.min(dir.y1, y + alto) }, true)
    yield
    if (dir.y1 - (y + alto + k.corpo) >= 120) solucao(tl, { ...dir, y0: y + alto + k.corpo })
    return
  }
  let r = dir
  if (!z.esq) {
    const alto = 3 * (k.corpo * 1.1 + k.rotulo * 1.3 + 2 * k.corpo * 1.3) + 20
    postits(tl, { ...r, y1: r.y0 + alto })
    yield
    r = { ...r, y0: r.y0 + alto + k.corpo * 1.2 }
  }
  solucao(tl, r)
}

/** Pinta o fundo inteiro no pincel (recortado pelo canvas dele); devolve os slots do Kanban e a chegada da voz. */
function* pintar(tl: Tela, z: Zonas, m: Medida): Generator<void, Jira | null> {
  const k = TAM[tl.f]
  if (tl.f === 'estreito') return yield* pintarRetrato(tl, z, m)
  if (z.topo && z.chamada === 'topo') {
    // A onda segue na altura do balão e desce ao ouvido junto à cabeça (sem cruzar a legenda).
    const desvio = z.topo.x1 - k.corpo * 3
    const ouvido: Ponto = z.esq ? m.ouvido : [z.topo.x1 - 4, Math.min(z.topo.y1 - 8, m.ouvido[1])]
    const y = chamada(tl, z.topo, ouvido, desvio)
    yield
    if (y + k.corpo * 2.6 < z.topo.y1) novoBalao(tl, z.topo.x0, y + k.corpo * 0.3, desvio - z.topo.x0 - 12)
    yield
    if (z.esq) postits(tl, { ...z.esq, x1: Math.min(z.esq.x1, desvio - 16) })
  } else if (z.esq && z.chamada === 'esq') {
    // J74: faixa de cima baixa demais (notebook 1366×657): a chamada no alto da coluna entre o texto e a cabeça.
    // Coluna estreita para o balão no corpo do formato (≈ 18 corpos com o avatar): a chamada no corpo do médio.
    const tc: Tela = z.esq.x1 - z.esq.x0 < 18 * k.corpo + 10 ? { ...tl, f: 'medio' } : tl
    const y = chamada(tc, z.esq, m.ouvido, z.esq.x1 - TAM[tc.f].corpo * 1.5)
    yield
    postits(tl, { ...z.esq, y0: y + k.corpo })
  }
  yield
  if (z.dir) yield* pintarDir(tl, z, z.dir, m)
  yield
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
  const estado = {
    alvos: {} as Partial<Record<Alvo, { x: number; y: number }>>,
    zonas: null as Zonas | null,
    medida: null as Medida | null,
  }

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

  /**
   * Pinta e encaixa os painéis e os cartões para a medida `m` (no resize), em passos (#138: quem roda fatia, e.g.
   * emFatias): o pincel grava, a pintura toca aos poucos e as texturas sobem à GPU (`subir`) uma por passo; painéis,
   * cartões e olhar só mudam na troca que ele devolve. Cancelado no meio, descarta as texturas novas.
   */
  function* ajustar(
    camera: THREE.Camera,
    f: Formato,
    m: Medida,
    img: HTMLImageElement,
    subir: (t: THREE.Texture) => void,
  ): Generator<unknown, () => void> {
    const pai = paineis[0]?.mesh.parent
    if (!pai) return () => undefined
    // A matriz do grupo é a da âncora no último quadro (a cabeça em repouso).
    camera.updateMatrixWorld()
    const invInicio = pai.matrixWorld.clone().invert()
    const zonas = zonasPara(f, m)
    const escala = Math.min(ESCALA_MAX, window.devicePixelRatio || 1)
    let alvos: typeof estado.alvos = estado.alvos
    let jira: Jira | null = null
    let feito = false
    const pintados: { p: (typeof paineis)[number]; q: Quadro; troca: ReturnType<Revela['preparar']> }[] = []
    let pronto = false
    try {
      for (const p of paineis) {
        const q = zonas[p.nome]
        if (!q) continue
        const tl: Tela = { p: new Pincel(q, escala, true), img, f, alvos: {} }
        const s = yield* pintar(tl, zonas, m)
        if (!feito) {
          alvos = tl.alvos
          jira = s
          feito = true
        }
        yield
        yield* tl.p.pintura()
        const troca = p.r.preparar(tl.p.cor, tl.p.dados)
        pintados.push({ p, q, troca })
        for (const t of troca.novas) {
          // O desenho do canvas termina na GPU antes, fora da thread: a subida é só a cópia.
          yield desenhado(t.image as HTMLCanvasElement)
          subir(t)
          yield
        }
      }
      pronto = true
    } finally {
      if (!pronto) for (const { troca } of pintados) for (const t of troca.novas) t.dispose()
    }
    // A troca, de uma vez (quem roda chama quando tudo o que aparece junto estiver pronto).
    return () => {
      inv.copy(invInicio)
      estado.zonas = zonas
      estado.medida = m
      estado.alvos = alvos
      for (const p of paineis) p.mesh.visible = false
      for (const { p, q, troca } of pintados) {
        troca.usar()
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
