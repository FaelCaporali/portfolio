/**
 * FUNDO da vida devops (FICHA-PRODUCAO, FECHAMENTO; D8–D13): o diagrama de soluções nas zonas livres em volta da
 * cabeça (zonas.ts), em até três painéis (esquerda, direita, base), cada um um plano com o material de revelação
 * (revela.ts; uma chamada por painel). No resize: mede as referências (referencias.ts), calcula zonas e painéis, pinta
 * o diagrama inteiro em cada painel (o canvas recorta) e encaixa o plano no retângulo da tela, no plano z = Z_FUNDO do
 * grupo do fundo (preso ao mundo). Por quadro: só uniformes. Brilho contido (o rosto domina); apaga com uD.
 */
import * as THREE from 'three'
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
export const Z_FUNDO = -0.22
/** Resolução do canvas: px por px CSS (dpr, até 2). */
const ESCALA_MAX = 2
const BRILHO = 0.92
const ACENTO = '#ff6ec7'

/** Pinta o diagrama inteiro no pincel (recortado pelo canvas dele). */
function pintar(tl: Tela, z: Zonas) {
  if (tl.f === 'estreito') {
    blocoEstreito(tl, z.esq, z.dir)
    return
  }
  const xEvento = z.esq ? z.esq.x0 + 0.28 * (z.esq.x1 - z.esq.x0) : Number.POSITIVE_INFINITY
  if (z.topo) {
    const s = blocoFluxo(tl, z.topo, xEvento)
    if (z.esq) blocoAssincrono(tl, z.esq, s.y)
  }
  if (z.dir) {
    const r = { ...z.dir }
    r.y0 = blocoObservabilidade(tl, r) + 8
    r.y0 = blocoIntegracoes(tl, r) + 8
    if (r.y1 - r.y0 > 50) blocoRuntime(tl, r)
  }
  if (z.dirBase) blocoEntrega(tl, z.dirBase)
  if (!z.base) return
  // Sem coluna entre o título e a cabeça (1024), o assíncrono vai para cima dos cartões.
  const base = { ...z.base }
  if (!z.esq) base.y0 = blocoAssincronoLinha(tl, base) + 6
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

  /** Pinta e encaixa os painéis para as referências `ref` (no resize). */
  const ajustar = (camera: THREE.Camera, f: Formato, ref: Referencias, img: HTMLImageElement) => {
    const pai = paineis[0]?.mesh.parent
    if (!pai) return
    // A matriz do grupo é a da âncora no último quadro (a cabeça em repouso); recalcular aqui misturaria o giro atual.
    camera.updateMatrixWorld()
    inv.copy(pai.matrixWorld).invert()
    const zonas = zonasPara(f, ref)
    const rects = paineisPara(zonas)
    const escala = Math.min(ESCALA_MAX, window.devicePixelRatio || 1)
    estado.zonas = zonas
    estado.marcos = []
    let pares: Par[] = []
    for (const p of paineis) {
      const q: Quadro | null = rects[p.nome]
      if (!q) {
        p.mesh.visible = false
        continue
      }
      const pincel = new Pincel(q, escala)
      pintar({ p: pincel, img, f }, zonas)
      if (!estado.marcos.length) {
        estado.marcos = pincel.marcos
        estado.alarme = pincel.alvos.alarme ?? null
        pares = pincel.pares
      }
      p.r.texturas(pincel.cor, pincel.dados)
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
