/**
 * Zonas LIVRES da tela para o diagrama da vida devops (FICHA-PRODUCAO, FECHAMENTO, "Composição"): em volta da
 * cabeça, nunca atrás dela, da prancheta ou da interface (respiro ≥ 16 px da UI e ≥ 16 px da borda). Tudo em px CSS
 * do canvas, medido no resize (nunca por quadro): a caixa do texto do herói, o indicador de vidas e o balão de
 * contato no DOM; a cabeça e a prancheta projetadas da cena.
 *   largo/médio: TOPO (acima do texto, até a cabeça), ESQ (entre o título e a cabeça), BASE (abaixo do texto, até a
 *   prancheta), DIR (à direita da cabeça) e DIR_BASE (à direita da prancheta, acima do balão);
 *   estreito (retrato): as duas faixas ao lado da cabeça, acima da prancheta.
 * Os PAINÉIS (uma malha cada): topo, esq, direita (dir + dir_base, vizinhas e fora da UI) e base. Nenhum plano cobre a
 * interface, nem transparente (os portões medem a silhueta do plano).
 */
import type { Formato } from './composicao'
import type { Quadro } from './pincel'

export interface Referencias {
  w: number
  h: number
  /** Caixa do texto do herói (título, subtítulo, botões, contatos). */
  ui: Quadro
  /** Fim do cabeçalho e do indicador de vidas (px). */
  topo: number
  balao: Quadro | null
  cabeca: Quadro
  mesa: Quadro
}

export interface Zonas {
  topo: Quadro | null
  esq: Quadro | null
  base: Quadro | null
  dir: Quadro | null
  dirBase: Quadro | null
  /**
   * Onde vai o FLUXO PRINCIPAL (o diagrama da aplicação, em cima à esquerda), presente em toda tela (J74): 'topo' (a
   * faixa acima do texto, o normal), 'base' (abaixo do texto, quando a faixa de cima é baixa demais, como no notebook
   * 1366×657) ou 'silhueta' (a coluna do retrato na `esq`). `estilo`: os tamanhos (TAM) com que ele é desenhado.
   */
  fluxo: { onde: 'topo' | 'base' | 'silhueta'; estilo: Formato; q: Quadro } | null
}

/**
 * Altura (px) com que o fluxo principal cabe sem sobrepor nomes: largo (medido no 1440×900, 165 px; no 1280×800, com
 * 119 px, os nomes se atropelam) e médio (nomes curtos, sem notas; o 1024×768 tem 108 px).
 */
const ALTURA_FLUXO = { largo: 150, medio: 105 } as const
/** Largura (px) em que o fluxo cabe: largo (o 1440×900 tem 792 px) e médio (o 1024×768 tem 554; no 1024×640 a base
 * tem 347 e os nomes se atropelam). */
const LARGURA_FLUXO = { largo: 700, medio: 520 } as const
/** A silhueta no alto da coluna à direita da cabeça (px): a coluna do retrato tem 77 × 213 no 360×780. */
const COLUNA = { w: 96, h: 220 } as const
/** Teto do fluxo quando ele desce para a base: o resto da base fica para o assíncrono e os cartões. */
const TETO_FLUXO = { largo: 190, medio: 125 } as const

/** Respiro da UI e da borda: 16 px da ficha + 4 px de folga (projeção do plano, arredondamento). */
const RESPIRO = 20
const BORDA = 20
/** Folga da cabeça (cabelo além da projeção) e da prancheta. */
const CABECA = 12
const MESA = 12

const valida = (q: Quadro, minW: number, minH: number): Quadro | null =>
  q.x1 - q.x0 >= minW && q.y1 - q.y0 >= minH ? q : null

export function zonasPara(f: Formato, r: Referencias): Zonas {
  const { w, h, ui, cabeca, mesa } = r
  const y0 = r.topo + RESPIRO
  if (f === 'estreito') {
    const fim = Math.min(mesa.y0 - 8, ui.y0 - RESPIRO)
    const esq = valida({ x0: BORDA, y0, x1: cabeca.x0 - 6, y1: fim }, 50, 100) ?? colunaCurta(r, y0)
    return {
      topo: null,
      base: null,
      dirBase: null,
      esq,
      dir: valida({ x0: cabeca.x1 + 6, y0, x1: w - BORDA, y1: fim }, 50, 100),
      fluxo: esq && { onde: 'silhueta', estilo: 'estreito', q: esq },
    }
  }
  const baixo = r.balao ? r.balao.y0 - RESPIRO : h - BORDA
  const z = {
    topo: valida({ x0: BORDA, y0, x1: cabeca.x0 - CABECA, y1: ui.y0 - RESPIRO }, 200, 70),
    esq: valida({ x0: ui.x1 + RESPIRO, y0: ui.y0 - RESPIRO, x1: cabeca.x0 - CABECA, y1: mesa.y0 - MESA }, 90, 120),
    base: valida({ x0: BORDA, y0: ui.y1 + RESPIRO, x1: mesa.x0 - RESPIRO, y1: h - BORDA }, 200, 90),
    dir: valida({ x0: cabeca.x1 + CABECA, y0, x1: w - BORDA, y1: mesa.y0 - MESA }, 100, 150),
    dirBase: valida({ x0: mesa.x1 + MESA, y0: mesa.y0 - MESA, x1: w - BORDA, y1: baixo }, 100, 100),
  }
  return { ...z, ...lugarDoFluxo(f, z, r, y0) }
}

/** Estilo em que o fluxo cabe na faixa `q` (o largo só no formato largo); null se nem o médio cabe. */
function estiloFluxo(f: Formato, q: Quadro | null): 'largo' | 'medio' | null {
  if (!q) return null
  const cabe = (e: 'largo' | 'medio') => q.y1 - q.y0 >= ALTURA_FLUXO[e] && q.x1 - q.x0 >= LARGURA_FLUXO[e]
  if (f === 'largo' && cabe('largo')) return 'largo'
  return cabe('medio') ? 'medio' : null
}

/**
 * Lugar do fluxo principal na paisagem (J74): na faixa de cima quando ela cabe (no estilo médio se o largo não cabe);
 * senão no alto da base (abaixo do texto); sem as duas, a silhueta do retrato numa coluna estreita entre o texto e a
 * cabeça (800×360) ou, sem ela, no alto da coluna à direita da cabeça (1024×640), com o resto da coluna embaixo. A
 * faixa de cima que não recebe o fluxo fica sem painel.
 */
function lugarDoFluxo(
  f: Formato,
  z: Omit<Zonas, 'fluxo'>,
  r: Referencias,
  y0: number,
): Pick<Zonas, 'fluxo'> & Partial<Zonas> {
  const noTopo = estiloFluxo(f, z.topo)
  if (z.topo && noTopo) return { fluxo: { onde: 'topo', estilo: noTopo, q: z.topo } }
  const naBase = estiloFluxo(f, z.base)
  if (z.base && naBase) {
    const q = { ...z.base, y1: Math.min(z.base.y1, z.base.y0 + TETO_FLUXO[naBase]) }
    return { topo: null, fluxo: { onde: 'base', estilo: naBase, q } }
  }
  const x0 = r.ui.x1 + RESPIRO
  const col = valida(
    { x0, y0: Math.max(y0, r.ui.y0 - RESPIRO), x1: r.cabeca.x0 - CABECA, y1: r.mesa.y0 - MESA },
    56,
    100,
  )
  if (col) return { topo: null, esq: col, fluxo: { onde: 'silhueta', estilo: 'estreito', q: col } }
  const d = z.dir
  if (!d) return { topo: null, fluxo: null }
  const q = { ...d, x1: Math.min(d.x1, d.x0 + COLUNA.w), y1: Math.min(d.y1, d.y0 + COLUNA.h) }
  const dir = valida({ ...d, y0: q.y1 + 12 }, 100, 120)
  return { topo: null, esq: q, dir, fluxo: { onde: 'silhueta', estilo: 'estreito', q } }
}

/**
 * Retrato baixo (320×568), onde a coluna ao lado da cabeça não chega a 100 px: ela desce até o texto quando não passa
 * sobre a prancheta, e o diagrama vira a silhueta compacta (bloco_estreito.ts).
 */
function colunaCurta(r: Referencias, y0: number): Quadro | null {
  const x1 = r.cabeca.x0 - 6
  const livre = x1 <= r.mesa.x0 - 8
  const y1 = livre ? r.ui.y0 - RESPIRO : Math.min(r.mesa.y0 - 8, r.ui.y0 - RESPIRO)
  return valida({ x0: BORDA, y0, x1, y1 }, 50, 56)
}

/** União de retângulos (nulos fora). */
function uniao(qs: (Quadro | null)[]): Quadro | null {
  const v = qs.filter((q): q is Quadro => q !== null)
  if (!v.length) return null
  return {
    x0: Math.min(...v.map((q) => q.x0)),
    y0: Math.min(...v.map((q) => q.y0)),
    x1: Math.max(...v.map((q) => q.x1)),
    y1: Math.max(...v.map((q) => q.y1)),
  }
}

export type Painel = 'topo' | 'esq' | 'direita' | 'base'
export const PAINEIS: readonly Painel[] = ['topo', 'esq', 'direita', 'base']

/** Retângulo de cada painel (a malha cobre as zonas dele; o que fica fora das zonas é transparente). */
export function paineisPara(z: Zonas): Record<Painel, Quadro | null> {
  return {
    topo: z.topo,
    esq: z.esq,
    direita: uniao([z.dir, z.dirBase]),
    base: z.base,
  }
}
