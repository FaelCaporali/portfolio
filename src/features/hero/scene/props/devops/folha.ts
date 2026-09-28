/**
 * A PLANTA na folha da prancheta (FICHA-PRODUCAO, FECHAMENTO: `arq_folha` com UV 0–1, "o desenho é CANVAS seu, linhas
 * brancas sobre azul, traço técnico"; D12, D14): grade fina, carimbo, o MONÓLITO com o ícone do Lightsail e os módulos
 * dentro dele; o risco a lápis vermelho; a DECOMPOSIÇÃO em serviços ligados ao gateway. Pintado uma vez (revela.ts: o
 * traço se desenha e o texto se escreve no tempo do roteiro) e aplicado numa malha que reaproveita a geometria da
 * folha, com polygon offset sobre o papel e a desintegração pelo campo do busto. Quando os traços sobem (tracos.ts), a
 * decomposição esmaece no papel (grupo `monolito`, estado B). A faixa v 0–0,20 fica livre (sob a régua paralela).
 */
import * as THREE from 'three'
import { desenharIcone } from './icones'
import { MONO } from './estilo'
import { Pincel, type Ponto } from './pincel'
import { GRUPO, criarRevela } from './revela'
import { ESCALA, T } from './roteiro'

/** Canvas da folha (A5 paisagem, 210 × 148). */
const LARG = 1024
const ALT = 722
/** Até onde o desenho desce (px): acima da faixa da régua (v 0,20). */
const FIM = ALT * 0.78
const TRACO = 'rgba(236, 244, 255, 0.95)'
const GRADE = 'rgba(214, 230, 255, 0.13)'
const LAPIS = '#ff6f6f'

/** Caixas da decomposição (px do canvas) e o nome de cada serviço. */
const SERVICOS = [
  { nome: 'orders', x: 470, y: 205 },
  { nome: 'users', x: 640, y: 205 },
  { nome: 'billing', x: 810, y: 205 },
  { nome: 'notify', x: 470, y: 340 },
  { nome: 'proxy', x: 640, y: 340 },
  { nome: 'queue', x: 810, y: 340 },
] as const
const CX = 150
const CY = 80

const fonte = (px: number, peso = '') => `${peso} ${px}px ${MONO}`.trim()

function pintarPlanta(p: Pincel, img: HTMLImageElement) {
  const m0 = T.monolito[0]
  // Offsets pelo fator do seu evento (roteiro.ts, RITMO.md).
  const KP = ESCALA.planta
  const KD = ESCALA.decompoe
  // Grade e carimbo: já estão no papel quando a vida entra.
  p.forma({ t: 0 }, (ctx, tinta) => {
    ctx.strokeStyle = tinta(GRADE)
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 32; x < LARG; x += 32) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, FIM)
    }
    for (let y = 32; y < FIM; y += 32) {
      ctx.moveTo(0, y)
      ctx.lineTo(LARG, y)
    }
    ctx.stroke()
  })
  p.texto({ t: 0 }, 40, 48, fonte(26, '700'), [['SOLUTION BLUEPRINT', TRACO]])
  p.texto({ t: 0 }, 760, 48, fonte(20), [['REV A · 1:100', TRACO]])
  // Monólito (D14): caixa, ícone do Lightsail, módulos.
  const box: [number, number, number, number] = [56, 110, 370, 440]
  p.caixa({ t: m0 }, box[0], box[1], box[2], box[3], { cor: TRACO, largura: 3, dur: 0.3 * KP })
  const ic = 72
  p.imagem({ t: m0 + 0.15 * KP }, box[0] + 20 + ic / 2, box[1] + 20 + ic / 2, ic, (ctx) =>
    desenharIcone(ctx, img, 'lightsail', box[0] + 20 + ic / 2, box[1] + 20 + ic / 2, ic),
  )
  p.texto({ t: m0 + 0.2 * KP }, box[0] + 110, box[1] + 44, fonte(30, '700'), [['MONOLITH', TRACO]], 0.02)
  p.texto({ t: m0 + 0.25 * KP }, box[0] + 110, box[1] + 80, fonte(20), [['Lightsail · 1 DB', TRACO]], 0.01)
  const modulos = ['orders', 'users', 'billing', 'email', 'integrations']
  modulos.forEach((n, i) => {
    const y = box[1] + 140 + i * 38
    const t = m0 + (0.3 + i * 0.04) * KP
    const tr = { cor: TRACO, largura: 1.5, dur: 0.1 * KP, tracejado: [8, 5] }
    p.caixa({ t }, box[0] + 24, y - 15, box[2] - 24, y + 17, tr)
    p.texto({ t: t + 0.05 * KP }, box[0] + 40, y + 1, fonte(20), [[n, TRACO]], 0.008)
  })
  // Risco a lápis (análise): um X sobre o monólito.
  const [r0, r1] = T.risca
  const risco = (a: Ponto, b: Ponto, t: number) =>
    p.linha({ t }, [a, b], { cor: LAPIS, largura: 5, dur: (r1 - r0) / 2 })
  risco([box[0] - 10, box[1] - 10], [box[2] + 10, box[3] + 10], r0)
  risco([box[2] + 10, box[1] - 10], [box[0] - 10, box[3] + 10], (r0 + r1) / 2)
  // Decomposição: gateway, serviços e ligações (esmaecem quando os traços sobem: grupo `monolito`).
  const [d0, d1] = T.decompoe
  const g = GRUPO.monolito
  const seta: Ponto[] = [
    [box[2] + 16, 275],
    [440, 275],
  ]
  p.linha({ t: d0 }, seta, { cor: TRACO, largura: 3, dur: 0.1 * KD, seta: true })
  const gw: [number, number, number, number] = [470 - CX / 2, 110, 810 + CX / 2, 150]
  for (const lado of ['a', 'b'] as const) {
    const cor = lado === 'a' ? TRACO : 'rgba(236, 244, 255, 0.28)'
    const m = { t: d0 + 0.05 * KD, g, so: lado }
    p.caixa(m, gw[0], gw[1], gw[2], gw[3], { cor, largura: 2.5, dur: 0.12 * KD })
    p.texto({ ...m, t: d0 + 0.1 * KD }, gw[0] + 16, 131, fonte(20, '700'), [['API GATEWAY · ALB', cor]], 0.006)
    SERVICOS.forEach((s, i) => {
      const t = d0 + 0.12 * KD + i * ((d1 - d0 - 0.2 * KD) / SERVICOS.length)
      const mi = { t, g, so: lado }
      p.linha(
        mi,
        [
          [s.x, 150],
          [s.x, s.y - CY / 2],
        ],
        { cor, largura: 2, dur: 0.05 * KD },
      )
      p.caixa(mi, s.x - CX / 2, s.y - CY / 2, s.x + CX / 2, s.y + CY / 2, { cor, largura: 2.5, dur: 0.1 * KD })
      p.texto({ ...mi, t: t + 0.06 * KD }, s.x - CX / 2 + 14, s.y, fonte(22, '600'), [[s.nome, cor]], 0.008)
    })
  }
}

/** Centros das caixas da decomposição em UV da folha (u → direita na tela, v = 1 em cima): de onde os traços sobem. */
export const ORIGENS_UV: readonly Ponto[] = SERVICOS.map((s) => [s.x / LARG, 1 - s.y / ALT])

export function criarPlanta(folha: THREE.Mesh) {
  const r = criarRevela('arq_planta', { campo: true, brilho: 1, corFluxo: '#ffffff' })
  const m = r.material
  m.polygonOffset = true
  m.polygonOffsetFactor = -1
  m.polygonOffsetUnits = -4
  const mesh = new THREE.Mesh(folha.geometry, m)
  mesh.name = 'arq_planta'
  mesh.renderOrder = 1
  mesh.visible = false
  folha.add(mesh)
  let pintada = false
  const pintar = (img: HTMLImageElement) => {
    if (pintada) return
    const p = new Pincel({ x0: 0, y0: 0, x1: LARG, y1: ALT }, 1)
    pintarPlanta(p, img)
    r.texturas(p.cor, p.dados)
    mesh.visible = true
    pintada = true
  }
  /** Ponto da folha (u, v) no espaço da malha da folha (a geometria é plana no XY local). */
  folha.geometry.computeBoundingBox()
  const b = folha.geometry.boundingBox ?? new THREE.Box3()
  const local = (u: number, v: number, out: THREE.Vector3) =>
    out.set(b.min.x + u * (b.max.x - b.min.x), b.min.y + v * (b.max.y - b.min.y), b.max.z)
  return { mesh, revela: r, pintar, local }
}
