/**
 * Composição da vida qa por formato de tela (FICHA-PRODUCAO.md, métricas de aceite, FICHA v2 e ADENDO v2.1; medida
 * com 3d/tools/props/volta_prop.mjs qa e colisao_orq.mjs qa, LOG da v1, TD2). Primeiro plano do lado direito do Fael
 * (esquerda da tela), entre o texto e o rosto: o ponto de captura (a lente) na altura dos olhos e a caixa embaixo, na
 * mesa; assim a lupa leva o bug à vaga sem cruzar o rosto. Fundo: o bug report à esquerda da cabeça, acima da lente
 * (Q25), e o caso de teste à direita da cabeça (Q20). Espaço do glb: +X à esquerda do Fael
 * (direita da tela), +Z para a câmera.
 */
import type { Retangulo } from './fundo'

export interface Composicao {
  /** Ponto de captura = centro da lente (espaço do glb). */
  captura: readonly [number, number, number]
  /** Captura do lado esquerdo do Fael (+X, direita da tela): espelha as rotas e a lupa. */
  espelho: boolean
  /** Largura das rotas do voo (fator no x; voo.ts). */
  rotaX: number
  /** Escala da lupa (lente ≥ 48 px CSS no 360). */
  lupa: number
  /** Giro da lupa em volta do eixo da lente (rad, + anti-horário na tela; 0 = cabo para baixo e para fora), na
   * captura e sobre a caixa: o cabo (22 cm do glb) nunca chega à borda de baixo nem ao texto da UI. No 1440 ele sobe
   * para fora sobre a caixa; no 1024 fica quase vertical (a caixa sobe para caber); no 360 deita por baixo da boca, na
   * barba, enquanto a lente desce (o título está logo abaixo). */
  giro: number
  giroCaixa: number
  /** De onde a lupa sobe (deslocamento do ponto de captura, m): por baixo, em linha reta. */
  entrada: readonly [number, number, number]
  /** Caixa na mesa: aresta de apoio (m, glb), giro em Y (rad, de frente para a câmera) e escala. */
  caixa: { pos: readonly [number, number, number]; giroY: number; escala: number }
  /** Lente sobre a vaga: deslocamento da vaga (m) enquanto o bug desce ao alfinete. */
  sobreVaga: readonly [number, number, number]
}

export type Formato = 'largo' | 'medio' | 'estreito'

/** Retrato (largura < altura), paisagem estreita (< 1200 px CSS, o 1024×768) e larga (o 1440×900). */
export function formato(w: number, h: number): Formato {
  if (w < h) return 'estreito'
  return w < 1200 ? 'medio' : 'largo'
}

/** 1440: entre o texto e o rosto há ~350 px. 1024: ~140 px (lupa menor). 360: coluna livre à esquerda da cabeça. */
export const COMPOSICAO: Record<Formato, Composicao> = {
  largo: {
    captura: [-0.145, 0.16, 0.04],
    espelho: false,
    rotaX: 1,
    lupa: 0.9,
    giro: 0,
    giroCaixa: -2.3,
    entrada: [-0.05, -0.012, 0.02],
    caixa: { pos: [-0.135, -0.035, 0.08], giroY: 0.35, escala: 0.8 },
    sobreVaga: [0, 0.004, 0.035],
  },
  medio: {
    captura: [-0.112, 0.165, 0.04],
    espelho: false,
    rotaX: 1,
    lupa: 0.7,
    giro: 0.15,
    giroCaixa: 0.15,
    entrada: [-0.02, -0.06, 0.02],
    caixa: { pos: [-0.13, -0.01, 0.08], giroY: 0.35, escala: 0.65 },
    sobreVaga: [0, 0.004, 0.035],
  },
  estreito: {
    captura: [-0.13, 0.19, 0.035],
    espelho: false,
    rotaX: 0.85,
    lupa: 1,
    giro: 0.94,
    giroCaixa: 1.73,
    entrada: [0, -0.04, 0.01],
    caixa: { pos: [-0.14, 0.02, 0.08], giroY: 0.35, escala: 0.75 },
    sobreVaga: [0, 0.004, 0.035],
  },
}

/** Painéis do fundo na tela (px CSS) e o corpo da fonte (px CSS; ADENDO v2.1: ≥ 10,5 no retrato). */
export interface Fundo {
  report: Retangulo
  teste: Retangulo
  corpo: number
}

/** Pontos da cena projetados na tela (px CSS): bordas da cabeça na altura dos olhos e o topo do aro da lente. */
export interface Referencias {
  esq: number
  dir: number
  lente: number
}

/**
 * Retângulos do fundo para a tela `w`×`h` (Q20, Q23, Q25): o report à esquerda da cabeça, colado à cena, entre a UI e
 * o rosto e acima da lente; o caso de teste à direita da cabeça. Fora da interface com respiro ≥ 16 px (o texto da UI
 * vai até ~34% da largura no 1440 e começa em ~32% da altura no 1024; o indicador de vidas termina em ~76 px; o
 * "Contact me" fica no canto de baixo à direita) e ≥ 16 px das bordas.
 */
export function fundoPara(f: Formato, w: number, h: number, r: Referencias): Fundo {
  if (f === 'estreito') {
    return {
      report: { x0: 20, y0: 100, x1: r.esq - 4, y1: r.lente - 8 },
      teste: { x0: r.dir + 4, y0: 100, x1: w - 20, y1: h * 0.44 },
      corpo: 10.5,
    }
  }
  if (f === 'medio') {
    return {
      report: { x0: w * 0.2, y0: 100, x1: r.esq - 12, y1: Math.min(h * 0.28, r.lente - 16) },
      teste: { x0: r.dir + 16, y0: 100, x1: w - 20, y1: h * 0.86 },
      corpo: 11,
    }
  }
  return {
    report: { x0: w * 0.345, y0: 100, x1: r.esq - 12, y1: r.lente - 16 },
    teste: { x0: r.dir + 16, y0: 100, x1: w - 24, y1: h * 0.88 },
    corpo: 13,
  }
}
