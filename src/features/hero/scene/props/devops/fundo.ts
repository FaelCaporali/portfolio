/**
 * FUNDO da vida devops (FICHA-PRODUCAO, FECHAMENTO; D8–D13): o diagrama de soluções nas zonas livres em volta da
 * cabeça (zonas.ts), em até três painéis (esquerda, direita, base), cada um um plano com o material de revelação
 * (revela.ts; uma chamada por painel). No resize: mede as referências (referencias.ts), calcula zonas e painéis, pinta
 * o diagrama inteiro em cada painel (o canvas recorta) e encaixa o plano no retângulo da tela, no plano z = Z_FUNDO do
 * grupo do fundo (preso ao mundo). Por quadro: só uniformes. Brilho contido (o rosto domina); apaga com uD.
 */
import * as THREE from 'three'
import { desenhado } from '../../pausa'
import { blocoCartoes } from './cartoes'
import { blocoEstreito } from './bloco_estreito'
import { blocoFluxo } from './bloco_fluxo'
import { blocoAssincronoLinha } from './bloco_medio'
import { blocoAssincrono, blocoEntrega, blocoIntegracoes, blocoObservabilidade, blocoRuntime } from './bloco_lados'
import type { Formato } from './composicao'
import { criarDecisoes, type Par } from './decisoes'
import { TAM, type Tela } from './estilo'
import { Pincel, type Quadro } from './pincel'
import { criarRevela, type Revela } from './revela'
import type { Quadro as QuadroRoteiro } from './roteiro'
import { PAINEIS, paineisPara, zonasPara, type Referencias, type Zonas } from './zonas'

/** Profundidade dos painéis no espaço do glb (atrás do rosto, ao lado da cabeça), como o fundo do QA. */
const Z_FUNDO = -0.22
/** Resolução do canvas: px por px CSS (dpr, até 2). */
const ESCALA_MAX = 2
const BRILHO = 0.92
const ACENTO = '#ff6ec7'
/** Altura mínima da base para o assíncrono e os cartões (a mesma com que zonas.ts valida a base). */
const RESTO_BASE = 90

/**
 * O fluxo principal (J74, zonas.ts): na faixa de cima (com o assíncrono na coluna entre o título e a cabeça, se
 * houver), no alto da base ou, sem as duas, a silhueta do retrato.
 */
function* pintarFluxo(tl: Tela, z: Zonas): Generator<void, void> {
  const fx = z.fluxo
  if (fx?.onde === 'silhueta') {
    blocoEstreito({ ...tl, f: 'estreito' }, fx.q, null)
    return
  }
  const noTopo = fx?.onde === 'topo'
  // A seta do evento desce do fluxo para o assíncrono só quando o fluxo está em cima dele.
  const xEvento = z.esq && noTopo ? z.esq.x0 + 0.28 * (z.esq.x1 - z.esq.x0) : Number.POSITIVE_INFINITY
  const s = fx ? blocoFluxo({ ...tl, f: fx.estilo }, fx.q, xEvento) : null
  if (!z.esq) return
  yield
  blocoAssincrono(tl, z.esq, s && noTopo ? s.y : z.esq.y0)
}

/** Pinta o diagrama inteiro no pincel (recortado pelo canvas dele). */
function* pintar(tl: Tela, z: Zonas): Generator<void, void> {
  if (tl.f === 'estreito') {
    blocoEstreito(tl, z.esq, z.dir)
    return
  }
  yield* pintarFluxo(tl, z)
  yield
  const fx = z.fluxo
  if (z.dir) {
    const r = { ...z.dir }
    r.y0 = blocoObservabilidade(tl, r) + 8
    yield
    r.y0 = blocoIntegracoes(tl, r) + 8
    yield
    if (r.y1 - r.y0 > 50) blocoRuntime(tl, r)
    yield
  }
  if (z.dirBase) {
    blocoEntrega(tl, z.dirBase)
    yield
  }
  if (!z.base) return
  // Sem coluna entre o título e a cabeça (1024), o assíncrono vai para cima dos cartões.
  const base = { ...z.base }
  // Com o fluxo no alto da base, o assíncrono e os cartões ficam com o resto, se ele tiver a altura mínima da base.
  if (fx?.onde === 'base') base.y0 = fx.q.y1 + 8
  if (base.y1 - base.y0 < RESTO_BASE) return
  if (!z.esq) {
    base.y0 = blocoAssincronoLinha(tl, base) + 6
    yield
  }
  blocoCartoes(tl, base)
}

export function criarFundo() {
  const paineis = PAINEIS.map((nome) => {
    const r: Revela = criarRevela(`arq_fundo_${nome}`, { campo: false, brilho: BRILHO, corFluxo: ACENTO })
    const geo = new THREE.PlaneGeometry(1, 1)
    const mesh = new THREE.Mesh(geo, r.material)
    mesh.name = `arq_fundo_${nome}`
    mesh.renderOrder = -1
    mesh.visible = false
    return { nome, r, geo, mesh }
  })
  const decisoes = criarDecisoes()
  /** Marcos (ícones) da última pintura e as zonas vigentes (lidos por tracos.ts e pelas ferramentas do estúdio). */
  const estado = {
    marcos: [] as { x: number; y: number; t: number }[],
    alarme: null as { x: number; y: number; t: number } | null,
    zonas: null as Zonas | null,
    ref: null as Referencias | null,
  }

  const raio = new THREE.Raycaster()
  const plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), -Z_FUNDO)
  const inv = new THREE.Matrix4()
  const ndc = new THREE.Vector2()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  /** Ponto da tela (px CSS) no plano z = Z_FUNDO do pai, em coordenadas do pai. */
  const noPlano = (x: number, y: number, camera: THREE.Camera, w: number, h: number, out: THREE.Vector3) => {
    ndc.set((x / w) * 2 - 1, 1 - (y / h) * 2)
    raio.setFromCamera(ndc, camera)
    raio.ray.applyMatrix4(inv)
    return raio.ray.intersectPlane(plano, out) ?? out.set(0, 0, Z_FUNDO)
  }

  /**
   * Pinta e encaixa os painéis para as referências `ref` (no resize), em passos (#138: quem roda fatia, e.g.
   * emFatias): o pincel grava, a pintura toca aos poucos e as texturas sobem à GPU (`subir`) uma por passo; painéis,
   * marcos e decisões só mudam no último passo, com tudo pronto. Cancelado no meio, descarta as texturas novas.
   */
  function* ajustar(
    camera: THREE.Camera,
    f: Formato,
    ref: Referencias,
    img: HTMLImageElement,
    subir: (t: THREE.Texture) => void,
  ): Generator<unknown, () => void> {
    const pai = paineis[0]?.mesh.parent
    if (!pai) return () => undefined
    // A matriz do grupo é a da âncora no último quadro (a cabeça em repouso); recalcular aqui misturaria o giro atual.
    camera.updateMatrixWorld()
    const invInicio = pai.matrixWorld.clone().invert()
    const zonas = zonasPara(f, ref)
    const rects = paineisPara(zonas)
    const escala = Math.min(ESCALA_MAX, window.devicePixelRatio || 1)
    let marcos: typeof estado.marcos = []
    let alarme: typeof estado.alarme = estado.alarme
    let pares: Par[] = []
    const pintados: { p: (typeof paineis)[number]; q: Quadro; troca: ReturnType<Revela['preparar']> }[] = []
    let pronto = false
    try {
      for (const p of paineis) {
        const q: Quadro | null = rects[p.nome]
        if (!q) continue
        const pincel = new Pincel(q, escala, true)
        yield* pintar({ p: pincel, img, f }, zonas)
        if (!marcos.length) {
          marcos = pincel.marcos
          alarme = pincel.alvos.alarme ?? null
          pares = pincel.pares
        }
        yield
        yield* pincel.pintura()
        const troca = p.r.preparar(pincel.cor, pincel.dados)
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
      estado.ref = ref
      estado.marcos = marcos
      estado.alarme = alarme
      for (const p of paineis) p.mesh.visible = false
      for (const { p, q, troca } of pintados) {
        troca.usar()
        noPlano(q.x0, q.y0, camera, ref.w, ref.h, a)
        noPlano(q.x1, q.y1, camera, ref.w, ref.h, b)
        p.mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, Z_FUNDO)
        p.mesh.scale.set(Math.abs(b.x - a.x), Math.abs(a.y - b.y), 1)
        p.mesh.userData.rect = { ...q }
        p.mesh.visible = true
      }
      // Tradeoffs (D18): o tamanho de destaque é 1,7× o ícone do fluxo principal, limitado pelo palco de cada par.
      decisoes.definir(pares, img, TAM[f].icone * 1.7, (x, y, out) => noPlano(x, y, camera, ref.w, ref.h, out))
    }
  }

  /** Ponto da tela (px CSS) no plano do fundo, em coordenadas do grupo do fundo (para os traços e o olhar). */
  const pontoNoFundo = (x: number, y: number, camera: THREE.Camera, w: number, h: number, out: THREE.Vector3) => {
    const pai = paineis[0]?.mesh.parent
    if (!pai) return out.set(0, 0, Z_FUNDO)
    inv.copy(pai.matrixWorld).invert()
    return noPlano(x, y, camera, w, h, out)
  }

  /** Uniformes do quadro (sem alocar). `tempo`: relógio do tráfego. */
  const atualizar = (q: QuadroRoteiro, tempo: number, parado = false) => {
    decisoes.atualizar(q.t, parado)
    for (const p of paineis) {
      p.r.u.uT.value = q.t
      p.r.u.uEst.value.set(q.est)
      p.r.u.uFluxo.value = q.fluxo
      p.r.u.uTempo.value = tempo
    }
  }
  const dispose = () => {
    decisoes.dispose()
    for (const p of paineis) {
      p.r.dispose()
      p.geo.dispose()
    }
  }
  return { meshes: [...paineis.map((p) => p.mesh), decisoes.mesh], estado, ajustar, pontoNoFundo, atualizar, dispose }
}
