/**
 * FUNDO da vida ai (FICHA §4): as três janelas da história nas zonas livres (zonas.ts) — a IDE dele (bloco_ide.ts), o
 * chat do produto com o trace (bloco_chat.ts) e o lado humano da noite, n8n e operador (bloco_humano.ts) — e o FIO de
 * luz que desenha o 8 na ordem da história (oito.ts, fita.ts) por baixo das janelas, mais o elo do 0.8 ao escudo.
 * Técnica do devops e do techlead: cada janela é um plano com o material de revelação (revela.ts; uma chamada por
 * painel), pintado UMA vez no resize pelo Pincel, e o roteiro só mexe em uniformes e nos atributos das fitas. A cena
 * ativa fica em destaque e as passadas em silhueta (uBrilho). Apaga com a desintegração (uD).
 */
import * as THREE from 'three'
import { desenhado } from '../../pausa'
import type { Formato } from '../devops/composicao'
import { chat, chatMini } from './bloco_chat'
import { humanoMini, ladoHumano } from './bloco_humano'
import { ide, ideMini } from './bloco_ide'
import type { Tela } from './estilo'
import { criarFita } from './fita'
import { montarElo, montarOito, type Caminho } from './oito'
import { Pincel, type Quadro } from './pincel'
import { criarRevela, type Revela } from './revela'
import { T, type Alvo, type Cena, type Quadro as QuadroRoteiro } from './roteiro'
import { zonasPara, type Medida, type Zonas } from './zonas'

/** Profundidade dos painéis e das fitas no espaço do glb (atrás do rosto, ao lado da cabeça), como o techlead. */
const Z_FUNDO = -0.22
const ESCALA_MAX = 2
const BRILHO = 0.94
const CENAS: readonly Cena[] = ['ide', 'chat', 'humano']

/** Pinta a janela `nome` na zona `q`. */
function pintar(tl: Tela, nome: Cena, q: Quadro) {
  const mini = tl.f === 'estreito'
  if (nome === 'ide') (mini ? ideMini : ide)(tl, q)
  else if (nome === 'chat') (mini ? chatMini : chat)(tl, q)
  else (mini ? humanoMini : ladoHumano)(tl, q)
}

/** Interpolação por marcos [instante, valor] (antes do primeiro: -1). */
function porMarcos(m: readonly (readonly [number, number])[], c: number) {
  const p0 = m[0]
  if (!p0 || c < p0[0]) return -1
  for (let i = 1; i < m.length; i++) {
    const [t1, s1] = m[i] as readonly [number, number]
    const [t0, s0] = m[i - 1] as readonly [number, number]
    if (c <= t1) return s0 + ((s1 - s0) * (c - t0)) / Math.max(1e-3, t1 - t0)
  }
  return m[m.length - 1]?.[1] ?? -1
}

export function criarFundo() {
  const paineis = CENAS.map((nome) => {
    const r: Revela = criarRevela(`ai_fundo_${nome}`, { brilho: BRILHO })
    const geo = new THREE.PlaneGeometry(1, 1)
    const mesh = new THREE.Mesh(geo, r.material)
    mesh.name = `ai_fundo_${nome}`
    mesh.renderOrder = -1
    mesh.visible = false
    return { nome, r, geo, mesh }
  })
  // O 8 passa por baixo das janelas; o elo do 0.8 ao escudo, por cima (ele liga dois textos).
  const fio = criarFita('ai_fio', -2)
  const elo = criarFita('ai_elo', 1)
  /** Pontos do olhar (px CSS), zonas e o caminho do 8 (lidos pelas ferramentas e pelo robô). */
  const estado = {
    alvos: {} as Partial<Record<Alvo, { x: number; y: number }>>,
    zonas: null as Zonas | null,
    caminho: null as Caminho | null,
    /** Caixa do robô montado na tela (px CSS). */
    robo: null as Quadro | null,
  }
  let marcosFio: [number, number][] = []
  let eloTotal = 0

  const raio = new THREE.Raycaster()
  const plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), -Z_FUNDO)
  const inv = new THREE.Matrix4()
  const ndc = new THREE.Vector2()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const noPlano = (x: number, y: number, camera: THREE.Camera, w: number, h: number, out: THREE.Vector3) => {
    ndc.set((x / w) * 2 - 1, 1 - (y / h) * 2)
    raio.setFromCamera(ndc, camera)
    raio.ray.applyMatrix4(inv)
    return raio.ray.intersectPlane(plano, out) ?? out.set(0, 0, Z_FUNDO)
  }

  /**
   * Pinta e encaixa as janelas e as fitas para a medida `md` (no resize), em passos (#138: quem roda fatia, e.g.
   * emFatias): o pincel grava, a pintura toca aos poucos e as texturas sobem à GPU (`subir`) uma por passo; janelas,
   * fitas e olhar só mudam na troca que ele devolve. Cancelado no meio, descarta as texturas novas.
   */
  function* ajustar(
    camera: THREE.Camera,
    f: Formato,
    md: Medida,
    img: HTMLImageElement,
    subir: (t: THREE.Texture) => void,
  ): Generator<unknown, () => void> {
    const pai = paineis[0]?.mesh.parent
    if (!pai) return () => undefined
    camera.updateMatrixWorld()
    const invInicio = pai.matrixWorld.clone().invert()
    const zonas = zonasPara(f, md)
    const escala = Math.min(ESCALA_MAX, window.devicePixelRatio || 1)
    const alvos: typeof estado.alvos = { robo: { x: md.pe[0], y: md.pe[1] - 30 } }
    const pintados: { p: (typeof paineis)[number]; q: Quadro; troca: ReturnType<Revela['preparar']> }[] = []
    let pronto = false
    try {
      for (const p of paineis) {
        const q = zonas[p.nome]
        if (!q) continue
        const tl: Tela = { p: new Pincel(q, escala, true), img, f, alvos }
        pintar(tl, p.nome, q)
        tl.p.fechar()
        yield
        yield* tl.p.pintura()
        const troca = p.r.preparar(tl.p.cor, tl.p.dadosParaSubir, tl.p.fundoCor)
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
      estado.robo = md.robo
      estado.alvos = alvos
      for (const p of paineis) p.mesh.visible = false
      for (const { p, q, troca } of pintados) {
        troca.usar()
        noPlano(q.x0, q.y0, camera, md.w, md.h, a)
        noPlano(q.x1, q.y1, camera, md.w, md.h, b)
        p.mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, Z_FUNDO)
        p.mesh.scale.set(Math.abs(b.x - a.x), Math.abs(a.y - b.y), 1)
        p.mesh.userData.rect = { ...q }
        p.mesh.visible = true
      }
      const meia = Math.max(0.6, ((md.cabeca.y1 - md.cabeca.y0) / 539) * 0.9)
      const mapa = (x: number, y: number, out: THREE.Vector3) => noPlano(x, y, camera, md.w, md.h, out)
      const c = montarOito(md, zonas)
      estado.caminho = c
      marcosFio = []
      if (c) {
        fio.ajustar(c, meia, mapa)
        const F = T.fio
        marcosFio = [
          [F.sai, 0],
          [F.mesa, c.marcos.mesa],
          [F.chat, c.marcos.chat],
          [F.cruza[0], c.marcos.chat],
          [F.cruza[1], c.marcos.humano],
          [F.volta[0], c.marcos.humano],
          [F.volta[1], c.total],
        ]
      }
      const { limiar, escudo } = estado.alvos
      eloTotal = 0
      if (limiar && escudo && zonas.ide) {
        const e = montarElo([limiar.x, limiar.y], zonas.ide, [escudo.x, escudo.y])
        elo.ajustar(e, meia * 1.1, mapa)
        eloTotal = e.total
      }
    }
  }

  /** Ponto da tela (px CSS) no plano do fundo, em coordenadas do grupo do fundo (para o olhar e o robô). */
  const pontoNoFundo = (x: number, y: number, camera: THREE.Camera, w: number, h: number, out: THREE.Vector3) => {
    const pai = paineis[0]?.mesh.parent
    if (!pai) return out.set(0, 0, Z_FUNDO)
    inv.copy(pai.matrixWorld).invert()
    return noPlano(x, y, camera, w, h, out)
  }

  /** Uniformes, foco das janelas e as fitas, sem alocar. `parado`: sem a cabeça do pulso (estado final). */
  const atualizar = (q: QuadroRoteiro, parado: boolean) => {
    for (const p of paineis) {
      p.r.u.uT.value = q.t
      p.r.u.uEst.value.set(q.est)
      p.r.u.uBrilho.value = BRILHO * q.foco[p.nome]
    }
    const frente = Math.max(0, porMarcos(marcosFio, q.t))
    fio.atualizar(frente, parado ? -1 : frente)
    const fe = q.elo * eloTotal
    elo.atualizar(fe, parado || q.elo >= 1 ? -1 : fe, q.eloBrilho)
  }
  const dispose = () => {
    fio.dispose()
    elo.dispose()
    for (const p of paineis) {
      p.r.dispose()
      p.geo.dispose()
    }
  }
  const meshes = [...paineis.map((p) => p.mesh), fio.mesh, elo.mesh]
  return { meshes, estado, ajustar, pontoNoFundo, atualizar, dispose }
}
